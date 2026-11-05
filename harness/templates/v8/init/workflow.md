# Cadre Workflow

This is the durable project-level Cadre contract. Installed skills supply command procedure; stop and present any conflict with this file.

## Authority and project boundaries

- The installed Cadre MCP server is the authoritative runtime and immutable template provider.
- `.cadre/` contains approved mutable context, lifecycle state, and history only. Runtime code and template catalogs stay in the installed plugin.
- Read every existing artifact and its relevant repository context before editing it. Never reconstruct state or file content from memory.
- Resolve the exact repository root before mutation. Never create a nested repository or operate outside the approved root.
- A missing required MCP capability blocks stateful work; do not recreate it with shell or filesystem logic.

## Human governance

- Semantic content, scope, selection, and material consequences remain proposals until the human explicitly approves them. Explicit policy-v2 Autonomous authorizes verified in-scope review remediation under the approved specification; final clean completion and material scope changes still require human approval.
- Combine related decisions into one complete authorization envelope when their exact artifacts, focused diffs, consequences, and verification evidence are available together.
- Named deterministic consequences—validation, indexes, transitions, commits, and provenance—need no additional approval.
- Changed content, scope, selection, digest, or material consequences require a corrected proposal and approval. Within policy-v2 Autonomous, reassess and re-inspect changed in-scope remediation and bind its exact digest to persisted-mode authorization; never reuse a superseded digest.
- An MCP `approval_required` result is not approval. Call its adaptive command again in `apply` mode only after the human approves the unchanged digest-bound proposal.
- Host security permission is separate from Cadre approval and never approves product content, commits, merges, or lifecycle state.

## Candidate artifacts

- Write unapproved artifact bodies only beneath `<project-root>/.cadre/stage/<candidate-id>/` at their eventual `.cadre/`-relative paths.
- Never place unapproved files in canonical `.cadre/` and never transport candidate bodies through MCP when a candidate command exists.
- Inspect the complete exact candidate set before approval. Approval binds its paths and SHA-256 hashes to one digest.
- Candidate paths must be relative and traversal-free. Stages reject symbolic links, unexpected files, and size-limit violations.
- After approval, journal the digest and manifest, promote only matching bytes, verify hashes, and retain the stage through commit recording.
- `.cadre/stage/` is never committed. A changed candidate requires fresh inspection and approval.

## Resumability and Git safety

- Every multi-step mutation records an operation journal after approval and before canonical writes or Git mutation.
- On resume, reconcile the journal, candidate hashes, canonical files, Git status, expected commit, and recorded checkpoint. Continue only the first incomplete deterministic step.
- If an expected commit already exists with the correct base relationship and content, record it instead of repeating it.
- Stop on any journal, hash, path, worktree, branch, or history mismatch. Never reset, discard, force-delete, rewrite public history, or guess a repair.
- Use additive Git history and focused Conventional Commits. Do not include unrelated files or runtime-only worktrees.
- Reuse passing verification while product files, test inputs, and verification policy are unchanged. Cadre-only bookkeeping does not invalidate product verification.

## Sources of truth

- `spec.md` defines approved scope, requirements, and acceptance criteria.
- `plan.md` defines phase/task identity, dependencies, verification barriers, completion markers, and commit provenance.
- Track `state.json` defines identity, lifecycle status, dependencies, revision, checkpoints, active operation, execution pointer, review cycles, and history.
- Execution journals define live scheduling and provenance; do not duplicate active node state.
- `project.json` defines project identity plus setup and refresh history; it does not duplicate track records.
- `tracks.md` is a generated summary. Never hand-edit it or use it as dependency state.
- Git is implementation history. Completion claims require reachable recorded commits.

## Lifecycle and mutation rules

```text
drafting-spec -> drafting-plan -> planned -> in_progress -> ready_for_review
                     |             |             |              |
                     +-- revise ---+-------------+              +-- revise --> in_progress/planned
                                   |             |              +-- approved bugs --> in_progress
                                   +-------------+              +-- clean review --> completed --> archived
```

- Only `review` may mark a track `completed`; only `refresh` may mark it `archived`.
- Completed or archived intent changes create successor work rather than rewriting terminal history.
- Track dependencies are read from track state and must be completed or archived before dependent execution.
- Every delivery phase ends in a derived `User Manual Verification` barrier. The final phase is the track-level manual-verification barrier.
- An `implement` invocation authorizes the approved plan under its persisted approval mode. `track` is the default and requires track verification plus ordinary review approval. `phase` additionally pauses at each phase barrier; `governed` adds regular-task and integration decisions. Explicit policy-v2 `autonomous` verifies phases and track, reviews, and implements in-scope remediation until clean, then requires one human completion approval. Parallel scheduling remains the default, with Sequential available independently.
- Deterministic MCP operations use one call. Approval-aware operations use `prepare`, pause for the human, then `apply` with the unchanged token.

## Context reuse

- Inspect project status once at command entry using the narrowest applicable view. Use separate full validation only for final mutation gates or diagnostics.
- Read each required file once and reuse unchanged content by path and Git hash. Continue truncated reads from the first unread line.
- Fetch known immutable templates in one bundle and retain them through the decision. Do not rediscover known IDs through the catalog.
- Present concise status and focused diffs. Identify large unchanged defaults by version, path, and hash unless requested.

## Durable memory and context

- Active Pattern Seeds contain one versioned `cadre:memory` JSON block with spec/plan revisions and safe pattern paths plus SHA-256 hashes. Reassess changed guidance within track/revise/refresh authorization; do not silently refresh hashes without reviewing applicability.
- Preserve completed and archived learning as historical evidence. Missing old handoffs mean not recorded; never manufacture them during migration.
- Record bounded decisions, failed approaches, open questions, next action, and source fingerprints alongside task commit/block checkpoints. These handoffs are evidence, never approval or duplicated scheduler state.
- Use `context_read` for a selected node and consume all pages. It returns full approved scope/plan, applicable project instructions, dependency learning, and persisted handoffs. Read code and repository instructions separately before edits. Reuse hashes only when their source content is still available in the current session.
- Required context is never silently truncated. Continue pages, restart after snapshot drift, and expand ambiguous sections. Stop dependent execution on stale memory until reassessed.
- Routine status uses summaries; full history and graph are explicit detail reads. Project pagination filters rows, never validation coverage or counts.
- An approved refresh is required before delivery with a new runtime/template set. Keep staging, diagnostics, blocking, and verified cleanup available for recovery, preserve history, and resume the existing journal after interruption.

## Autonomous review and policy migration

- New executions persist `approvalPolicyVersion: 2`. Legacy Autonomous without this version requires an explicit Track-or-Autonomous choice in an approved, digest-bound refresh before continuing or inheriting it. Preserve existing Governed/Phase choices and the Governed fallback for missing modes.
- Autonomous records `state.autonomousReview`: original execution/authorization, specification commit, initial review baseline, checkpoint, and stable finding identities with distinct remediation execution IDs. The installed review skill defines its exact JSON and review procedure; implement owns execution recovery. Follow MCP `nextStep` to invoke the installed workflow in the same task, after its required bookkeeping commit.
- Complete implementation and its bookkeeping before review. Review the cumulative initial baseline through the latest completed execution HEAD, not only the latest fix. Stage and inspect remediation, bind its manifest digest to originating authority, journal before promotion, preserve completed phases, and start a fresh execution for the appended graph.
- Continue while making verified progress. Pause after the same finding survives two remediation attempts, for material scope decisions, or when required verification or external prerequisites are unavailable. Preserve finding identity across code moves; never waive findings or weaken checks to obtain a clean review.
- Record actual verification separately from persisted-mode authorization; never claim human approval of automated phase or track checks. Prepare clean completion only after all findings are resolved and the latest execution/HEAD has been reviewed. Ask once for the exact final completion proposal, then apply only after explicit human approval. No mode authorizes automatic clean completion.
- Scope/verification policy changes require renewed human authority. Product changes invalidate the clean-review checkpoint; Cadre bookkeeping alone may reuse unchanged evidence. Resume the recorded review or implementation checkpoint without duplicating findings, phases, attempts, or commits.

## Cohesive operations and retained context

- Schema-2 CommitRef values are existing SHAs or stable `op:<operationId>` references. A completed receipt binds approval digest, base and artifact hashes. Include its exact Cadre-Operation and Cadre-Receipt trailers in the agent-created commit. Resolve unique reachable committed evidence before dependent delivery. Never trust a trailer alone.
- Initialization and combined track planning each use one commit. Revise, refresh (including archival), and clean review each use one approved-operation commit. Implementation uses one product commit per cohesive group plus one completion commit. Revert uses approved reversal commits plus one reconciliation commit. Status and standard Wisp make no commits.
- Keep execution journals durable on disk; no automatic execution-start, phase-record, final-verification-phase or clean-evidence-only commits. An explicit handoff/blocker checkpoint is allowed. Reconciliation removes only ignored recovery state and never creates a follow-up provenance commit.
- New plans may assign commit groups within a phase. Preserve every task's verification, authorization and handoff, execute internal dependencies in order, and approve all affected siblings before reverting a shared commit. Existing executions retain their original contract.
- Candidate apply validates approved Cadre manifests and promotes state/indexes together. It cannot edit arbitrary product files or execute Git. Existing 3.9.x projects with schema-2 state and template v5 continue without migration. Older project formats must be migrated with Cadre 3.9.0 before using 4.0; preserve historical evidence and approvals.
- Active dependency-context artifacts carry curated source-linked contracts and inherited constraints under the same approval. Missing/stale coverage triggers explicit reassessment or a identified full-source fallback. Never rewrite archived learning.
- Use 48 KiB context pages and retainedContextToken after complete retrieval; clear it after context loss. Source-section hashes permit reuse while source freshness remains independently checked. Mutations return scheduler/validation for reuse.
- Use composite record_verification without a separate start. Complete a direct-main phase against verified HEAD in one checkpoint. Integration may fast-forward and may retain only validated owned execution state. Build outputs use the owned ignored `.cadre/.build-cache/cadre/` subtree. Other untracked files remain errors.
- Ordinary errors are limited to 8 KiB; request full diagnostic pages explicitly when needed.

## Quick changes

<!-- cadre:quick:v1 -->

Quick is a separate delivery path for one bounded, locally verifiable outcome. A clear request authorizes reversible product edits; agree on scope first when material choices or wider consequences emerge. The final reviewed diff, verification evidence, and completion record require one explicit approval. Track phase barriers apply to tracks, not quick changes.

Before edits, use candidate_apply begin_quick to retain the Git baseline and pre-existing edits in ignored staging. Read relevant project instructions, guidance, quick outcomes, and affected active-track scope. Do not run quick alongside active Cadre workers. Conflicting work, migrations, coordinated delivery, or changes to approved track requirements go through track or revise; preserve unfinished work when escalating.

Quick records await consolidation at quick/<id>.json and remain immutable. They are historical evidence, never requirements or dependency authority. Status derives completion from the verified receipt commit; unfinished candidates remain under stage/. Final approval binds the product diff, context, and verification inputs. The agent creates one local commit containing product changes, the record, and its receipt; MCP verifies evidence without editing product files or executing commits. Do not include unrelated edits or push automatically.

Default project and track context excludes quick history. Focused quickSearch returns at most 10 summaries; load only relevant quickIds and never automatically exhaust search pages.

Refresh assesses at most 20 unconsolidated quick outcomes per approved batch, records exact source hashes and dispositions, and merges useful findings into existing guidance or patterns without accumulating duplicate summaries. Under the same approval, move assessed records unchanged to archive/.quick/<id>.json; no-change assessments require reasons. Preserve delivery receipts and original contents. Reassess affected active-track memory when guidance changes. Archived records remain searchable but are omitted from routine context and status rows. The hidden archive directory does not reserve the track name quick. Corrections use new linked records and additive changes. Existing v5/v6 projects keep their current workflows; quick requires an approved refresh adopting this contract and current template metadata.

## Refresh and completed-track archival

<!-- cadre:refresh-archival:v1 -->
Refresh owns project maintenance and completed-track archival in one digest-bound approval, receipt, and commit. By default select all eligible completed tracks in dependency order; explicit selectedTracks limits the batch and [] excludes track archival. Freeze selection at preparation. Require clean approved review, valid project state, reconciled operations, and quiescent workers. Assess track learning, repository changes, patterns and up to 20 quick outcomes together; no-change assessments are valid and must explain why. Reassess affected active-track seeds and dependency context and derive source-path relocation within the same approval. Preserve archived history byte-for-byte except status, checkpoint and appended archival provenance bound to the refresh receipt. Never manually stage archive destinations. A blocked-review retry remains focused and cannot archive tracks or consolidate quick outcomes.

Existing supported projects adopt this contract through an approved workflow diff in Refresh, preserving custom policy. Version labels alone do not authorize archival. Historical archive receipts remain readable; recover already-approved archive journals with candidate_apply resume/reconcile. Unapplied archive proposals must be prepared again through Refresh.
