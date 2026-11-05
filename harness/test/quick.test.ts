import { quickArchivePath, quickActivePath, quickRefreshSources, requireQuickRefreshSources } from "../src/domain/quick-consolidation.js";
import { searchQuickRecords, quickSearchSchema } from "../src/domain/quick-search.js";
import { renderTracksWithState } from "../src/domain/tracks-index.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { chmodSync, existsSync, mkdtempSync, readdirSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createCadreServer } from "../src/mcp/server.js";
import { previewProjectInitCandidate, applyProjectInitCandidate } from "../src/domain/init.js";
import { prepareCandidateStage } from "../src/domain/staging.js";
import { previewCandidateApply, applyCandidate } from "../src/domain/candidate-apply.js";
import { promoteOperation, reconcileOperation, resumeOperation } from "../src/domain/operation-receipts.js";
import { beginQuick } from "../src/domain/quick.js";
import { inspectQuickHistory, quickStatus } from "../src/domain/quick-history.js";
import { readContext } from "../src/domain/context.js";
import { validateProject } from "../src/domain/state.js";
import { contentHash } from "../src/domain/memory.js";
import { getTemplate } from "../src/domain/templates.js";
import { git, write, read, json, commit, stage, fixture as trackFixture } from "./helpers/revision-fixture.js";

function fixture(t: {after(fn: () => void): void}) {
  const root = mkdtempSync(join(tmpdir(), "cadre-quick-"));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  git(root, "init", "-b", "main"); git(root, "config", "user.name", "Quick Fixture"); git(root, "config", "user.email", "quick@example.test"); git(root, "config", "commit.gpgsign", "false");
  write(root, "app.txt", "before\n"); write(root, "unrelated.txt", "original\n");
  git(root, "add", "."); git(root, "commit", "-m", "initial");
  const stagedFiles = ["product.md", "guidelines.md", "tech-stack.md"];
  prepareCandidateStage(root, "create", stagedFiles);
  for (const file of stagedFiles) write(root, `.cadre/stage/create/${file}`, `# ${file}\nSmall test project.\n`);
  const input = {projectRoot: root, projectName: "Quick", context: "brownfield" as const, gitDisposition: "existing" as const,
    baseCommit: git(root, "rev-parse", "HEAD"), approvedAt: "2026-11-05T00:00:00.000Z", stagedFiles, styleguideIds: ["project/styleguides/general"]};
  commit(root, applyProjectInitCandidate(input, previewProjectInitCandidate(input).digest).receipt!);
  return root;
}
function candidate(root: string, id = "small-fix", paths = ["app.txt"]) {
  const input = {projectRoot: root, candidateId: `quick-${id}`, workflow: "quick" as const, files: [`quick/${id}.json`]};
  const record = {schemaVersion: 1, quickId: id, title: "Small fix", intent: "Fix one behavior", outcome: "Behavior fixed",
    acceptance: ["Expected output"], affectedPaths: paths,
    verification: [{check: "Read expected output", result: "passed", evidence: "Expected output observed"}], reviewed: true,
    context: [], lessons: [], relatedQuickIds: [], operation: null};
  write(root, `.cadre/stage/${input.candidateId}/${input.files[0]}`, json(record));
  return input;
}
function begin(root: string, id = "small-fix") { return beginQuick({projectRoot: root, quickId: id, intent: "Fix one behavior"}); }
function finish(root: string, result: {operationId: string; trailers: string[]}, paths = ["app.txt"]) {
  git(root, "add", "--", ...paths, `.cadre/quick`, `.cadre/receipts/${result.operationId}.json`);
  git(root, "commit", "--only", "-m", "fix: small behavior", "-m", result.trailers.join("\n"), "--", ...paths, ".cadre/quick", `.cadre/receipts/${result.operationId}.json`);
  return reconcileOperation(root, result.operationId);
}

test("quick delivers one combined commit without tracks, preserves unrelated edits, and replays", (t) => {
  const root = fixture(t);
  write(root, "unrelated.txt", "user work\n"); git(root, "add", "unrelated.txt");
  write(root, "scratch.txt", "untracked user work\n");
  begin(root); const before = git(root, "rev-list", "--count", "HEAD");
  write(root, "app.txt", "after\n");
  const input = candidate(root), preview = previewCandidateApply(input);
  assert.deepEqual(preview.manifest.map((file) => file.path), [".cadre/quick/small-fix.json"]);
  assert.equal(quickStatus(root, 50).staged[0]?.status, "ready");
  const result = applyCandidate(input, preview.digest);
  assert.equal(quickStatus(root, 50).records[0]?.status, "commit_pending");
  // A focused commit must leave even pre-staged unrelated edits outside delivery.
  const sha = finish(root, result);
  assert.equal(Number(git(root, "rev-list", "--count", "HEAD")), Number(before) + 1);
  assert.equal(read(root, "unrelated.txt"), "user work\n");
  assert.equal(read(root, "scratch.txt"), "untracked user work\n");
  assert.deepEqual(readdirSync(join(root, ".cadre/tracks")), [".gitkeep"]);
  assert.equal(git(root, "diff", "--cached", "--name-only"), "unrelated.txt");
  assert.deepEqual(validateProject(root).errors, []);
  assert.equal(quickStatus(root, 50).counts.unconsolidated, 1);
  assert.equal(applyCandidate(input, preview.digest).commit, sha);
  assert.equal(reconcileOperation(root, result.operationId), sha);
  assert.throws(() => begin(root), /already reserved/);
});

test("quick rejects scope omissions, pre-existing overlap, failed verification and unsafe paths", (t) => {
  const root = fixture(t); write(root, "unrelated.txt", "user work\n"); begin(root);
  write(root, "app.txt", "after\n"); let input = candidate(root);
  write(root, "forgotten.txt", "new\n"); assert.throws(() => previewCandidateApply(input), /exactly the new product/);
  unlinkSync(join(root, "forgotten.txt"));
  input = candidate(root, "small-fix", ["app.txt", "unrelated.txt"]); assert.throws(() => previewCandidateApply(input), /pre-existing/);
  input = candidate(root); const path = `.cadre/stage/${input.candidateId}/${input.files[0]}`;
  const record = JSON.parse(read(root, path)); record.verification[0].result = "failed"; write(root, path, json(record));
  assert.throws(() => previewCandidateApply(input), /passed/);
  for (const unsafe of ["../escape", ".git/config", ".cadre/product.md", "/tmp/escape", "a\\b"]) {
    candidate(root, "small-fix", [unsafe]); assert.throws(() => previewCandidateApply(input));
  }
  candidate(root); unlinkSync(join(root, "app.txt")); symlinkSync("unrelated.txt", join(root, "app.txt"));
  assert.throws(() => previewCandidateApply(input), /symlink/);
});

test("quick rejects product, verification-input and context drift after approval", (t) => {
  const root = fixture(t); begin(root); write(root, "app.txt", "after\n");
  const input = candidate(root), preview = previewCandidateApply(input);
  write(root, "app.txt", "changed after review\n"); assert.throws(() => applyCandidate(input, preview.digest), /changed after approval/);
  write(root, "app.txt", "after\n"); write(root, "unrelated.txt", "new input\n"); assert.throws(() => applyCandidate(input, preview.digest), /exactly the new product/);
  write(root, "unrelated.txt", "original\n"); write(root, ".cadre/guidelines.md", "# Changed guidance\n");
  assert.throws(() => applyCandidate(input, preview.digest), /changed after approval/);
});

test("unfinished quick resumes its baseline and surfaces blockers or escalation without completion", (t) => {
  const root = fixture(t), started = begin(root), path = ".cadre/stage/quick-small-fix/checkpoint.json";
  const checkpoint = JSON.parse(read(root, path));
  write(root, "app.txt", "partial implementation\n");
  assert.equal(begin(root).baseCommit, started.baseCommit);
  assert.deepEqual(JSON.parse(read(root, path)).baseline, checkpoint.baseline);
  for (const status of ["blocked", "escalated"]) {
    write(root, path, json({...checkpoint, progress: {status, summary: "Wider impact discovered", nextAction: "Agree on coordinated delivery"}}));
    const input = candidate(root);
    assert.equal(quickStatus(root, 50).staged[0]?.status, status);
    assert.throws(() => previewCandidateApply(input), /blocked or escalated/);
    assert.equal(existsSync(join(root, ".cadre/quick/small-fix.json")), false);
  }
});

test("completed quick records cannot be edited, deleted or bypassed by a new proposal", (t) => {
  const root = fixture(t); begin(root); write(root, "app.txt", "after\n");
  const input = candidate(root); finish(root, applyCandidate(input, previewCandidateApply(input).digest));
  const path = ".cadre/quick/small-fix.json", original = read(root, path);
  const record = JSON.parse(original); record.outcome = "Invented outcome"; write(root, path, json(record));
  assert.match(validateProject(root).errors.join("\n"), /Immutable quick record was modified/);
  assert.throws(() => begin(root, "next-fix"), /healthy project/);
  unlinkSync(join(root, path));
  assert.match(validateProject(root).errors.join("\n"), /Missing or invalid immutable quick record/);
  write(root, path, original); assert.deepEqual(validateProject(root).errors, []);
});

for (const boundary of ["journal", "record", "receipt"]) test(`quick resumes after ${boundary} without stage or duplicate delivery`, (t) => {
  const root = fixture(t); begin(root); write(root, "app.txt", "after\n");
  const input = candidate(root), p = previewCandidateApply(input);
  const target = boundary === "journal" ? `.cadre/stage/operations/${p.operationId}.json` : boundary === "record" ? p.files[0]!.path : `.cadre/receipts/${p.operationId}.json`;
  assert.throws(() => promoteOperation(root, {operationId: p.operationId, kind: "quick", approvalDigest: p.digest, baseCommit: p.baseCommit, inputs: p.recoveryInputs}, p.files,
    (path) => {if (path === target) throw new Error("interrupted");}), /interrupted/);
  rmSync(join(root, ".cadre/stage/quick-small-fix"), {recursive: true});
  write(root, "app.txt", "drift\n"); assert.throws(() => resumeOperation(root, p.operationId, p.digest), /changed after approval/);
  assert.ok(existsSync(join(root, `.cadre/stage/operations/${p.operationId}.json`)));
  write(root, "app.txt", "after\n"); finish(root, resumeOperation(root, p.operationId, p.digest));
  assert.deepEqual(validateProject(root).errors, []);
});

test("quick commit evidence rejects changed product and unrelated committed files", (t) => {
  for (const extra of [false, true]) {
    const root = fixture(t); begin(root); write(root, "app.txt", "after\n");
    const input = candidate(root), p = previewCandidateApply(input), result = applyCandidate(input, p.digest);
    if (extra) { write(root, "extra.txt", "unapproved\n"); git(root, "add", "extra.txt"); }
    else write(root, "app.txt", "wrong bytes\n");
    assert.throws(() => finish(root, result, extra ? ["app.txt", "extra.txt"] : ["app.txt"]), extra ? /unapproved changes/ : /differs from approval/);
    assert.equal(quickStatus(root, 50).records[0]?.status, "invalid");
  }
});

test("quick supports additions, deletions, binary content and executable modes", (t) => {
  const root = fixture(t); begin(root);
  unlinkSync(join(root, "app.txt")); write(root, "run.sh", "#!/bin/sh\necho done\n"); chmodSync(join(root, "run.sh"), 0o755);
  write(root, "binary.bin", "\0binary\u00ff\n");
  const paths = ["app.txt", "run.sh", "binary.bin"], input = candidate(root, "small-fix", paths), p = previewCandidateApply(input);
  finish(root, applyCandidate(input, p.digest), paths);
  assert.equal(inspectQuickHistory(root).records[0]?.status, "completed");
});

test("quick project context paginates, retrieves selected outcomes and consolidates through refresh", (t) => {
  const root = fixture(t);
  const defaultBefore = readContext({projectRoot: root, scope: "project"});
  for (let i = 0; i < 3; i++) {
    begin(root, `change-${i}`); write(root, "app.txt", `after ${i}\n`);
    const input = candidate(root, `change-${i}`), path = `.cadre/stage/${input.candidateId}/${input.files[0]}`;
    const record = JSON.parse(read(root, path)); record.lessons = ["A useful historical lesson".repeat(80)]; write(root, path, json(record));
    finish(root, applyCandidate(input, previewCandidateApply(input).digest));
  }
  assert.deepEqual(readContext({projectRoot: root, scope: "project"}).excerpts, defaultBefore.excerpts);
  const first = quickStatus(root, 1); assert.equal(first.records.length, 1); assert.equal(first.listing.complete, false);
  assert.equal(quickStatus(root, 1, first.listing.nextCursor!).records[0]?.quickId, "change-1");
  const excerpts: string[] = []; let cursor: string | undefined, pages = 0;
  do {
    const page = readContext({projectRoot: root, scope: "project", quickIds: ["change-1"], maxBytes: 4096, ...(cursor ? {cursor} : {})});
    assert.ok(Buffer.byteLength(JSON.stringify(page)) <= 4096); excerpts.push(...page.excerpts.map((entry) => entry.content));
    cursor = page.nextCursor ?? undefined; pages++; if (!cursor) assert.equal(page.contextReady, true);
  } while (cursor);
  assert.ok(pages > 1); assert.match(excerpts.join(""), /useful historical lesson/);
  const entry = inspectQuickHistory(root).records[0]!;
  const refreshBody = `# Refresh\n<!-- cadre:quick-sources:start -->\n${json([{quickId: entry.record.quickId, sha256: entry.sha256, disposition: "incorporated", reason: "Added guidance"}])}<!-- cadre:quick-sources:end -->\n`;
  const input = stage(root, "refresh", {"project.json": read(root, ".cadre/project.json"), "refreshes/refresh-quick.md": refreshBody,
    "guidelines.md": read(root, ".cadre/guidelines.md") + "\nApply the historical lesson.\n", "patterns/small-changes.md": "# Small changes\nVerified lesson.\n"});
  commit(root, applyCandidate(input, previewCandidateApply(input).digest));
  assert.equal(quickStatus(root, 50).counts.unconsolidated, 2);
  assert.equal(existsSync(join(root, entry.path)), false);
  assert.equal(contentHash(read(root, quickArchivePath(entry.record.quickId))), entry.sha256);
  assert.equal(quickStatus(root, 50).counts.archived, 1);
  assert.equal(quickStatus(root, 50).records.some((record) => record.quickId === entry.record.quickId), false);
  assert.deepEqual(validateProject(root).errors, []);
  assert.throws(() => begin(root, entry.record.quickId), /already reserved/);
  const archived = readContext({projectRoot: root, scope: "project", quickIds: [entry.record.quickId]});
  assert.ok(archived.excerpts.some((source) => source.path === quickArchivePath(entry.record.quickId)));
  const searched = readContext({projectRoot: root, scope: "project", quickSearch: {paths: ["app.txt"], limit: 1}});
  const hit = JSON.parse(searched.excerpts.find((source) => source.section === "quick search")!.content);
  assert.equal(hit.hits.length, 1); assert.equal(hit.hits[0].archived, true); assert.ok(hit.nextSearchCursor);
  const nextSearch = readContext({projectRoot: root, scope: "project", quickSearch: {paths: ["app.txt"], limit: 1, cursor: hit.nextSearchCursor}});
  assert.equal(JSON.parse(nextSearch.excerpts.find((source) => source.section === "quick search")!.content).hits[0].quickId, "change-1");
  assert.throws(() => quickStatus(root, 1, first.listing.nextCursor!), /listing changed/);
});

test("v5/v6 projects retain old workflows and explicitly adopt quick through refresh", (t) => {
  for (const version of ["v5", "v6"]) {
    const root = fixture(t), project = JSON.parse(read(root, ".cadre/project.json"));
    project.templateSetVersion = version; write(root, ".cadre/project.json", json(project));
    write(root, ".cadre/workflow.md", "# Existing approved workflow\n"); git(root, "add", ".cadre"); git(root, "commit", "-m", "legacy contract fixture");
    assert.deepEqual(validateProject(root).errors, []); assert.throws(() => begin(root), /QUICK_REFRESH_REQUIRED/);
    const input = stage(root, "refresh", {"project.json": read(root, ".cadre/project.json"), "workflow.md": getTemplate("project/workflow").content,
      "refreshes/refresh-enable.md": "# Adopt quick explicitly\n"});
    commit(root, applyCandidate(input, previewCandidateApply(input).digest));
    assert.equal(begin(root).status, "draft");
  }
});

test("quick blocks active Cadre workers", async (t) => {
  const {root, call} = await trackFixture(t);
  const started = await call("execution_start", {projectRoot: root, trackId: "sample", requestedMode: "sequential", approvalMode: "track"});
  const executionId = started.execution.executionId;
  await call("execution_checkpoint", {scope: {projectRoot: root, trackId: "sample", executionId, nodeId: "P1"}, action: {event: "start"}});
  await call("execution_checkpoint", {scope: {projectRoot: root, trackId: "sample", executionId, nodeId: "T1.1"}, action: {event: "start"}});
  await call("tracks_render", {projectRoot: root});
  assert.throws(() => begin(root), /quiescent/);
});

test("quick MCP exposes typed begin/approval/status/context and waits for apply", async (t) => {
  const root = fixture(t), server = createCadreServer(), client = new Client({name: "codex", version: "1.0.0"});
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  t.after(async () => {await client.close(); await server.close();});
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({name, arguments: args}); assert.equal(result.isError, undefined, JSON.stringify(result));
    return result.structuredContent as Record<string, any>;
  };
  assert.equal((await call("candidate_apply", {request: {mode: "begin_quick", projectRoot: root, quickId: "small-fix", intent: "Fix one behavior"}})).status, "draft");
  write(root, "app.txt", "after\n"); const input = candidate(root);
  const stagedPath = `.cadre/stage/${input.candidateId}/${input.files[0]}`, reconstructed = JSON.parse(read(root, stagedPath));
  delete reconstructed.lessons; delete reconstructed.relatedQuickIds;
  write(root, stagedPath, json(reconstructed));
  const prepared = await call("candidate_apply", {request: {mode: "prepare", ...input}});
  assert.equal(prepared.commandStatus, "approval_required"); assert.equal(prepared.stateChanges[0].changes.find((change: {field: string}) => change.field === "product").value.changes[0].path, "app.txt");
  for (const change of prepared.stateChanges[0].changes) {
    if (change.action === "append") reconstructed[change.field].push(...change.value);
    else reconstructed[change.field] = change.value;
  }
  assert.equal(contentHash(json(reconstructed)), prepared.files[0].sha256);
  assert.equal(existsSync(join(root, ".cadre/quick/small-fix.json")), false);
  assert.equal((await call("project_status", {projectRoot: root})).quick.staged[0].status, "ready");
  assert.equal((await call("context_read", {projectRoot: root, scope: "project"})).contextReady, true);
  const applied = await call("candidate_apply", {request: {mode: "apply", proposalToken: prepared.proposalToken}});
  finish(root, applied as {operationId: string; trailers: string[]});
  assert.equal((await call("project_status", {projectRoot: root})).quick.counts.completed, 1);
  const refresh = consolidation(root);
  const refreshPrepared = await call("candidate_apply", {request: {mode: "prepare", ...refresh}});
  assert.ok(refreshPrepared.files.some((file: {path: string; sha256: string | null}) => file.path === quickActivePath("small-fix") && file.sha256 === null));
  commit(root, await call("candidate_apply", {request: {mode: "apply", proposalToken: refreshPrepared.proposalToken}}) as {operationId: string; trailers: string[]});
  assert.equal((await call("project_status", {projectRoot: root})).quick.counts.archived, 1);
  const searched = await call("context_read", {projectRoot: root, scope: "project", quickSearch: {paths: ["app.txt"]}});
  assert.equal(JSON.parse(searched.excerpts.find((source: {section: string}) => source.section === "quick search").content).hits[0].archived, true);
});

function consolidation(root: string, id = "small-fix") {
  const entry = inspectQuickHistory(root).records.find((entry) => entry.record.quickId === id)!;
  return stage(root, "refresh", {"project.json": read(root, ".cadre/project.json"), "refreshes/refresh-quick.md":
    `# Refresh\n<!-- cadre:quick-sources:start -->\n${json([{quickId: id, sha256: entry.sha256, disposition: "no-change", reason: "Existing guidance already covers the outcome"}])}<!-- cadre:quick-sources:end -->\n`});
}
function delivered(root: string, id = "small-fix") {
  begin(root, id); write(root, "app.txt", "delivered\n");
  const input = candidate(root, id); finish(root, applyCandidate(input, previewCandidateApply(input).digest));
}
for (const boundary of ["journal", "archive", "removal", "receipt"]) test(`quick consolidation resumes after ${boundary} with byte-identical history`, (t) => {
  const root = fixture(t); delivered(root, "state"); // state.json is a record here, never an archived track.
  const original = read(root, quickActivePath("state"));
  const input = consolidation(root, "state"), preview = previewCandidateApply(input);
  assert.ok(existsSync(join(root, quickActivePath("state")))); // Preview/rejection has no mutation.
  assert.equal(existsSync(join(root, quickArchivePath("state"))), false);
  assert.ok(preview.manifest.some((file) => file.path === quickActivePath("state") && file.sha256 === null));
  const target = boundary === "journal" ? `.cadre/stage/operations/${preview.operationId}.json`
    : boundary === "archive" ? quickArchivePath("state") : boundary === "removal" ? quickActivePath("state") : `.cadre/receipts/${preview.operationId}.json`;
  assert.throws(() => promoteOperation(root, {operationId: preview.operationId, kind: "refresh", approvalDigest: preview.digest,
    baseCommit: preview.baseCommit, inputs: preview.recoveryInputs}, preview.files, (path) => {if (path === target) throw new Error("interrupted");}), /interrupted/);
  rmSync(join(root, ".cadre/stage/refresh-sample"), {recursive: true});
  const resumed = resumeOperation(root, preview.operationId, preview.digest); commit(root, resumed);
  assert.equal(read(root, quickArchivePath("state")), original);
  assert.equal(existsSync(join(root, quickActivePath("state"))), false);
  assert.deepEqual(validateProject(root).errors, []);
  assert.equal(quickStatus(root, 50).counts.archived, 1);
  assert.equal(quickStatus(root, 50).listing.total, 0);
  assert.equal(applyCandidate(input, preview.digest).commit, git(root, "rev-parse", "HEAD"));
});

test("quick archival rejects unapproved moves, drift, missing evidence, and unsafe destinations", (t) => {
  const root = fixture(t); delivered(root);
  const path = quickActivePath("small-fix"), archive = quickArchivePath("small-fix"), original = read(root, path);
  const input = consolidation(root), preview = previewCandidateApply(input);
  write(root, path, original + " "); assert.throws(() => applyCandidate(input, preview.digest), /modified|changed/); write(root, path, original);
  symlinkSync(join(root, ".cadre/quick"), join(root, ".cadre/archive/.quick"));
  assert.throws(() => applyCandidate(input, preview.digest), /archived|symbolic|Unsafe/); unlinkSync(join(root, ".cadre/archive/.quick"));
  write(root, archive, original); unlinkSync(join(root, path));
  assert.match(validateProject(root).errors.join("\n"), /location disagrees/);
  write(root, path, original); unlinkSync(join(root, archive));
  commit(root, applyCandidate(input, preview.digest));
  write(root, archive, original + " "); assert.match(validateProject(root).errors.join("\n"), /modified/);
  write(root, archive, original); unlinkSync(join(root, archive));
  assert.match(validateProject(root).errors.join("\n"), /Missing or invalid immutable quick record/);
});

test("archived quick records remain linkable from new delivery", (t) => {
  const root = fixture(t); delivered(root);
  const refresh = consolidation(root); commit(root, applyCandidate(refresh, previewCandidateApply(refresh).digest));
  begin(root, "correction"); write(root, "app.txt", "corrected\n");
  const input = candidate(root, "correction"), path = `.cadre/stage/${input.candidateId}/${input.files[0]}`;
  const record = JSON.parse(read(root, path)); record.relatedQuickIds = ["small-fix"]; write(root, path, json(record));
  finish(root, applyCandidate(input, previewCandidateApply(input).digest));
  const correction = inspectQuickHistory(root).records.find((entry) => entry.record.quickId === "correction")!;
  assert.ok(correction.record.context.some((source) => source.path === quickArchivePath("small-fix")));
});

test("quick search stays bounded across large history and rejects stale cursors", (t) => {
  const root = fixture(t); delivered(root);
  const original = inspectQuickHistory(root).records[0]!;
  const records = Array.from({length: 1000}, (_, index) => ({...original, path: quickArchivePath(`change-${index}`),
    record: {...original.record, quickId: `change-${index}`, outcome: "Long historical result ".repeat(150)}}));
  const input = quickSearchSchema.parse({paths: ["app.txt"], limit: 10}), result = searchQuickRecords(records, input);
  assert.equal(result.totalMatches, 1000); assert.ok(result.hits.length <= 10); assert.ok(result.nextSearchCursor);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < 8192);
  assert.throws(() => searchQuickRecords(records.slice(1), {...input, cursor: result.nextSearchCursor!}), /search changed/);
  assert.deepEqual(searchQuickRecords(records, quickSearchSchema.parse({query: "unmatched-area"})).hits, []);
  for (const input of [{}, {query: "app", limit: 11}, {paths: ["../outside"]}]) assert.equal(quickSearchSchema.safeParse(input).success, false);
});

test("a track named quick coexists with the hidden quick archive", async (t) => {
  const {root} = await trackFixture(t);
  const files = ["spec.md", "plan.md", "learning.md", "dependency-context.json", "state.json"];
  prepareCandidateStage(root, "track-quick", files);
  for (const file of files) {
    let body = read(root, `.cadre/tracks/sample/${file}`);
    if (file === "state.json") body = json({...JSON.parse(body), trackId: "quick", title: "Quick named track", commits: {}, history: []});
    write(root, `.cadre/stage/track-quick/${file}`, body);
  }
  const input = {projectRoot: root, candidateId: "track-quick", workflow: "track" as const, files};
  commit(root, applyCandidate(input, previewCandidateApply(input).digest));
  delivered(root, "state");
  const refresh = consolidation(root, "state"); commit(root, applyCandidate(refresh, previewCandidateApply(refresh).digest));
  assert.deepEqual(validateProject(root).errors, []);
  const trackState = JSON.parse(read(root, ".cadre/tracks/quick/state.json"));
  assert.match(renderTracksWithState(root, join(root, ".cadre/tracks/quick/state.json"), trackState).tracksContent, /`quick`/);
  assert.ok(readContext({projectRoot: root, trackId: "quick"}).contextReady);
  assert.equal(readContext({projectRoot: root, trackId: "quick"}).excerpts.some((source) => source.path.startsWith(".cadre/archive/.quick/")), false);
});


test("quick consolidation binds a bounded assessment to the primary refresh record", () => {
  const source = {quickId: "change", sha256: "a".repeat(64), disposition: "no-change", reason: "Already covered"};
  const block = (sources: unknown[]) => `<!-- cadre:quick-sources:start -->\n${json(sources)}<!-- cadre:quick-sources:end -->`;
  assert.throws(() => quickRefreshSources(block(Array.from({length: 21}, (_, index) => ({...source, quickId: `change-${index}`})))));
  assert.throws(() => quickRefreshSources(block([source, source])), /Duplicate/);
  assert.throws(() => requireQuickRefreshSources("unused", [
    {path: ".cadre/project.json", content: json({lastRefresh: {refreshPath: "refreshes/primary.md"}})},
    {path: ".cadre/refreshes/secondary.md", content: block([source])}
  ]), /primary refresh/);
  assert.throws(() => requireQuickRefreshSources("unused", [{path: quickActivePath("change"), content: null}]), /unassessed/);
});

test("quick records both sides of a staged rename and preserves pre-existing renames", (t) => {
  const root = fixture(t); begin(root);
  git(root, "mv", "app.txt", "renamed.txt");
  const paths = ["app.txt", "renamed.txt"], input = candidate(root, "small-fix", paths);
  const preview = previewCandidateApply(input);
  commit(root, applyCandidate(input, preview.digest));
  assert.deepEqual(validateProject(root).errors, []);

  const existing = fixture(t);
  git(existing, "mv", "app.txt", "renamed.txt"); begin(existing);
  write(existing, "app.txt", "overlaps the user's deletion\n");
  assert.throws(() => previewCandidateApply(candidate(existing)), /pre-existing/);
});

test("quick resumes after staging approved product files but rejects unrelated index drift", (t) => {
  const root = fixture(t); write(root, "unrelated.txt", "user work\n"); begin(root); write(root, "app.txt", "after\n");
  const input = candidate(root), preview = previewCandidateApply(input);
  const applied = applyCandidate(input, preview.digest);
  git(root, "add", "app.txt", ".cadre/quick", `.cadre/receipts/${applied.operationId}.json`);
  git(root, "add", "unrelated.txt");
  assert.throws(() => resumeOperation(root, preview.operationId, preview.digest), /changed after approval/);
  git(root, "restore", "--staged", "unrelated.txt");
  finish(root, resumeOperation(root, preview.operationId, preview.digest));
  assert.equal(read(root, "unrelated.txt"), "user work\n");
  assert.deepEqual(validateProject(root).errors, []);
});
