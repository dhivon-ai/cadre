import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { previewCandidateApply, applyCandidate, type CandidateApplyInput } from "../src/domain/candidate-apply.js";
import { promoteOperation, resumeOperation } from "../src/domain/operation-receipts.js";
import { prepareCandidateStage } from "../src/domain/staging.js";
import { directorySnapshot } from "../src/domain/archive-artifacts.js";
import { dependencySources } from "../src/domain/dependency-context.js";
import { contentHash } from "../src/domain/memory.js";
import { validateProject } from "../src/domain/state.js";
import { ProposalTokenStore } from "../src/mcp/proposals.js";
import { REFRESH_ARCHIVE_CONTRACT } from "../src/domain/refresh-archive.js";
import { beginQuick } from "../src/domain/quick.js";
import { fixture, finishCurrent, commit, stage, read, write, git, json } from "./helpers/revision-fixture.js";

type Fixture = Awaited<ReturnType<typeof fixture>>;
async function complete(f: Fixture, id = "sample") {
  const {root, call} = f;
  if (id !== "sample") {write(root, "second.txt", "Dependent baseline\n"); git(root, "add", "second.txt"); git(root, "commit", "-m", "fixture: dependent baseline");}
  await call("execution_start", {projectRoot: root, trackId: id, approvalMode: "track", requestedMode: "sequential"});
  const state = JSON.parse(read(root, `.cadre/tracks/${id}/state.json`));
  await finishCurrent(root, call, state.operation.executionId, id);
  const review = await call("review_complete", {request: {mode: "prepare", projectRoot: root, trackId: id, approval: "Explicit fixture approval of clean review"}});
  commit(root, (await call("review_complete", {request: {mode: "apply", proposalToken: review.proposalToken}})).receipt);
}
function previewRefresh(input: CandidateApplyInput) {const result = previewCandidateApply(input); assert.ok("selectedTracks" in result); return result;}
function refresh(root: string, extra: Record<string, string> = {}): CandidateApplyInput {
  return stage(root, "refresh", {"project.json": read(root, ".cadre/project.json"),
    "refreshes/refresh-maintenance.md": "# Maintenance\nAssessed completed work; no new reusable lessons unless described below.\n", ...extra});
}
function addDependent(root: string, id = "dependent") {
  const state = JSON.parse(read(root, ".cadre/tracks/sample/state.json"));
  const context = dependencySources(root, ["sample"]);
  const files: Record<string, string> = {
    "spec.md": read(root, ".cadre/tracks/sample/spec.md"),
    "plan.md": read(root, ".cadre/tracks/sample/plan.md").replaceAll(/\[x\]/g, "[ ]").replaceAll(/ <!-- commit: [^>]+ -->/g, "").replaceAll(/- Phase completion commit: .+/g, "- Phase completion commit: pending"),
    "learning.md": read(root, ".cadre/tracks/sample/learning.md"),
    "state.json": json({...state, trackId: id, title: id, status: "planned", checkpoint: "ready", commits: {}, dependencies: ["sample"], lastExecution: null, reviewCycles: [], history: []}),
    "dependency-context.json": json({schemaVersion: 1, specRevision: 1, planRevision: 1, dependencies: ["sample"], ...context,
      constraints: [{id: "source-contract", text: "Preserve the completed source behavior", sources: context.sources.map((source) => source.path)}]})
  };
  const input = {projectRoot: root, candidateId: `track-${id}`, workflow: "track" as const, files: Object.keys(files)};
  prepareCandidateStage(root, input.candidateId, input.files);
  for (const [path, body] of Object.entries(files)) write(root, `.cadre/stage/${input.candidateId}/${path}`, body);
  commit(root, applyCandidate(input, previewCandidateApply(input).digest));
}

test("Refresh defaults, explicit empty selection, and invalid selections preserve review authority", async (t) => {
  const f = await fixture(t), {root} = f;
  assert.deepEqual(previewRefresh(refresh(root)).selectedTracks, []);
  assert.throws(() => previewCandidateApply({...refresh(root), selectedTracks: ["sample"]}), /not an eligible/);
  await complete(f);
  const input = refresh(root), before = read(root, ".cadre/tracks/sample/state.json");
  assert.deepEqual(previewRefresh({...input, selectedTracks: []}).selectedTracks, []);
  for (const selectedTracks of [["missing"], ["../sample"]]) assert.throws(() => previewCandidateApply({...input, selectedTracks}));
  assert.throws(() => previewCandidateApply({...input, workflow: "revise", selectedTracks: []}), /requires the refresh/);
  assert.equal(read(root, ".cadre/tracks/sample/state.json"), before);
  assert.deepEqual(previewRefresh({...input, selectedTracks: ["sample", "sample"]}).selectedTracks, ["sample"]);
  commit(root, applyCandidate({...input, selectedTracks: []}, previewCandidateApply({...input, selectedTracks: []}).digest));
  assert.equal(JSON.parse(read(root, ".cadre/tracks/sample/state.json")).status, "completed");
});

test("Refresh archives in dependency order, preserves historical bytes and freezes explicit MCP selection", async (t) => {
  const f = await fixture(t), {root, call} = f;
  await complete(f); addDependent(root); await complete(f, "dependent");
  const input = refresh(root), snapshot = directorySnapshot(join(root, ".cadre/tracks/sample"));
  assert.deepEqual(previewRefresh(input).selectedTracks, ["sample", "dependent"]);
  assert.deepEqual(previewRefresh({...input, selectedTracks: ["dependent", "sample"]}).selectedTracks, ["dependent", "sample"]);
  const proposal = await call("candidate_apply", {request: {mode: "prepare", ...input, selectedTracks: ["sample"]}});
  assert.deepEqual(proposal.selectedTracks, ["sample"]);
  assert.deepEqual(new ProposalTokenStore().resolve<CandidateApplyInput>("candidate_apply", proposal.proposalToken).input.selectedTracks, ["sample"]);
  assert.equal(proposal.moves[0].sourcePath, ".cadre/tracks/sample");
  const result = await call("candidate_apply", {request: {mode: "apply", proposalToken: proposal.proposalToken}});
  commit(root, {operationId: result.operationId, trailers: result.trailers});
  for (const file of snapshot.filter((file) => file.path !== "state.json")) assert.equal(read(root, `.cadre/archive/sample/${file.path}`), file.content);
  assert.equal(JSON.parse(read(root, ".cadre/tracks/dependent/state.json")).status, "completed");
  assert.equal(existsSync(join(root, ".cadre/tracks/sample")), false);
  const history = JSON.parse(read(root, ".cadre/project.json")).history.at(-1);
  assert.equal(history.action, "refresh"); assert.deepEqual(history.selectedTracks, ["sample"]);
  assert.equal(JSON.parse(read(root, ".cadre/archive/sample/state.json")).history.at(-1).commit, history.commit);
  assert.deepEqual(validateProject(root).errors, []);
});

test("Refresh combines active dependency relocation, reassessed patterns, quick outcomes and context", async (t) => {
  const f = await fixture(t), {root} = f;
  await complete(f); addDependent(root);
  beginQuick({projectRoot: root, quickId: "small", intent: "Add a small independent correction"});
  write(root, "small.txt", "corrected\n");
  const quick = {projectRoot: root, candidateId: "quick-small", workflow: "quick" as const, files: ["quick/small.json"]};
  write(root, ".cadre/stage/quick-small/quick/small.json", json({schemaVersion: 1, quickId: "small", title: "Small correction", intent: "Add a small independent correction", outcome: "Corrected",
    acceptance: ["Expected output"], affectedPaths: ["small.txt"], verification: [{check: "Inspect output", result: "passed", evidence: "Corrected output"}], reviewed: true,
    context: [], lessons: [], relatedQuickIds: [], operation: null}));
  const delivered = applyCandidate(quick, previewCandidateApply(quick).digest);
  git(root, "add", "small.txt"); commit(root, delivered);
  const quickBody = read(root, ".cadre/quick/small.json"), pattern = "# Preserve original evidence\nUse immutable receipts when moving completed work.\n";
  const seed = read(root, ".cadre/tracks/dependent/learning.md").replace('"patterns":[]', `"patterns":[{"path":"patterns/evidence.md","sha256":"${contentHash(pattern)}"}]`)
    .replace("No applicable patterns.", "Follow patterns/evidence.md to retain inherited review evidence.");
  const input = refresh(root, {"guidelines.md": read(root, ".cadre/guidelines.md") + "\nPreserve reviewed evidence.\n",
    "patterns/evidence.md": pattern, "patterns/index.md": "# Patterns\n- [Evidence](evidence.md): preserve history.\n",
    "tracks/dependent/learning.md": seed,
    "refreshes/refresh-maintenance.md": `# Refresh\nConsolidate evidence preservation.\n<!-- cadre:quick-sources:start -->\n${JSON.stringify([{quickId: "small", sha256: contentHash(quickBody), disposition: "no-change", reason: "No reusable lesson beyond existing guidance"}])}\n<!-- cadre:quick-sources:end -->\n`});
  const preview = previewCandidateApply(input); commit(root, applyCandidate(input, preview.digest));
  const dependency = JSON.parse(read(root, ".cadre/tracks/dependent/dependency-context.json"));
  assert.ok(dependency.sources.every((source: {path: string}) => source.path.startsWith(".cadre/archive/sample/")));
  assert.ok(dependency.constraints[0].sources.every((path: string) => path.startsWith(".cadre/archive/sample/")));
  assert.equal(read(root, ".cadre/archive/.quick/small.json"), quickBody);
  assert.equal(read(root, ".cadre/tracks/dependent/learning.md"), seed);
  assert.deepEqual(validateProject(root).errors, []);
});

for (const client of ["codex", "claude-code", "zed"]) for (const boundary of ["intent", "partial", "receipt"]) {
  test(`combined Refresh recovery retains one approval and commit: ${client}/${boundary}`, async (t) => {
    const f = await fixture(t, client), {root, call} = f; await complete(f);
    const input = refresh(root), proposal = await call("candidate_apply", {request: {mode: "prepare", ...input}});
    const approved = new ProposalTokenStore().resolve<CandidateApplyInput>("candidate_apply", proposal.proposalToken), preview = previewCandidateApply(approved.input);
    const crashPath = boundary === "intent" ? `.cadre/stage/operations/${preview.operationId}.json`
      : boundary === "receipt" ? `.cadre/receipts/${preview.operationId}.json` : ".cadre/tracks/sample/spec.md";
    assert.throws(() => promoteOperation(root, {operationId: preview.operationId, kind: "refresh", approvalDigest: preview.digest,
      baseCommit: preview.baseCommit, inputs: preview.recoveryInputs}, preview.files, (path) => {if (path === crashPath) throw Error("fixture interruption");}), /fixture interruption/);
    rmSync(join(root, ".cadre/stage", input.candidateId), {recursive: true});
    if (boundary !== "receipt") {
      write(root, ".cadre/tracks/sample/unapproved.md", "Concurrent new evidence\n");
      assert.throws(() => resumeOperation(root, preview.operationId, preview.digest), /inventory changed/);
      unlinkSync(join(root, ".cadre/tracks/sample/unapproved.md"));
    }
    const resumed = await call("candidate_apply", {request: {mode: "resume", projectRoot: root, operationId: preview.operationId, approvalDigest: preview.digest}});
    commit(root, {operationId: resumed.operationId, trailers: resumed.trailers});
    assert.equal((await call("candidate_apply", {request: {mode: "apply", proposalToken: proposal.proposalToken}})).changedCount, 0);
    assert.equal(git(root, "log", "--format=%H", `--grep=Cadre-Operation: ${preview.operationId}`).split("\n").length, 1);
    assert.deepEqual(validateProject(root).errors, []); assert.equal(git(root, "status", "--porcelain"), "");
  });
}

test("Refresh rejects archive drift, forged moves, destination collisions and unsafe source paths", async (t) => {
  const f = await fixture(t), {root} = f; await complete(f);
  const input = refresh(root), preview = previewCandidateApply(input);
  write(root, ".cadre/tracks/sample/extra.md", "Unapproved\n");
  assert.throws(() => applyCandidate(input, preview.digest), /changed after approval/); unlinkSync(join(root, ".cadre/tracks/sample/extra.md"));
  symlinkSync(join(root, ".cadre/product.md"), join(root, ".cadre/tracks/sample/link.md"));
  assert.throws(() => previewCandidateApply(input), /symbolic link/); unlinkSync(join(root, ".cadre/tracks/sample/link.md"));
  write(root, ".cadre/archive/sample/existing.md", "Collision\n");
  assert.throws(() => previewCandidateApply(input), /archive target|missing|state.json/); rmSync(join(root, ".cadre/archive/sample"), {recursive: true});
  writeFileSync(join(root, ".cadre/tracks/sample/binary.dat"), Buffer.from([0xff, 0xfe]));
  assert.throws(() => previewCandidateApply(input), /non-UTF-8/); unlinkSync(join(root, ".cadre/tracks/sample/binary.dat"));
  const path = ".cadre/archive/sample/spec.md";
  const forged = preview.files.map((file) => file.path === path ? {...file, content: "Forged history"} : file);
  assert.throws(() => promoteOperation(root, {operationId: preview.operationId, kind: "refresh", approvalDigest: preview.digest, baseCommit: preview.baseCommit}, forged), /historical archive bytes/);
  assert.equal(existsSync(join(root, ".cadre/stage/operations", `${preview.operationId}.json`)), false);
});

test("Older workflow contracts require explicit adoption in the same refresh", async (t) => {
  const f = await fixture(t), {root} = f; await complete(f);
  const workflow = read(root, ".cadre/workflow.md");
  write(root, ".cadre/workflow.md", workflow.replace(REFRESH_ARCHIVE_CONTRACT, ""));
  git(root, "add", ".cadre/workflow.md"); git(root, "commit", "-m", "fixture: old workflow contract");
  assert.throws(() => previewCandidateApply(refresh(root)), /REFRESH_ARCHIVE_ADOPTION_REQUIRED/);
  const input = refresh(root, {"workflow.md": workflow}); commit(root, applyCandidate(input, previewCandidateApply(input).digest));
  assert.deepEqual(validateProject(root).errors, []);
});
