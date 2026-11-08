import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { dependencySources } from "../../src/domain/dependency-context.js";
import { prepareCandidateStage } from "../../src/domain/staging.js";
import { previewCandidateApply, applyCandidate, type CandidateApplyInput } from "../../src/domain/candidate-apply.js";
import { promoteOperation } from "../../src/domain/operation-receipts.js";
import { ProposalTokenStore } from "../../src/mcp/proposals.js";
import type { ExecutionApprovalMode } from "../../src/domain/approval-policy.js";
import { fixture, finishCurrent, commit, read, write, git, json, originalPlan } from "./revision-fixture.js";

export type Call = Awaited<ReturnType<typeof fixture>>["call"];
export type Boundary = "normal" | "intent" | "partial" | "receipt";
export const boundaries: Boundary[] = ["normal", "intent", "partial", "receipt"];
export const clients = ["codex", "claude-code", "zed"] as const;
export type Cleanup = {after(fn: () => void | Promise<void>): void};

export async function packagedClient(t: Cleanup, name: string) {
  const client = new Client({name, version: "maintenance-matrix"});
  const transport = new StdioClientTransport({command: process.execPath,
    args: [resolve("dist/cadre-mcp.mjs")], env: Object.fromEntries(Object.entries({...process.env, CADRE_TELEMETRY: "0"}).filter((entry): entry is [string, string] => entry[1] !== undefined))});
  await client.connect(transport);
  t.after(() => client.close());
  const catalog = await client.listTools();
  assert.equal(catalog.tools.length, 21);
  assert.equal(catalog.tools.some((tool) => tool.name === "archive_batch_candidate"), false);
  const call: Call = async (name, args) => {
    const result = await client.callTool({name, arguments: args});
    assert.equal(result.isError, undefined, JSON.stringify(result));
    const body = result.structuredContent ?? JSON.parse((result.content as Array<{type: string; text?: string}>)
      .find((item) => item.type === "text")!.text!);
    return body as Record<string, any>;
  };
  return {call, client};
}

export function addMaintenanceTrack(root: string, id: string, dependencies: string[]) {
  const context = dependencySources(root, dependencies);
  const input: CandidateApplyInput = {projectRoot: root, workflow: "track", candidateId: `track-${id}`,
    files: ["spec.md", "plan.md", "learning.md", "dependency-context.json", "state.json"]};
  const files = {
    "spec.md": read(root, ".cadre/tracks/sample/spec.md"), "plan.md": originalPlan,
    "learning.md": '# Learning\n<!-- cadre:pattern-seed:start -->\n## Pattern Seed\n<!-- cadre:memory:start -->\n{"schemaVersion":1,"specRevision":1,"planRevision":1,"patterns":[]}\n<!-- cadre:memory:end -->\nNo applicable patterns.\n<!-- cadre:pattern-seed:end -->\n',
    "dependency-context.json": json({schemaVersion: 1, specRevision: 1, planRevision: 1, dependencies, ...context,
      constraints: context.sources.length ? [{id: "inherited-contract", text: "Preserve verified dependency behavior", sources: context.sources.map((source) => source.path)}] : []}),
    "state.json": json({schemaVersion: 2, trackId: id, title: id, type: "feature", status: "planned", checkpoint: "ready", revision: 1,
      dependencies, commits: {}, artifactProgress: [], operation: null, lastExecution: null, reviewCycles: [], history: []})
  };
  prepareCandidateStage(root, input.candidateId, input.files);
  for (const [path, body] of Object.entries(files)) write(root, `.cadre/stage/${input.candidateId}/${path}`, body);
  commit(root, applyCandidate(input, previewCandidateApply(input).digest));
}

export async function completeMaintenanceTrack(root: string, call: Call, id: string, approvalMode: ExecutionApprovalMode, requestedMode: "sequential" | "parallel") {
  write(root, "second.txt", `${id}: starting baseline\n`); git(root, "add", "second.txt"); git(root, "commit", "-m", `fixture: ${id} baseline`);
  await call("execution_start", {projectRoot: root, trackId: id, approvalMode, requestedMode});
  let state = JSON.parse(read(root, `.cadre/tracks/${id}/state.json`));
  await finishCurrent(root, call, state.operation.executionId, id);
  state = JSON.parse(read(root, `.cadre/tracks/${id}/state.json`));
  if (state.autonomousReview) write(root, `.cadre/tracks/${id}/state.json`, json({...state, autonomousReview: {...state.autonomousReview,
    checkpoint: "awaiting_approval", reviewedExecutionId: state.lastExecution.executionId, reviewedHead: state.lastExecution.headCommit}}));
  const proposal = await call("review_complete", {request: {mode: "prepare", projectRoot: root, trackId: id, approval: "Synthetic fixture approval after verified clean review"}});
  commit(root, (await call("review_complete", {request: {mode: "apply", proposalToken: proposal.proposalToken}})).receipt);
}

export async function maintenanceSeed(t: Cleanup, name: string, mode: ExecutionApprovalMode, schedule: "sequential" | "parallel") {
  const {root} = await fixture(t, name), {call} = await packagedClient(t, name);
  write(root, "arithmetic.mjs", "export const add = (a, b) => a + b;\n");
  write(root, "arithmetic.test.mjs", 'import assert from "node:assert/strict";\nimport { add } from "./arithmetic.mjs";\nassert.equal(add(2, 3), 5);\nassert.equal(add(-2, 2), 0);\n');
  write(root, "obsolete.txt", "Obsolete fixture output\n");
  write(root, "run.sh", "#!/bin/sh\necho fixture\n");
  git(root, "add", "."); git(root, "commit", "-m", "fixture: working arithmetic app");
  await completeMaintenanceTrack(root, call, "sample", mode, schedule);
  addMaintenanceTrack(root, "other", ["sample"]);
  await completeMaintenanceTrack(root, call, "other", mode, schedule);
  addMaintenanceTrack(root, "dependent", ["sample", "other"]);
  return {root, call};
}

export function cloneMaintenanceSeed(root: string) {
  const copy = mkdtempSync(join(tmpdir(), "cadre-maintenance-"));
  cpSync(root, copy, {recursive: true});
  return copy;
}

/** Only the crash injection calls domain code. Prepare/apply/resume/reconcile use packaged stdio MCP. */
export async function applyAtBoundary(root: string, call: Call, proposal: Record<string, any>, boundary: Boundary) {
  const approved = new ProposalTokenStore().resolve<CandidateApplyInput>("candidate_apply", proposal.proposalToken);
  if (boundary === "normal") return call("candidate_apply", {request: {mode: "apply", proposalToken: proposal.proposalToken}});
  const preview = previewCandidateApply(approved.input);
  const partialPath = approved.input.workflow === "quick" ? preview.files[0]!.path
    : preview.files.find((file) => file.content === null)?.path ?? preview.files[0]!.path;
  const stop = boundary === "intent" ? `.cadre/stage/operations/${preview.operationId}.json`
    : boundary === "receipt" ? `.cadre/receipts/${preview.operationId}.json` : partialPath;
  assert.throws(() => promoteOperation(root, {operationId: preview.operationId, kind: approved.input.workflow, approvalDigest: preview.digest,
    baseCommit: preview.baseCommit, inputs: preview.recoveryInputs}, preview.files, (path) => {if (path === stop) throw Error("matrix interruption");}), /matrix interruption/);
  rmSync(join(root, ".cadre/stage", approved.input.candidateId), {recursive: true});
  return call("candidate_apply", {request: {mode: "resume", projectRoot: root, operationId: preview.operationId, approvalDigest: preview.digest}});
}

export async function commitViaMcp(root: string, call: Call, result: Record<string, any>, paths: string[] = []) {
  git(root, "add", "--", ".cadre", ...paths);
  git(root, "commit", "-m", `fixture: ${result.operationId}`, "-m", result.trailers.join("\n"));
  await call("candidate_apply", {request: {mode: "reconcile", projectRoot: root, operationId: result.operationId}});
  assert.equal(git(root, "log", "--format=%H", `--grep=Cadre-Operation: ${result.operationId}`).split("\n").length, 1);
  assert.equal(readdirSync(join(root, ".cadre/stage/operations")).length, 0);
}

export function quickCandidate(root: string, paths: string[]) {
  const input: CandidateApplyInput = {projectRoot: root, candidateId: "quick-small", workflow: "quick", files: ["quick/small.json"]};
  write(root, ".cadre/stage/quick-small/quick/small.json", json({schemaVersion: 1, quickId: "small", title: "Bounded fixture change",
    intent: "Make the bounded fixture change", outcome: "Verified fixture change", acceptance: ["Existing arithmetic checks remain correct"],
    affectedPaths: paths, verification: [{check: "node arithmetic.test.mjs", result: "passed", evidence: "Both arithmetic assertions passed"}],
    reviewed: true, context: [], lessons: ["Preserve verified historical evidence"], relatedQuickIds: [], operation: null}));
  return input;
}
