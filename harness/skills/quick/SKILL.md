---
name: quick
description: Implement a bounded fix, refactor, documentation change, test, or small feature without a track, then record its verified outcome in Cadre. Use when one locally verifiable outcome needs no coordinated delivery, migration, or change to approved track scope.
---

# Cadre Quick

Read `.cadre/workflow.md` first. Quick requires an initialized, healthy project that has adopted the quick contract through create or an approved refresh. `QUICK_REFRESH_REQUIRED` means propose that one-time refresh; never silently edit policy or version labels. This workflow does not apply to the Cadre harness repository itself unless testing an explicitly requested fixture.

## Scope and context

A clear request authorizes reversible product edits. Ask a short scope question before editing only when inspection reveals a material choice or wider consequence. Use impact and verification to judge size, not a line-count threshold. One bounded feature can qualify; migrations, coordinated phases, and changes to an active track's approved requirements need track or revise.

Call `project_status` with `view: "project"`. Stop on invalid state, unresolved operations, stale memory, or conflicting work. Inspect affected active-track scope and require a quiescent worker boundary; quick v1 does not run beside active Cadre workers. Status includes unconsolidated quick records and staged intent separately from tracks; inspect further quickCursor pages only when relevant, independently of track cursors. Archived records contribute to counts without listing their history.

Read `context_read` with `scope: "project"`, without trackId. Consume every page and require `contextReady`. Default context contains no quick history. Use a focused `quickSearch: {query, paths, limit}` (query or paths required, default 5 hits, maximum 10) and the pattern index to select relevant `quickIds` and `patternIds`, then start a new read with those selections. Search includes archived records; never drain its optional nextSearchCursor pages automatically. Reuse a retainedContextToken only while its source text remains available, with unchanged scope/selections across continuation pages; clear it after context loss. Quick outcomes are historical evidence, not authority overriding requirements. Read relevant code, callers, tests, and repository instructions separately.

## Implement and verify

1. Before editing, call `candidate_apply` with `request: {mode: "begin_quick", projectRoot, quickId, intent}`. Choose a stable unused ID and a short exact intent. This writes only an ignored checkpoint and returns candidateId, stagePath, and baseCommit. On interruption, resume that checkpoint and existing work; do not overwrite the baseline or retroactively adopt earlier edits.
2. Preserve unrelated work, including staged changes. Paths dirty at the checkpoint cannot be included in quick delivery. If work overlaps those edits, pause to resolve ownership. Do not reset, stash, or discard user work to satisfy a gate.
3. Implement the bounded change in the current checkout. Run proportionate verification and review the complete resulting diff. Fix findings within scope; failed or unavailable required checks block completion. If scope grows, preserve the checkpoint and diff, summarize remaining work, and route to track or revise without claiming quick completion.
4. Fetch `quick/record` through `template_get_many`. Render only `quick/<quickId>.json` beneath the returned stage. Keep `checkpoint.json`; do not use candidate_stage_prepare with a manifest that removes it. Match the exact checkpoint intent. Include actual acceptance, outcome, all new affected product paths, passing verification evidence, reviewed: true, and relevant context path/hash references. Leave operation null and omit product: the runtime derives both. Lessons and relatedQuickIds may be empty; never invent learning.

## One completion approval

Call `candidate_apply` with `request: {mode: "prepare", projectRoot, candidateId, workflow: "quick", files: ["quick/<quickId>.json"]}`. Present the focused product diff, verification/review evidence, completion record (including runtime-derived stateChanges), receipt manifest, and one combined local commit. Ask once for explicit approval of the unchanged proposal. An earlier scope discussion does not approve completion. Rejection leaves the candidate and product diff uncommitted; do not promote or claim completion.

At a decision boundary, inspect host policy before workflow_elicit. Under approval policy `never`, ask once in chat; otherwise use workflow_elicit and fall back to chat on fallback_required. Host tool permission is not Cadre approval. Do not repeat answered questions or approvals, and never approve your own proposal.

After approval, call `request: {mode: "apply", proposalToken}`. Changed product bytes, context, Git baseline, unrelated index entries, or verification inputs require reassessment and a fresh proposal. Do not weaken checks or erase recovery intent to bypass drift.

Create one local Conventional Commit containing exactly the approved product paths, `.cadre/quick/<quickId>.json`, and the returned immutable receipt. Include both exact receipt trailers. Stage only owned files and use a path-limited commit (for example, `git commit --only ... -- <owned paths>`) to preserve unrelated staged work. Verify the final commit includes no unrelated changes. Do not push. Then call `candidate_apply` with `request: {mode: "reconcile", projectRoot, operationId}`. Reconciliation verifies the product manifest and cleans temporary recovery state; there is no bookkeeping commit.

## Recovery and outcome

If interrupted after approval, reconcile an existing commit first. Otherwise use `request: {mode: "resume", projectRoot, operationId, approvalDigest}` with the persisted original approval. Staging owned product files for the combined commit does not invalidate approval; unmerged index entries still block recovery. Resume validates both context and product evidence; never replace the journal or repeat completed product work. Report commit_pending as unresolved provenance, not completion.

Before pausing unfinished work, add or update only checkpoint.json's optional `progress: {status: "working" | "blocked" | "escalated", summary, nextAction}`. Preserve its original identity, intent, and baseline. Status surfaces blocked/escalated intent and nextAction; these are unapproved working notes, not completion evidence. Resolve the recorded blocker before setting progress back to working and preparing completion.

Report the outcome, verification, commit, and any lesson briefly. Completed records await consolidation in `.cadre/quick/`. A later approved refresh batch records source assessments, consolidates durable guidance, and moves the unchanged records to `.cadre/archive/.quick/`. Archived records remain retrievable by ID or focused search and are omitted from routine status rows and context. Corrections use a new linked quick record or a track; quick records are not track dependency nodes and have no dedicated archive/revert lifecycle.
