import { observeQuick } from "../telemetry/runtime.js";
import { existsSync, lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod/v4";
import { contentHash, readSafeArtifact } from "./memory.js";
import { quickRecordSchema, type QuickRecord } from "./quick-record.js";
import { quickCheckpointSchema } from "./quick.js";
import { receiptSchema } from "./operation-receipts.js";
import { QUICK_ARCHIVE, quickActivePath, quickConsolidated, requireQuickDelivery } from "./quick-consolidation.js";
export { quickConsolidated, quickRefreshSources, requireQuickRefreshSources } from "./quick-consolidation.js";
import { CadreError } from "./errors.js";
import { inspectionValue, inspectOnce } from "./inspection.js";

function entries(root: string, directory: string): string[] {
  const path = join(root, ".cadre", directory);
  // Check parents even when the final directory is absent.
  let current = root;
  for (const part of [".cadre", ...directory.split("/")]) {
    current = join(current, part);
    try {if (lstatSync(current).isSymbolicLink()) throw new Error(`Unsafe quick history directory: ${directory}`);}
    catch (error) {if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error;}
  }
  return readdirSync(path).sort();
}
export interface QuickEntry {path: string; sha256: string; record: QuickRecord; status: "completed" | "commit_pending" | "invalid"; error?: string}
export function inspectQuickHistory(root: string): {records: QuickEntry[]; errors: string[]; unreadableRecords: number} {
  return inspectionValue(`quick-history:${root}`, () => {
    const records: QuickEntry[] = [], errors: string[] = [];
    let unreadableRecords = 0;
    let considered = new Set<string>(), consolidationError: unknown;
    try {considered = quickConsolidated(root);} catch (error) {consolidationError = error; errors.push(String(error));}
    try {
      for (const directory of ["quick", "archive/.quick"]) for (const file of entries(root, directory)) {
        const path = `.cadre/${directory}/${file}`;
        try {
          const body = readSafeArtifact(root, path), record = quickRecordSchema.parse(JSON.parse(body));
          if (file !== `${record.quickId}.json` || !record.operation || !record.product) throw new Error("Invalid canonical quick record identity or evidence");
          const entry: QuickEntry = {path, sha256: contentHash(body), record, status: "completed"};
          records.push(entry);
          try {
            requireQuickDelivery(root, body);
            if (records.filter((entry) => entry.record.quickId === record.quickId).length !== 1) throw new Error("Duplicate quick record in active and archived history");
            if (consolidationError) throw consolidationError;
            const consolidated = considered.has(`${record.quickId}:${entry.sha256}`);
            if (path.startsWith(`${QUICK_ARCHIVE}/`) !== consolidated) throw new Error("Quick record location disagrees with approved consolidation");
          } catch (error) {
            entry.status = error instanceof CadreError && error.code === "COMMIT_PENDING" ? "commit_pending" : "invalid";
            entry.error = String(error); throw error;
          }
        } catch (error) {if (!records.some((entry) => entry.path === path)) unreadableRecords++; errors.push(`${path}: ${String(error)}`);}
      }
      for (const file of entries(root, "receipts").filter((file) => file.startsWith("quick-") && file.endsWith(".json"))) {
        const receipt = receiptSchema.parse(JSON.parse(readSafeArtifact(root, `.cadre/receipts/${file}`)));
        if (receipt.kind !== "quick") continue;
        if (file !== `${receipt.operationId}.json` || receipt.artifacts.length !== 1) throw new Error("Invalid quick receipt identity");
        for (const artifact of receipt.artifacts) {
          if (typeof artifact.path !== "string" || !/^\.cadre\/quick\/[a-z0-9-]+\.json$/.test(artifact.path)) throw new Error("Invalid quick receipt record path");
          if (!records.some((entry) => quickActivePath(entry.record.quickId) === artifact.path)) errors.push(`Missing or invalid immutable quick record: ${artifact.path}`);
        }
      }
    } catch (error) {errors.push(String(error));}
    return {records, errors, unreadableRecords};
  });
}

export function quickSummary(entry: QuickEntry, considered = new Set<string>()) {
  return {quickId: entry.record.quickId, title: entry.record.title, path: entry.path, sha256: entry.sha256,
    affectedPaths: entry.record.affectedPaths, hasLessons: entry.record.lessons.length > 0, status: entry.status,
    consolidated: considered.has(`${entry.record.quickId}:${entry.sha256}`), operation: entry.record.operation};
}

export function quickStatus(root: string, limit: number, cursor?: string) {
  return inspectOnce(() => quickStatusSnapshot(root, limit, cursor));
}
function quickStatusSnapshot(root: string, limit: number, cursor?: string) {
  const history = inspectQuickHistory(root), errors = [...history.errors];
  let considered = new Set<string>();
  try {considered = quickConsolidated(root);} catch (error) {errors.push(String(error));}
  const records = history.records.filter((entry) => !entry.path.startsWith(`${QUICK_ARCHIVE}/`) || entry.status !== "completed").map((entry) => {
    const {path: _path, sha256: _hash, affectedPaths: _paths, ...summary} = quickSummary(entry, considered);
    return summary;
  });
  const staged: Array<{candidateId: string; status: "draft" | "ready" | "invalid" | "blocked" | "escalated"; intent: string | null; nextAction?: string; error?: string}> = [];
  try {
    for (const candidateId of entries(root, "stage").filter((name) => name.startsWith("quick-"))) {
      try {
        const checkpoint = quickCheckpointSchema.parse(JSON.parse(readSafeArtifact(root, `.cadre/stage/${candidateId}/checkpoint.json`)));
        if (candidateId !== `quick-${checkpoint.quickId}`) throw new Error("Quick checkpoint identity mismatch");
        if (history.records.some((entry) => entry.record.quickId === checkpoint.quickId && entry.status === "completed")) continue;
        const record = `.cadre/stage/${candidateId}/quick/${checkpoint.quickId}.json`;
        if (existsSync(join(root, record))) quickRecordSchema.parse(JSON.parse(readSafeArtifact(root, record)));
        staged.push({candidateId,
          status: checkpoint.progress && checkpoint.progress.status !== "working" ? checkpoint.progress.status : existsSync(join(root, record)) ? "ready" : "draft",
          intent: checkpoint.intent, ...(checkpoint.progress ? {nextAction: checkpoint.progress.nextAction} : {})});
      } catch (error) {staged.push({candidateId, status: "invalid", intent: null, error: String(error)});}
    }
  } catch (error) {errors.push(String(error));}
  const digest = contentHash(JSON.stringify({records, staged, sources: history.records.map((entry) => entry.sha256)}));
  const position = cursor ? z.strictObject({digest: z.string(), offset: z.number().int().nonnegative()}).parse(JSON.parse(Buffer.from(cursor, "base64url").toString())) : {digest, offset: 0};
  if (position.digest !== digest) throw new CadreError("STATUS_SNAPSHOT_CHANGED", "Quick listing changed; restart without quickCursor");
  const total = records.length + staged.length;
  if (position.offset > total) throw new Error("Invalid quick cursor");
  const offset = Math.min(total, position.offset + limit);
  const page = records.slice(position.offset, offset);
  const stagedPage = staged.slice(Math.max(0, position.offset - records.length), Math.max(0, offset - records.length));
  const counts = {completed: history.records.filter((entry) => entry.status === "completed").length,
      archived: history.records.filter((entry) => entry.path.startsWith(`${QUICK_ARCHIVE}/`) && entry.status === "completed").length,
      staged: staged.length,
      commit_pending: records.filter((record) => record.status === "commit_pending").length,
      unconsolidated: records.filter((record) => record.status === "completed" && !record.consolidated).length};
  observeQuick(counts, history.unreadableRecords + history.records.filter((entry) => entry.status === "invalid").length + staged.filter((entry) => entry.status === "invalid").length, errors.length);
  return {records: page, staged: stagedPage, errors, counts,
    listing: {total, returned: page.length + stagedPage.length, complete: offset === total,
      nextCursor: offset === total ? null : Buffer.from(JSON.stringify({digest, offset})).toString("base64url")}};
}
