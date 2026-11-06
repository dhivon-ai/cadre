import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXECUTION_APPROVAL_MODES } from "../../src/domain/approval-policy.js";
import { directorySnapshot } from "../../src/domain/archive-artifacts.js";
import { contentHash } from "../../src/domain/memory.js";
import { validateProject } from "../../src/domain/state.js";
import { ProposalTokenStore } from "../../src/mcp/proposals.js";
import type { CandidateApplyInput } from "../../src/domain/candidate-apply.js";
import { fixture, git, read, write, stage, json } from "../helpers/revision-fixture.js";
import { applyAtBoundary, boundaries, clients, cloneMaintenanceSeed, commitViaMcp, maintenanceSeed,
  packagedClient, quickCandidate, type Call } from "../helpers/maintenance-fixture.js";

// Extended Cartesian coverage is opt-in: pnpm --filter cadre-ai test:maintenance-matrix.
// Client identities exercise the packaged protocol, not the clients' model/UI behavior.
const selections = ["default", "explicit", "empty"] as const;
const guidance = ["no-change", "incorporated"] as const;
const reports: Record<string, unknown>[] = [];
function record(row: Record<string, unknown>) {
  reports.push(row);
  if (!process.env.CADRE_MATRIX_REPORT_DIR) return;
  mkdirSync(process.env.CADRE_MATRIX_REPORT_DIR, {recursive: true});
  writeFileSync(join(process.env.CADRE_MATRIX_REPORT_DIR, "matrix-results.json"), json({
    coverage: "Packaged stdio MCP with synthetic client identities and labelled fixture approvals; not native model sessions",
    sourceCommit: git(process.cwd(), "rev-parse", "HEAD"), cases: reports
  }));
}
async function caseInClone(seed: string, dimensions: Record<string, unknown>, run: (root: string) => Promise<void>) {
  const root = cloneMaintenanceSeed(seed), started = Date.now();
  try {
    await run(root);
    record({...dimensions, status: "passed", elapsedMs: Date.now() - started,
      head: git(root, "rev-parse", "HEAD"), receipts: readdirSync(join(root, ".cadre/receipts")).length});
    rmSync(root, {recursive: true});
  } catch (error) {
    record({...dimensions, status: "failed", elapsedMs: Date.now() - started, root, error: String(error)});
    throw error; // Retain failed dummy projects for inspection.
  }
}
async function prepare(call: Call, input: CandidateApplyInput) {
  return call("candidate_apply", {request: {mode: "prepare", ...input}});
}
async function deliverQuick(root: string, call: Call) {
  await call("candidate_apply", {request: {mode: "begin_quick", projectRoot: root, quickId: "small", intent: "Make the bounded fixture change"}});
  write(root, "quick.txt", "Verified small fixture outcome\n");
  execFileSync(process.execPath, ["arithmetic.test.mjs"], {cwd: root});
  const proposal = await prepare(call, quickCandidate(root, ["quick.txt"]));
  assert.equal(existsSync(join(root, ".cadre/quick/small.json")), false);
  await commitViaMcp(root, call, await applyAtBoundary(root, call, proposal, "normal"), ["quick.txt"]);
  return proposal;
}
function assertTrackHistory(root: string, id: string, original: ReturnType<typeof directorySnapshot>, archived: boolean, reference: string) {
  const prefix = `.cadre/${archived ? "archive" : "tracks"}/${id}`;
  for (const file of original) {
    const body = read(root, `${prefix}/${file.path}`);
    if (!archived || file.path !== "state.json") assert.equal(body, file.content);
    else {
      const before = JSON.parse(file.content), after = JSON.parse(body);
      assert.deepEqual(after, {...before, status: "archived", checkpoint: "archived", history: [...before.history, {action: "archive", commit: reference}]});
    }
  }
  if (archived) assert.equal(existsSync(join(root, ".cadre/tracks", id)), false);
}

for (const client of clients) for (const mode of EXECUTION_APPROVAL_MODES) for (const schedule of ["sequential", "parallel"] as const) {
  test(`maintenance ${client}/${mode}/${schedule}`, async (t) => {
    const seed = await maintenanceSeed(t, client, mode, schedule), {call} = seed;
    for (const selection of selections) for (const disposition of guidance) for (const boundary of boundaries) {
      await t.test(`${selection}/${disposition}/${boundary}`, async () => {
        await caseInClone(seed.root, {suite: "combined", client, mode, schedule, selection, disposition, boundary}, async (root) => {
          const history = JSON.parse(read(root, ".cadre/project.json")).history;
          const snapshots = new Map(["sample", "other"].map((id) => [id, directorySnapshot(join(root, ".cadre/tracks", id))]));
          const quick = await deliverQuick(root, call), quickBody = read(root, ".cadre/quick/small.json");
          const selected = selection === "default" ? ["sample", "other"] : selection === "explicit" ? ["sample"] : [];
          const assessment = {quickId: "small", sha256: contentHash(quickBody), disposition, reason: disposition === "no-change"
            ? "Existing guidance already captures the verified lesson" : "Consolidated track and quick evidence into the preservation pattern"};
          const pattern = "# Evidence preservation\nRetain original receipts and historical artifacts when consolidating completed work.\n";
          const learning = read(root, ".cadre/tracks/dependent/learning.md").replace('"patterns":[]',
            `"patterns":[{"path":"patterns/evidence.md","sha256":"${contentHash(pattern)}"}]`)
            .replace("No applicable patterns.", "Apply the evidence preservation pattern to inherited dependencies.");
          const input: CandidateApplyInput = {...stage(root, "refresh", {
            "project.json": read(root, ".cadre/project.json"),
            "refreshes/refresh-combined.md": `# Combined maintenance\nSelected: ${selected.join(", ") || "none"}.\n${assessment.reason}.\n<!-- cadre:quick-sources:start -->\n${json([assessment])}<!-- cadre:quick-sources:end -->\n`,
            ...(disposition === "incorporated" ? {
              "guidelines.md": read(root, ".cadre/guidelines.md") + "\nPreserve historical evidence when relocating completed work.\n",
              "patterns/evidence.md": pattern, "patterns/index.md": "# Patterns\n- [Evidence preservation](evidence.md)\n",
              "tracks/dependent/learning.md": learning
            } : {})
          }), ...(selection === "default" ? {} : {selectedTracks: selected})};
          const proposal = await prepare(call, input);
          assert.deepEqual(proposal.selectedTracks, selected);
          assert.deepEqual(new ProposalTokenStore().resolve<CandidateApplyInput>("candidate_apply", proposal.proposalToken).input.selectedTracks, selected);
          assert.equal(proposal.moves.length, selected.length);
          assert.equal(read(root, ".cadre/quick/small.json"), quickBody);
          assert.equal(existsSync(join(root, ".cadre/archive/sample/state.json")), false);
          const count = Number(git(root, "rev-list", "--count", "HEAD"));
          const result = await applyAtBoundary(root, call, proposal, boundary);
          await commitViaMcp(root, call, result);
          assert.equal(Number(git(root, "rev-list", "--count", "HEAD")), count + 1);
          const project = JSON.parse(read(root, ".cadre/project.json"));
          assert.deepEqual(project.history.slice(0, -1), history);
          assert.deepEqual(project.history.at(-1).selectedTracks, selected);
          assert.equal(project.history.at(-1).action, "refresh");
          for (const [id, snapshot] of snapshots) assertTrackHistory(root, id, snapshot, selected.includes(id), `op:${result.operationId}`);
          assert.equal(read(root, ".cadre/archive/.quick/small.json"), quickBody);
          assert.equal(existsSync(join(root, ".cadre/quick/small.json")), false);
          const context = JSON.parse(read(root, ".cadre/tracks/dependent/dependency-context.json"));
          for (const id of ["sample", "other"]) {
            const prefix = `.cadre/${selected.includes(id) ? "archive" : "tracks"}/${id}/`;
            assert.ok(context.sources.some((source: {path: string}) => source.path.startsWith(prefix)));
            assert.ok(context.constraints[0].sources.some((path: string) => path.startsWith(prefix)));
          }
          if (disposition === "incorporated") assert.equal(read(root, ".cadre/tracks/dependent/learning.md"), learning);
          assert.deepEqual(validateProject(root).errors, []);
          assert.equal((await call("project_status", {projectRoot: root, view: "project"})).valid, true);
          for (const token of [proposal.proposalToken, quick.proposalToken]) {
            assert.equal((await call("candidate_apply", {request: {mode: "apply", proposalToken: token}})).changedCount, 0);
          }
          execFileSync(process.execPath, ["arithmetic.test.mjs"], {cwd: root});
          assert.equal(git(root, "status", "--porcelain"), "");
        });
      });
    }
  });
}

for (const client of clients) test(`quick products ${client}`, async (t) => {
  const seed = await maintenanceSeed(t, client, "track", "sequential"), {call} = seed;
  for (const shape of ["add", "edit", "delete", "executable", "binary"] as const) for (const boundary of boundaries) {
    await t.test(`${shape}/${boundary}`, () => caseInClone(seed.root, {suite: "quick", client, shape, boundary}, async (root) => {
      await call("candidate_apply", {request: {mode: "begin_quick", projectRoot: root, quickId: "small", intent: "Make the bounded fixture change"}});
      const path = shape === "add" ? "added.txt" : shape === "edit" ? "arithmetic.mjs" : shape === "delete" ? "obsolete.txt" : shape === "executable" ? "run.sh" : "fixture.bin";
      if (shape === "delete") unlinkSync(join(root, path));
      else if (shape === "executable") chmodSync(join(root, path), 0o755);
      else if (shape === "binary") writeFileSync(join(root, path), Buffer.from([0, 255, 254, 128]));
      else write(root, path, shape === "edit" ? "export const add = (a, b) => a + b; // verified\n" : "Added fixture\n");
      execFileSync(process.execPath, ["arithmetic.test.mjs"], {cwd: root});
      const proposal = await prepare(call, quickCandidate(root, [path])), count = Number(git(root, "rev-list", "--count", "HEAD"));
      await commitViaMcp(root, call, await applyAtBoundary(root, call, proposal, boundary), [path]);
      assert.equal(Number(git(root, "rev-list", "--count", "HEAD")), count + 1);
      assert.equal((await call("candidate_apply", {request: {mode: "apply", proposalToken: proposal.proposalToken}})).changedCount, 0);
      assert.deepEqual(validateProject(root).errors, []);
      assert.equal(git(root, "status", "--porcelain"), "");
    }));
  }
});

for (const client of clients) test(`empty maintenance ${client}`, async (t) => {
  const seed = await fixture(t, client), {call} = await packagedClient(t, client);
  for (const selection of ["default", "empty"]) for (const disposition of guidance) for (const withQuick of [false, true]) {
    await t.test(`${selection}/${disposition}/quick-${withQuick}`, () => caseInClone(seed.root,
      {suite: "no-completed-tracks", client, selection, disposition, withQuick}, async (root) => {
        write(root, "arithmetic.mjs", "export const add = (a, b) => a + b;\n");
        write(root, "arithmetic.test.mjs", 'import { add } from "./arithmetic.mjs"; if (add(2, 3) !== 5) throw Error("sum");\n');
        git(root, "add", "."); git(root, "commit", "-m", "fixture: arithmetic app");
        if (withQuick) await deliverQuick(root, call);
        const input: CandidateApplyInput = {...stage(root, "refresh", {
          "project.json": read(root, ".cadre/project.json"),
          "refreshes/refresh-empty.md": "# Refresh\nNo completed tracks; existing guidance remains applicable.\n" + (withQuick
            ? `<!-- cadre:quick-sources:start -->\n${json([{quickId: "small", sha256: contentHash(read(root, ".cadre/quick/small.json")), disposition, reason: "Assessed current fixture guidance"}])}<!-- cadre:quick-sources:end -->\n` : ""),
          ...(disposition === "incorporated" ? {"guidelines.md": read(root, ".cadre/guidelines.md") + "\nRetain reviewed evidence.\n"} : {})
        }), ...(selection === "empty" ? {selectedTracks: []} : {})};
        const proposal = await prepare(call, input); assert.deepEqual(proposal.selectedTracks, []);
        await commitViaMcp(root, call, await applyAtBoundary(root, call, proposal, "normal"));
        assert.deepEqual(validateProject(root).errors, []);
        assert.equal(git(root, "status", "--porcelain"), "");
      }));
  }
});
