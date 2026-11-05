import { quickArchivePath, quickActivePath } from "./quick-consolidation.js";
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import { candidateStateChanges } from "./candidate-state-changes.js";
import { quickIdSchema, quickRecordSchema, QUICK_CONTRACT } from "./quick-record.js";
import { captureQuickProduct, requireQuickProductFreshness } from "./quick-git.js";
import { captureRepositoryBasis, repositoryBasisSchema } from "./repository-basis.js";
import { contentHash, readSafeArtifact } from "./memory.js";
import { candidateStageRoot, listCandidatePaths, prepareCandidateStage, readCandidateFiles } from "./staging.js";
import { validateProject } from "./state.js";
import { requireQuiescentExecution } from "./execution-quiescence.js";
import { safeProjectRoot } from "./paths.js";
import type { ExecutionJournal } from "./execution.js";
import type { ReceiptFile } from "./operation-receipts.js";

export const quickCheckpointSchema = z.strictObject({schemaVersion: z.literal(1), quickId: quickIdSchema,
  intent: z.string().trim().min(1).max(4096), baseline: repositoryBasisSchema,
  progress: z.strictObject({status: z.enum(["working", "blocked", "escalated"]),
    summary: z.string().trim().min(1).max(4096), nextAction: z.string().trim().min(1).max(4096)}).optional()});
export const beginQuickInputSchema = z.strictObject({projectRoot: z.string().min(1), quickId: quickIdSchema,
  intent: z.string().trim().min(1).max(4096)});

export function requireQuickContract(root: string): void {
  const project = JSON.parse(readSafeArtifact(root, ".cadre/project.json"));
  if (project.templateSetVersion !== "v7" || !readSafeArtifact(root, ".cadre/workflow.md").includes(QUICK_CONTRACT)) {
    throw new Error("QUICK_REFRESH_REQUIRED: adopt the quick contract through an approved refresh before quick delivery");
  }
}

function quickInputs(root: string) {
  const sources = new Map<string, string>();
  const read = (path: string) => {const body = readSafeArtifact(root, path); sources.set(path, contentHash(body)); return body;};
  for (const file of ["project.json", "workflow.md", "product.md", "guidelines.md", "tech-stack.md", "patterns/index.md"]) read(`.cadre/${file}`);
  for (const dir of ["styleguides", "patterns"]) for (const file of readdirSync(join(root, ".cadre", dir))) {
    if (file.endsWith(".md")) read(`.cadre/${dir}/${file}`);
  }
  for (const entry of readdirSync(join(root, ".cadre/tracks"), {withFileTypes: true})) {
    if (entry.isSymbolicLink()) throw new Error("Unsafe quick track context");
    if (!entry.isDirectory()) continue;
    const state = JSON.parse(read(`.cadre/tracks/${entry.name}/state.json`));
    if (["completed", "archived"].includes(state.status)) continue;
    for (const file of ["spec.md", "plan.md"]) if (existsSync(join(root, ".cadre/tracks", entry.name, file))) read(`.cadre/tracks/${entry.name}/${file}`);
    const executionId = state.operation?.executionId ?? state.lastExecution?.executionId;
    if (executionId) {
      if (!/^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/.test(executionId)) throw new Error("Invalid quick execution context");
      const journal = JSON.parse(read(`.cadre/tracks/${entry.name}/executions/execution-${executionId}.json`)) as ExecutionJournal;
      requireQuiescentExecution(root, journal);
    }
  }
  return sources;
}

function requireHealthyQuick(root: string): void {
  requireQuickContract(root);
  const status = validateProject(root);
  if (status.errors.length || status.warnings.length || status.staleMemory.length) throw new Error(`Quick requires healthy project state: ${[...status.errors, ...status.warnings, ...status.staleMemory.map((item) => item.reason)].join("; ")}`);
  quickInputs(root);
}

/** Checkpoints are ignored intent, never delivery authority or canonical state. */
export function beginQuick(raw: z.input<typeof beginQuickInputSchema>) {
  const input = beginQuickInputSchema.parse(raw), root = safeProjectRoot(input.projectRoot);
  requireHealthyQuick(root);
  const candidateId = `quick-${input.quickId}`, stagePath = candidateStageRoot(root, candidateId);
  if (existsSync(join(root, quickActivePath(input.quickId))) || existsSync(join(root, quickArchivePath(input.quickId)))) throw new Error("Quick ID is already reserved; use a new linked record");
  const path = join(stagePath, "checkpoint.json");
  if (existsSync(path)) {
    const checkpoint = quickCheckpointSchema.parse(JSON.parse(readSafeArtifact(root, `.cadre/stage/${candidateId}/checkpoint.json`)));
    if (checkpoint.quickId !== input.quickId || checkpoint.intent !== input.intent) throw new Error("Resume the existing quick intent; do not replace its checkpoint");
    return {status: "draft" as const, candidateId, stagePath, baseCommit: checkpoint.baseline.head!};
  }
  if (existsSync(stagePath) && listCandidatePaths(root, candidateId).length) throw new Error("Quick stage has no starting checkpoint; preserve it for explicit repair");
  const baseline = captureRepositoryBasis(root, true);
  if (!baseline.head || baseline.index.some((entry) => entry.stage !== "0")) throw new Error("Quick requires a committed Git baseline without conflicts");
  prepareCandidateStage(root, candidateId);
  const checkpoint = quickCheckpointSchema.parse({schemaVersion: 1, quickId: input.quickId, intent: input.intent, baseline});
  mkdirSync(stagePath, {recursive: true});
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(checkpoint, null, 2) + "\n", {flag: "wx"});
  renameSync(temporary, path);
  return {status: "draft" as const, candidateId, stagePath, baseCommit: baseline.head};
}

export function previewQuick(input: {projectRoot: string; candidateId: string; files: string[]}) {
  const root = safeProjectRoot(input.projectRoot);
  requireHealthyQuick(root);
  const quickId = quickIdSchema.parse(input.candidateId.replace(/^quick-/, "")), recordPath = `quick/${quickId}.json`;
  if (input.candidateId !== `quick-${quickId}` || input.files.length !== 1 || input.files[0] !== recordPath) throw new Error("Quick may promote only its owned completion record");
  if (existsSync(join(root, ".cadre", recordPath)) || existsSync(join(root, quickArchivePath(quickId)))) throw new Error("Quick records are immutable; create a new linked record");
  if (JSON.stringify(listCandidatePaths(root, input.candidateId)) !== JSON.stringify(["checkpoint.json", recordPath])) throw new Error("Quick stage must contain only its checkpoint and completion record");
  const checkpoint = quickCheckpointSchema.parse(JSON.parse(readSafeArtifact(root, `.cadre/stage/${input.candidateId}/checkpoint.json`)));
  if (checkpoint.progress && checkpoint.progress.status !== "working") throw new Error("Quick is blocked or escalated; resolve its recorded next action before completion");
  const authored = JSON.parse(readCandidateFiles(root, input.candidateId, input.files)[0]!.content) as Record<string, unknown>;
  const record = quickRecordSchema.parse(authored);
  if (record.quickId !== quickId || checkpoint.quickId !== quickId || checkpoint.intent !== record.intent
    || record.operation !== null || record.product) throw new Error("Quick identity/intent must match its checkpoint; operation and product evidence are runtime-derived");
  const sources = quickInputs(root);
  for (const source of record.context) {
    if (contentHash(readSafeArtifact(root, source.path)) !== source.sha256) throw new Error(`Stale quick context: ${source.path}`);
    sources.set(source.path, source.sha256);
  }
  for (const related of record.relatedQuickIds) {
    const path = existsSync(join(root, quickActivePath(related))) ? quickActivePath(related) : quickArchivePath(related), body = readSafeArtifact(root, path);
    quickRecordSchema.parse(JSON.parse(body)); sources.set(path, contentHash(body));
  }
  const product = captureQuickProduct(root, checkpoint.baseline, record.affectedPaths);
  const operationId = `quick-${contentHash(JSON.stringify([root, record, product, [...sources].sort()])).slice(0, 32)}`;
  const context = [...sources].sort(([a], [b]) => a.localeCompare(b)).map(([path, sha256]) => ({path, sha256}));
  const derived = {...authored, ...record, context, operation: `op:${operationId}`, product};
  const files: ReceiptFile[] = [{path: `.cadre/${recordPath}`, content: JSON.stringify(derived, null, 2) + "\n"}];
  const manifest = files.map((file) => ({path: file.path, sha256: contentHash(file.content!)}));
  const recoveryInputs = [...sources].sort(([a], [b]) => a.localeCompare(b)).map(([path, sha256]) => ({path, sha256}));
  const digest = contentHash(JSON.stringify({operationId, product, manifest, recoveryInputs}));
  return {operationId, baseCommit: product.baseCommit, files, manifest, digest, recoveryInputs,
    stateChanges: [{path: `.cadre/${recordPath}`, changes: candidateStateChanges(authored, derived)}],
    validation: {valid: true as const, errors: [] as string[]}};
}

/** Runs on first apply and every interrupted promotion, including after stage loss. */
export function requireQuickFreshness(root: string, kind: string, files: ReceiptFile[], operationId: string, baseCommit: string | null): void {
  if (kind !== "quick") return;
  requireQuickContract(root);
  const sources = quickInputs(root);
  if (files.length !== 1 || files[0]?.content == null) throw new Error("Quick promotion requires one immutable record");
  const record = quickRecordSchema.parse(JSON.parse(files[0].content));
  if (files[0].path !== `.cadre/quick/${record.quickId}.json` || !record.operation || !record.product) throw new Error("Invalid quick promotion evidence");
  if (record.operation !== `op:${operationId}` || record.product.baseCommit !== baseCommit) throw new Error("Quick operation identity mismatch");
  const retained = new Map(record.context.map((source) => [source.path, source.sha256]));
  for (const [path, sha256] of sources) if (retained.get(path) !== sha256) throw new Error(`Quick context changed after approval: ${path}`);
  requireQuickProductFreshness(root, record.product);
}
