---
title: MCP Reference
description: Immutable v8 resources and the 21 Cadre MCP tools.
section: Reference
order: 210
---

# MCP Reference

Cadre exposes immutable template resources and 21 narrow tools. Response format
is selected from the MCP initialization client identity. Recognized Codex clients
and Claude Code 2.0.21+ receive only `structuredContent` with `content: []` and
advertised output schemas. Zed, older Claude Code, and unknown clients receive
compact JSON text without `structuredContent` or advertised output schemas.
Successes use this selected format. Errors use one JSON text block with `isError: true` for every client, so native Claude displays the diagnostic. Server-side output validation remains active in both modes. No redundant prose
summary or JSON copy is emitted. Structured template results include each body
in its descriptor; text clients receive each body once in the requested content
mode followed by JSON containing content-free descriptors.

Approval-aware commands use a strict `request` envelope. `request: { mode: "prepare", ... }` accepts only that operation's prepare fields and returns `approval_required` plus a compact token. After human approval, `request: { mode: "apply", proposalToken }` accepts no prepare fields. Deterministic operations apply in one call.
The prepare token is available in the selected JSON representation; applied results omit it.

## Template Resources

The active catalog is readable at `cadre://templates/v8/<logical-id>`. Only v8 is packaged; existing schema-2/v5 projects remain supported without migration.

## workflow_elicit

Presents one bounded text, boolean, or single-select clarification form (the message is limited to 2000 characters), or a fixed approval form bound to a digest/checkpoint. It never records approval or requests secrets.

## template_get_many

Returns known immutable templates plus ordered descriptors and hashes.
`contentMode` defaults to `embedded_resource`; pass `text` for clients such as
Zed that do not expose embedded resource bodies to the agent. Use MCP resources
to discover or read one template only when the client supports them.

## styleguide_resolve

Maps technologies to default logical styleguide IDs, resource URIs, paths, and hashes without returning unchanged guide bodies.

## context_read

Read-only, scoped to `projectRoot`, `trackId`, and optional `executionId`/`nodeId`. Returns required project instructions/styleguides, full approved scope/plan, explicit pattern references, declared dependency learning, and persisted handoffs. Ambiguous learning headings or missing applicability metadata expand the read conservatively. Repository instructions and affected code must still be read through the host before edits.

`maxBytes` defaults to 49152 (range 4096–65536) and bounds the serialized domain payload, not the surrounding MCP envelope or billed tokens. Consume `nextCursor` until `complete: true`; every page reports `snapshot`, `totalSources`, `errors`, `staleMemory`, and `excerpts`. Each excerpt contains `path`, full-source `sha256`, `reason`, `section`, `format`, `content`, `offset`, `endOffset`, and `sourceComplete`, selected-section `contentHash`, and `reused`. Offsets are UTF-16 positions within the selected section/representation, not file byte offsets. `format: "source"` is exact source text; `format: "handoff"` is a derived JSON rendering of persisted node evidence and current source-fingerprint findings. Missing handoffs are explicitly not recorded.

Pass optional `knownSources: [{path, sha256, section, contentHash}]` only for complete sections whose text remains available in the current session. Matching section identity/content hashes return `reused: true` and empty content even when an unrelated part of its file changes. Full-file freshness is still checked. Keep the same inventory for every page of one snapshot. Clear it after a fresh session or lost context. `contextReady` requires complete pagination without errors or stale guidance.

Continuation is bound to the scope, retained-source inventory, and every inspected input hash. On `CONTEXT_SNAPSHOT_CHANGED`, restart without a cursor. `complete` describes pagination only: errors or stale memory still require attention. Findings that cannot fit a page cause `CONTEXT_PAGE_TOO_SMALL` with instructions to increase the budget; no required text is silently dropped. The reader accepts no arbitrary path or shell input.

Prefer `retainedContextToken` from a complete successful retrieval over repeating knownSources. It is scoped to project/track, process-local, expires after 30 minutes or eviction, and asserts previously delivered text is retained. Clear it after compaction or context loss. No reusable token is issued before all pages are retrieved. Approved dependency-context artifacts replace recursive historical text only while coverage remains fresh; `dependencyContext.mode: full-source-fallback` explicitly identifies expansion.

## project_status

Requires the project root and accepts `view: project | track | implementation` plus `detail: summary | full` (default summary). Summary omits full state history and parsed graph detail, retaining operation/checkpoint, dependencies, scheduler, graph digest/counts, and source hashes. Full project detail adds `projectState` and paged `trackDetails` with complete state, graph, execution, and source references. Full implementation detail adds `executionJournal` alongside the scheduler. `staleMemory` is distinct from structural `errors`. Project listings accept `statuses`, `limit` (default 50, maximum 200), and `cursor`; consume `listing.nextCursor` until complete. Counts and validation remain project-wide, even for filtered pages. Restart pagination on `STATUS_SNAPSHOT_CHANGED`. Project view returns validation, checkpoint, counts, compact track summaries, runtime worktrees, and sorted `stagedTrackCandidates` with canonical-presence, validity, path/hash manifest, errors, and next action. Focused views always return the complete `errors` array when `valid: false` and a `focusedErrors` subset for the selected track and its dependencies. Track view requires `trackId` and returns `kind: "canonical_track"` for canonical state, including any matching shadowed `stagedCandidate`. If only `.cadre/stage/track-<id>` exists, it instead returns `kind: "staged_track_candidate"` and recovery guidance. Implementation view adds graph, scheduler, and focused worktrees, with optional `executionId` (omit or use `null` to select persisted state); it rejects candidate-only tracks with `TRACK_CANDIDATE_ONLY`. Malformed canonical, malformed stage, candidate-only, shadowed, and unknown states remain distinct. Legacy projects report `upgradeRequired` and target versions.

Focused canonical track and implementation views include nullable `nextStep`, also returned by `execution_finish`. It carries `action` (`invoke_skill`, `await_approval`, or `blocked`), logical `plugin: "cadre"` and nullable `skill`, `projectRoot`, `trackId`, nullable current `executionId`, nullable `prerequisite`, and `reason`. The agent resolves the installed skill through the host and executes it in the same task. Codex/Claude use the Cadre plugin workflow; Zed uses `cadre-review` or `cadre-implement`. The MCP does not dispatch skills itself.

Before an invocation, satisfy `implementation_bookkeeping_commit` or `review_bookkeeping_commit` when returned; resume from journal and Git evidence without duplicate commits. A pending review promotion routes back to review even after partial transition to `in_progress`. A clean Autonomous checkpoint returns `await_approval`: review must revalidate evidence with `review_complete` prepare and obtain explicit approval before applying its token. Legacy ambiguous authority and blocked loops stop with an actionable reason. Normal modes and terminal tracks return `null` and retain their ordinary gates. Next steps describe current persisted progress, even when status also requests a historical execution.

## state_validate

Returns complete validation diagnostics. Use it for final gates or diagnostics, not repeated command entry.

## candidate_stage_prepare

Creates or resumes `.cadre/stage/<candidate-id>` and ensures `.cadre/.gitignore` contains `/stage/`. Optional `expectedFiles` declares the complete next candidate shape: paths are relative to the stage without a `.cadre/` prefix and are normalized and deduplicated before mutation, the whole existing tree is safety-checked, omitted regular files are pruned, and retained/removed paths are returned. Omitting it preserves the existing tree. Copy bytes that must survive a rename before declaring the new set; omitted files are intentionally pruned. Before initialization, `.cadre` is only a bootstrap shell containing `.gitignore` and `stage`.

## candidate_inspect

Reads an exact staged file list, rejects unexpected/unsafe paths, symlinks, size violations, invalid revision filenames, and orphaned execution bindings in proposed track states, and returns one path/hash manifest plus a digest. `planValidations` must name every staged root or nested `plan.md` exactly once with its intended target status; staged plans and validation entries must correspond exactly. Results contain a sorted `plans` array, and the digest binds both artifact hashes and normalized validation context. Plan-free candidates omit `planValidations`. `learning` contains seed validation results against the proposed overlay; `memoryInputs` fingerprints unchanged canonical inputs and is included in the digest. Changed pattern content requires affected active seeds to be reassessed. For direct promotions, re-inspect immediately before writing and compare the full approved digest. Refresh prepare/apply enforces its seed overlay in the runtime. Revert candidates that change persisted node evidence must include the exact original journal under `reverts/revert-<id>-execution-before.json`.

Track status reports an exact staged `track-<id>` as a `staged_track_candidate` only when canonical track state is absent. A present but unreadable canonical track fails with `TRACK_STATE_INVALID` instead of being masked by the staged candidate.

## candidate_apply

Constrained promotion for track, quick, revise, refresh, review remediation and revert reconciliation. Prepare accepts `request: {mode: "prepare", projectRoot, candidateId, workflow, files}` and returns the exact final manifest/digest and approval token. After the applicable approval, apply accepts only `{mode: "apply", proposalToken}`. It validates proposed state/graphs/memory, binds unchanged source inputs, generates indexes and operation references, journals before promotion, and returns immutable receipt trailers with `commit_pending`. Agent Git tools create the commit. `{mode: "reconcile", projectRoot, operationId}` verifies unique reachable committed receipt/artifacts and removes only ignored recovery state. `{mode: "resume", projectRoot, operationId, approvalDigest}` resumes the exact persisted approved promotion. It never writes product files or executes Git.

For `workflow: "refresh"`, preparation also accepts `selectedTracks?: string[]`: omitted selects all eligible completed tracks in dependency order, an explicit list selects those tracks, and `[]` excludes archival. The returned `selectedTracks` is frozen into the proposal token; `moves` identifies each track's source and destination, and `stateChanges` explains derived metadata. Selection, complete source contents, fresh destinations and unchanged inputs are digest-bound. Stage project context, patterns, active seeds and a fresh refresh record; archive files and the index are runtime-derived. One receipt and commit cover the whole refresh. Historical archive receipts and approved journals remain readable and recoverable through resume/reconcile; the standalone archive MCP tool is removed.

A blocked or stalled policy-v2 Autonomous loop can request an explicit retry only
through refresh prepare, adding `reviewRetry: {trackId, refreshPath, reason}`.
Stage unchanged current track state, project state, and the named human-instruction
refresh record. The derived proposal preserves the original review baseline and
all attempts, records the prior loop in refresh history, and binds a new bounded
attempt budget to the approved receipt. Scope or plan changes use a separate
approval; arbitrary authored loop resets remain invalid. Retry accepts only omitted or empty selectedTracks and cannot consolidate quick outcomes.

Revert promotion requires the persisted approved reversal operation, actual
reachable reversal commits, exact durable reversal record/original journal
snapshot, and matching restored implement ownership. Its approval does not
replace Autonomous authority, findings, attempt history or cumulative review
coverage.

Prepare also returns `stateChanges`: exact field-level `set`/`append` operations
for runtime-derived track/project metadata. Apply these to the inspected source
JSON to reconstruct the final manifest bytes and verify their hashes. A retry
of a committed approval returns the original verified receipt with
`changedPaths: []` and `changedCount: 0`, even after temporary stages are removed.
Stale dependency context errors expose `expectedGraphHash` and `expectedSources`
so the agent can read the required sources and reassess the candidate.

Cadre revision promotion requires proposed state, a matching revision record,
and reassessed spec/plan/learning/dependency context before approval. Its preview
includes an active old journal's superseded disposition and the resulting
Autonomous scope reference. Reconciliation preserves the approved receipt; it
does not synthesize omitted state. Use `candidate_apply` prepare for this receipt-based
transition rather than separate `candidate_inspect` against the old binding.
The same derivation applies to active scope cascades in `workflow: "refresh"`,
including fresh per-track revision records in its exact manifest. Context-only
refresh preserves current execution and scope authority. Quiescence checks use
actual worker worktrees, paths, and branches while retaining cleaned historical
provenance. Record-only revision proposals and inconsistent counters fail before
promotion. Unsupported legacy formats must complete the approved 3.9.0 bridge
before returning to 4.1 for a scope revision.
Context refresh preserves the complete existing Autonomous loop and approval
policy. Imported `drafting-plan` specification revisions retain the previous spec
approval and leave the draft plan unapproved. Pending resume checks fingerprints
of approved unchanged inputs before further writes; `OPERATION_INPUT_DRIFT`
identifies changed paths and retains the original intent. These fingerprints are
temporary recovery metadata; published receipt formats are unchanged.

## diagnostic_read

Explicit full diagnostic access after a bounded error: `diagnosticId`, optional `offset` (default 0) and `maxBytes` (default 49152, 1024–65536). Consume `nextOffset` until null. Ordinary runtime errors are capped at 8 KiB including the serialized MCP envelope; the full process-local diagnostic is available for 30 minutes subject to bounded eviction.

## execution_graph_validate

Validates the approved canonical plan graph. Implementation preflight normally receives this through implementation status view.

For finding-bearing reviews, use `candidate_inspect` with target status `in_progress`. It validates the proposed transition while the canonical track remains `ready_for_review`, checking the existing execution against its original plan. For active scope revisions, use `candidate_apply` prepare with `workflow: "revise"` so the runtime derives journal supersession before validating the new graph. Included staged states must agree with their declared plan target; active execution checks remain mandatory, and terminal tracks cannot be reopened. Completed former final verification phases remain historical evidence when new remediation and final verification phases are appended.

## review_complete

Approval-aware clean-review completion. Prepare accepts `projectRoot`, `trackId`, `approval`, and optional `acceptedRisks` (forbidden in Autonomous). The server derives the range through `lastExecution.headCommit`, starting at `autonomousReview.initialBaseCommit` for Autonomous or `execution.baseCommit` otherwise. This includes the first implementation commit and preserves the original Autonomous baseline across revisions and remediation. The legacy `approval` input stores proposal evidence as `reviewEvidence`; prepare does not record confirmed approval. Apply persists a separate `approvalConfirmation` receipt bound to the proposal digest. There is no caller-supplied range start. Apply returns a compact receipt, recognizes an already-written matching review cycle, and repairs a stale derived index without duplicating history.

Every approval mode checks product and verification-policy content against the
reviewed HEAD before clean completion. Pending clean or finding-bearing review
recovery performs the same check before remaining writes, including older intent
formats. A committed approval replays its original verified receipt independently
of subsequent product changes; it does not approve those later changes.

## execution_start

Creates one already-authorized execution journal and track operation with persisted scheduling/approval modes. Before starting, the recorded plan commit must contain the approved revision and graph. New journals retain `planSource` for historical provenance checks.

## execution_checkpoint

Task `record_commit` and `block` actions also accept `handoff`: arrays `decisions`, `failedApproaches`, `openQuestions`, a `nextAction` string, and `sources` containing safe repository-relative `path` and exact `sha256`. Serialized handoffs must fit 8 KiB; oversized input is rejected without mutation. Handoffs persist atomically with the existing transition and remain on completed nodes. They never replace commit, verification, authorization, or blocker evidence.

Applies one semantic transition using `{ scope: { projectRoot, trackId, executionId, nodeId }, action }`. `record_commit` requires commit, verification, and authorization; `record_integration` requires commit and verification; `record_verification` requires commit, verification, and authorization; `block` requires a blocker. `start` and `resume` accept only their declared assignment fields. `complete` has state-dependent evidence requirements and returns a compact scheduler receipt.

`complete_group` accepts the shared `commit` and `tasks: [{nodeId, verification, authorization, handoff}, ...]` for every member of a new execution's approved same-phase commit group. Completion is atomic; internal dependencies are ordered and external group dependencies must be complete. Scheduler receipts include readyGroups. Existing journals retain their original execution contract. Call record_verification directly from pending; no separate verification-start call is needed. Direct-main phase complete accepts verified product/integration HEAD in one checkpoint.

## execution_status

Returns compact scheduler state. It remains available for focused follow-up, but implementation entry uses implementation status view.

## execution_finish

Verifies completed nodes, commits, final verification under the selected approval mode, and removed worktrees, then promotes plan markers, completed execution, `ready_for_review` state, index and an immutable operation receipt with atomic per-file replacement. Final verification requires human approval in Governed, Phase and Track modes; Autonomous records verification under persisted authority. Commit the promoted artifacts and receipt once, then reconcile through `candidate_apply`. If interrupted, resume the approved operation from its ignored recovery journal; mismatched inputs remain a hard stop.

## worktree_create

Creates or reconciles the derived worktree and records the node's `start` transition with path and branch. Retry completes whichever Git or journal half is missing.

## integration

Validates and fast-forwards a worker branch when possible, otherwise merges divergent histories, then records integration and returns scheduler state. Phase/track/autonomous mode completes in prepare; governed mode pauses and requires apply after approval.

## worktree_cleanup

Removes a verified integrated worktree/branch and records node completion. Retry handles an already-removed worktree with a missing journal transition.

## project_init_candidate

Approval-aware initialization. Prepare requires staged `product.md`, `guidelines.md`, and `tech-stack.md`, optional workflow/styleguide overrides, and selected logical styleguide IDs. The server generates unchanged v8 workflow/default guides and digest-binds all outputs. Apply journals promotion and writes an immutable receipt with the initial project artifacts. Commit them once and reconcile through `candidate_apply`. Resume an interrupted approved promotion using its operation ID and approval digest; unexpected or differing bytes remain a hard stop. Matching committed receipt replay does not create another initialization commit.

## tracks_render

Validates and atomically regenerates deterministic `tracks.md`.

## Common Guarantees

- Success payloads are validated against the tool's output schema before delivery.
  Both formats preserve `{ error: { code, message, details? } }` failures and
  elicitation outcomes.
- Project roots, IDs, paths, timestamps, commits, strict adaptive shapes, and event-specific evidence are validated at the boundary.
- Multi-file initialization, execution finish, clean review, and refresh with archival converge after interruption without duplicate cycles or history; byte, HEAD, hash, or journal drift remains a hard failure.
- `.cadre/stage/` is Git-ignored and never canonical or committed.
- Older formats remain readable for diagnostics. Delivery and staging fail with `PROJECT_UPGRADE_REQUIRED` and the 3.9.0 bridge instructions.
- Complete proposal manifests remain in structured proposals/journals; apply receipts stay compact.
- Errors return one JSON text block containing `{ error: { code, message, details? } }`.

## Upgrade and recovery

Cadre 4.2.0 ships template set v8 and retains the schema-2 receipt contract. Existing 3.9.0/3.9.1/3.9.2 schema-2/v5 projects need no project refresh. Older formats receive a warning and must use Cadre 3.9.0 to reconcile interrupted operations and perform an explicitly approved schema-2/v5 refresh at a quiescent boundary. Then install 4.2.0 and reload the client. Preserve historical evidence and any required explicit approval-policy choice; never change labels by hand.

Create, execution finish and clean review return `receipt` with `operationId`, `receiptHash`, exact Git `trailers`, and commit_pending. Include it in the operation's one commit and reconcile before dependent delivery. No separate execution-start, phase-record, final-verification-phase or clean-evidence-only commits are needed. Persist journals on disk throughout execution. An explicit handoff/blocker checkpoint remains available.

## Quick extensions

`candidate_apply` accepts `{request: {mode: "begin_quick", projectRoot, quickId,
intent}}` before product edits. It writes only ignored starting evidence and
returns `status: "draft"`, `candidateId`, `stagePath`, and `baseCommit`. Retrying
resumes the same intent without replacing its baseline.

Stage `quick/<quickId>.json` using `quick/record`, retaining the starting
`checkpoint.json`. Prepare with `workflow: "quick"` and that single record path.
The preview includes `stateChanges` with product evidence for reconstructing the
runtime-derived record. Apply after approval; the agent makes one focused commit
with product paths, record, receipt, and trailers. Reconcile verifies exact
product bytes/modes and excludes unrelated committed files. Resume uses the
persisted original approval and rechecks product/context freshness. Staging owned
product files for the combined commit is allowed; unrelated index drift and
unmerged entries remain blocking. Staged renames bind both old and new paths.

`context_read` accepts `scope: "project"` without a trackId. Existing track calls
remain compatible. Default context includes no quick history. Optional
`quickSearch: {query, paths, limit, cursor}` requires a query or affected product
paths. It searches active and archived completed records, returning at most 10
compact hits (default 5, below 8 KiB) in a `quick search` excerpt. The excerpt's
`nextSearchCursor` is optional discovery: pass it as `quickSearch.cursor` only
when more matches are useful, and never automatically exhaust history.
`quickIds` loads up to 20 selected full outcomes; `patternIds` loads selected
guidance. Keep selections fixed across required context continuation pages
(`nextCursor`) and restart when they change.

Project status returns `quick.records`, `quick.staged`, `quick.counts`, errors,
and a separate `quick.listing`. Pass its next cursor as `quickCursor` independently
of track pagination. Routine rows include unconsolidated and unresolved work;
archived records appear in `quick.counts.archived` and explicit lookup only.
Refresh records up to 20 source assessments per approved batch between
`<!-- cadre:quick-sources:start -->` and `<!-- cadre:quick-sources:end -->` as a
JSON array of `{quickId, sha256, disposition: "incorporated" | "no-change", reason}`.
Prepare derives each assessed record's removal from `.cadre/quick/` and
byte-identical addition at `.cadre/archive/.quick/<id>.json`. Review these moves
with guidance changes under one refresh approval. Both dispositions archive
the record; unassessed records stay in the queue. Only receipt-backed committed
moves count as consolidation. IDs, original contents, and delivery receipts
remain immutable; resume uses the same batch after interruption.
