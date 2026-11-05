import assert from "node:assert/strict";
import { getTemplate } from "../../src/domain/templates.js";
import { validateProject } from "../../src/domain/state.js";
import { fixture, json, read, write, commit, stage } from "./revision-fixture.js";

export async function reviewAndArchive({root, call}: Awaited<ReturnType<typeof fixture>>, trackId = "sample") {
  const state = JSON.parse(read(root, `.cadre/tracks/${trackId}/state.json`)), scope = {projectRoot: root, trackId};
  if (state.autonomousReview) write(root, `.cadre/tracks/${trackId}/state.json`, json({...state, autonomousReview: {...state.autonomousReview,
    checkpoint: "awaiting_approval", reviewedExecutionId: state.lastExecution.executionId, reviewedHead: state.lastExecution.headCommit}}));
  const review = await call("review_complete", {request: {mode: "prepare", ...scope, approval: "Explicit fixture approval of verified cumulative review"}});
  commit(root, (await call("review_complete", {request: {mode: "apply", proposalToken: review.proposalToken}})).receipt);
  const archive = await prepareRefreshArchive(root, call, [trackId]);
  const archived = await call("candidate_apply", {request: {mode: "apply", proposalToken: archive.proposalToken}});
  commit(root, {operationId: archived.operationId, trailers: archived.trailers});
  assert.deepEqual(validateProject(root).errors, []);
}

export async function prepareRefreshArchive(root: string, call: Awaited<ReturnType<typeof fixture>>["call"], selectedTracks?: string[]) {
  const input = stage(root, "refresh", {
    "project.json": read(root, ".cadre/project.json"),
    "refreshes/refresh-archive.md": "# Refresh\nAssess completed work together; no additional reusable guidance is justified by this fixture.\n",
    "workflow.md": getTemplate("project/workflow").content
  });
  return call("candidate_apply", {request: {mode: "prepare", ...input, ...(selectedTracks !== undefined ? {selectedTracks} : {})}});
}
