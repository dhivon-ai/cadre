import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod/v4";
import { contentHash, readSafeArtifact } from "./memory.js";
import { readGitFileAtCommit } from "./git.js";
import { quickIdSchema, quickRecordSchema } from "./quick-record.js";
import { receiptSchema, resolveOperation, type ReceiptFile } from "./operation-receipts.js";
import type { PromotionFile } from "./promotion-evidence.js";
import { inspectionValue } from "./inspection.js";

export const QUICK_ARCHIVE = ".cadre/archive/.quick";
export const quickActivePath = (id: string) => `.cadre/quick/${quickIdSchema.parse(id)}.json`;
export const quickArchivePath = (id: string) => `${QUICK_ARCHIVE}/${quickIdSchema.parse(id)}.json`;
const sourceSchema = z.strictObject({quickId: quickIdSchema, sha256: z.string().regex(/^[0-9a-f]{64}$/),
  disposition: z.enum(["incorporated", "no-change"]), reason: z.string().trim().min(1).max(4096)});
const start = "<!-- cadre:quick-sources:start -->", end = "<!-- cadre:quick-sources:end -->";
export function quickRefreshSources(body: string) {
  if (!body.includes(start) && !body.includes(end)) return [];
  if (body.split(start).length !== 2 || body.split(end).length !== 2 || body.indexOf(end) < body.indexOf(start)) throw new Error("Invalid quick refresh source block");
  const sources = z.array(sourceSchema).max(20).parse(JSON.parse(body.slice(body.indexOf(start) + start.length, body.indexOf(end)).trim()));
  if (new Set(sources.map((source) => source.quickId)).size !== sources.length) throw new Error("Duplicate quick refresh source");
  return sources;
}
function sourcesIn(files: ReceiptFile[]) {
  const project = files.find((file) => file.path === ".cadre/project.json")?.content;
  const primary = project ? JSON.parse(project).lastRefresh?.refreshPath : undefined;
  const sources = files.filter((file) => /^\.cadre\/refreshes\/[^/]+\.md$/.test(file.path) && file.content)
    .flatMap((file) => {
      const assessed = quickRefreshSources(file.content!);
      if (assessed.length && file.path !== `.cadre/${primary}`) throw new Error("Quick sources must belong to the primary refresh record");
      return assessed;
    });
  if (sources.length > 20 || new Set(sources.map((source) => source.quickId)).size !== sources.length) throw new Error("Refresh must assess at most 20 unique quick sources per batch");
  return sources;
}
/** Prove the immutable delivery independently of its current storage location. */
export function requireQuickDelivery(root: string, body: string) {
  const record = quickRecordSchema.parse(JSON.parse(body));
  if (!record.operation || !record.product) throw new Error("Invalid canonical quick record identity or evidence");
  const commit = resolveOperation(root, record.operation);
  if (readGitFileAtCommit(root, commit, quickActivePath(record.quickId)) !== body) throw new Error("Immutable quick record was modified");
  return record;
}
/** Moves are derived from reviewed source references, never supplied as arbitrary candidate writes. */
export function quickRefreshMoves(root: string, files: ReceiptFile[]): ReceiptFile[] {
  return sourcesIn(files).flatMap((source) => {
    const path = quickActivePath(source.quickId), archive = quickArchivePath(source.quickId);
    if (existsSync(join(root, archive))) throw new Error(`Quick source is already archived: ${source.quickId}`);
    const body = readSafeArtifact(root, path);
    requireQuickDelivery(root, body);
    if (contentHash(body) !== source.sha256) throw new Error(`Refresh quick source is unavailable or changed: ${source.quickId}`);
    return [{path: archive, content: body}, {path, content: null}];
  });
}
/** Works after either half of a move and after the authoring stage is lost. */
export function requireQuickRefreshSources(root: string, files: PromotionFile[]): void {
  const sources = sourcesIn(files), owned = new Set<string>();
  for (const source of sources) {
    const path = quickActivePath(source.quickId), archive = quickArchivePath(source.quickId);
    const removal = files.find((file) => file.path === path), addition = files.find((file) => file.path === archive);
    if (!removal || removal.content !== null || !addition?.content) throw new Error(`Quick consolidation requires its exact archive move: ${source.quickId}`);
    if (contentHash(addition.content) !== source.sha256) throw new Error(`Quick archive differs from assessed source: ${source.quickId}`);
    const record = requireQuickDelivery(root, addition.content);
    if (record.quickId !== source.quickId) throw new Error("Quick archive identity mismatch");
    const before = removal.before === undefined ? contentHash(readSafeArtifact(root, path)) : removal.before;
    const destinationBefore = addition.before === undefined ? existsSync(join(root, archive)) : addition.before !== null;
    if (before !== source.sha256 || destinationBefore) throw new Error("Quick archive requires an unchanged source and a fresh destination");
    owned.add(path); owned.add(archive);
  }
  for (const file of files) if ((file.path.startsWith(".cadre/quick/") || file.path.startsWith(`${QUICK_ARCHIVE}/`)) && !owned.has(file.path)) {
    throw new Error("Refresh cannot move unassessed quick records");
  }
}

/** Only a committed refresh with its source assessment and both move artifacts counts. */
export function quickConsolidated(root: string): Set<string> {
  return inspectionValue(`quick-consolidated:${root}`, () => {
    const considered = new Set<string>();
    const project = JSON.parse(readSafeArtifact(root, ".cadre/project.json"));
    for (const item of project.history ?? []) {
      if (item.action !== "refresh" || !/^refreshes\/[a-z0-9-]+\.md$/.test(item.refreshPath ?? "")) continue;
      const path = `.cadre/${item.refreshPath}`, body = readSafeArtifact(root, path), sources = quickRefreshSources(body);
      if (!sources.length) continue;
      if (!item.commit?.startsWith("op:refresh-")) throw new Error(`Uncommitted quick consolidation: ${path}`);
      const commit = resolveOperation(root, item.commit);
      if (readGitFileAtCommit(root, commit, path) !== body) throw new Error(`Modified quick consolidation: ${path}`);
      const receipt = receiptSchema.parse(JSON.parse(readGitFileAtCommit(root, commit, `.cadre/receipts/${item.commit.slice(3)}.json`)));
      if (receipt.kind !== "refresh" || !receipt.artifacts.some((file) => file.path === path && file.sha256 === contentHash(body))) throw new Error("Quick consolidation requires a refresh receipt");
      for (const source of sources) {
        if (!receipt.artifacts.some((file) => file.path === quickActivePath(source.quickId) && file.sha256 === null)
          || !receipt.artifacts.some((file) => file.path === quickArchivePath(source.quickId) && file.sha256 === source.sha256)) throw new Error("Quick consolidation receipt lacks its archive move");
        const key = `${source.quickId}:${source.sha256}`;
        if (considered.has(key)) throw new Error("Quick record was consolidated twice");
        considered.add(key);
      }
    }
    return considered;
  });
}
