# Quick and unified Refresh verification — 2026-11-05

Runtime source: `7db49a88643d4020494821fe811d006301802d30` (unreleased v8
workflow contract). The bundled MCP server SHA-256 was
`210ff3645a17d12342d1a21bbb5c6d122b4cdfe12f0a541df57a42679c8f975a`.
The added matrix runner and fixtures were local test changes on that source.

## Final results

All **660 distinct matrix cases passed**: 220 each for Codex, Claude Code, and
Zed protocol identities. All **522 ordinary harness tests passed**, with zero
failures, cancellations, or skips. Type checking, package validation, package
dry run, and the full documentation check passed. The final documentation
content check and Git whitespace check also passed. No production runtime
changes were needed.

The consolidated evidence is
`/tmp/cadre-maintenance-20261105/final-summary.json`. It records every distinct
case once, tested source/bundle hashes, regression counts, and independent
native verification. Codex's 220 passing cases come from the initial run;
Claude/Zed's 440 passing cases come from the corrected adapter rerun. Earlier
failed fixture-setup attempts and the additional passing pilot remain in the
raw logs and are not counted as extra final coverage.

## Scope and repeatability

Run `pnpm --filter cadre-ai test:maintenance-matrix` for the extended 660-case
matrix. `CADRE_MATRIX_REPORT_DIR` chooses the evidence directory;
`CADRE_MATRIX_CLIENTS=claude-code,zed` restricts a rerun to those protocol
identities. The runner uses four isolated workers and checks that the expected
case count completed successfully. Successful dummy projects are removed;
failed projects are retained with their paths in the JSON results.

| Suite | Dimensions | Cases |
| --- | --- | ---: |
| Quick then combined Refresh | 3 clients × 4 approval modes × 2 schedules × 3 selections × 2 guidance outcomes × 4 promotion boundaries | 576 |
| Quick product changes | 3 clients × 5 file-change shapes × 4 promotion boundaries | 60 |
| Refresh without completed tracks | 3 clients × 2 selections × 2 guidance outcomes × Quick present/absent | 24 |

Selections are omitted/default, explicit subset, and explicit empty. Guidance
outcomes are incorporated and justified no-change. Promotion boundaries are
normal completion, persisted intent, partial writes, and receipt written before
commit. File shapes are add, edit, delete, executable-mode change, and binary.
Every combined case starts with two cleanly reviewed completed tracks in a
dependency chain and one active dependent track. It delivers a Quick outcome,
then assesses that outcome with the selected tracks and guidance in one Refresh.

Prepare, apply, resume, reconciliation, status, and replay use the built stdio
MCP server. Only crash injection calls the domain promotion hook directly.
Checks verify approval immutability, frozen selection, preservation of unselected
tracks and historical bytes, dependent source/constraint relocation, reassessed
active seeds when patterns change, one commit per operation, candidate-free
recovery, zero-change committed replay, final validation, and a working dummy app.

These are exhaustive combinations of the listed dimensions, not every possible
input or host configuration. Client identities are SDK protocol clients, not
native model sessions. Parallel scheduling is configured and validated; the
matrix does not run simultaneous model workers. Ordinary harness tests retain
negative cases, workflow adoption, old archive recovery, and installer coverage.

## Native Codex lifecycle

Codex CLI 0.166.0 ran five fresh ephemeral sessions against the locally built
server, plus a read-only template discovery probe. No installed plugin or global
client configuration changed. The test driver inspected exact proposals and
provided explicitly labelled synthetic fixture approvals.

Fixture and evidence directory:
`/tmp/cadre-maintenance-20261105/native-codex/`.

1. Read the current Quick skill, add `subtract(a, b)` beside `add`, extend the
   arithmetic checks, and prepare without applying. The driver checked the
   two-file diff, four assertions, manifest, and digest.
2. Apply the approved Quick. The workspace sandbox denied writing Git's index,
   leaving the original receipt at `commit_pending` without a commit.
3. In a session with writable Git metadata, recover the original Quick, commit
   and reconcile once, then prepare Refresh without applying. Refresh assessed
   both completed tracks and the Quick, updated product context, justified no
   reusable pattern change, and preserved active scope and custom workflow policy.
4. After independent re-derivation and inspection of all 33 approved artifacts,
   apply Refresh and intentionally stop before staging or commit. The driver
   copied the approved candidate to evidence and removed its disposable stage,
   retaining the original recovery journal.
5. A fresh session resumes the approved Refresh without candidate files, commits
   exactly once, reconciles, and successfully replays both the Refresh and the
   now-consolidated Quick with zero changed paths.

Quick commit: `226a3030308f9d09788a8d2a5ba4e7e4f3949a70`.
Refresh commit and final HEAD: `1d8968a56e6bab5e1eb98ebba46b841f8b796c8b`.

Independent verification passed:

- Eleven immutable artifacts, including the Quick outcome, retain exact bytes.
  Both archived state objects change only status, checkpoint, and appended
  archival provenance referencing the Refresh receipt.
- Active dependency sources and inherited constraint references point to archive
  locations. One track remains planned and two are archived; validation is clean.
- All ten fixture receipts resolve to exactly one reachable commit each.
  No recovery journals remain and Git is clean.
- Four app assertions and 80,802 independent BigInt arithmetic comparisons pass.

Native Claude Code 2.1.316 reported `Not logged in`. The user explicitly chose
protocol-only Claude coverage. Zed's UI was signed out with no model selected;
its CLI has no headless agent command, and the user explicitly chose protocol
and installer coverage for Zed. Native Claude/Zed skill execution is not
claimed. Their protocol behavior and disposable installer fixtures are separate
from native authentication, model behavior, and UI verification.

## Test-driver findings

The first protocol run assumed every response had `structuredContent`. Claude
and Zed also return JSON in text content, so fixture setup failed before those
combined cases ran. The new driver now handles both forms, like the existing
client fixture, and the affected identities were rerun. This did not require a
production runtime change. The native Git-index denial was a session sandbox
configuration issue; recovery retained the original operation and approval.

Evidence is local under `/tmp/cadre-maintenance-20261105/`: per-shard logs and JSON,
native prompts/transcripts/proposals, and `native-codex/independent-verification.json`.
No release, installation into live clients, or root `.cadre/` initialization was
performed in the harness repository.

## Additional live Codex run: guarded division

At the user's request, four more real Codex CLI 0.166.0 sessions exercised a
fresh disposable project at `/tmp/cadre-live-codex-20261105/project`. The fixture
started with two completed tracks carrying Autonomous/parallel execution history
and one planned dependent. Fixture seeding was deterministic; Quick authoring,
Refresh authoring, MCP promotion, commits, and recovery were performed by native
Codex sessions using the current source skills and local MCP server.

1. Quick added `divide(a, b)` with `RangeError("Division by zero")` for either
   zero sign, preserving add. Seven assertions passed. The session stopped at
   preparation; the parent driver independently inspected the product diff and
   re-derived its digest before supplying synthetic fixture approval.
2. A fresh session applied, committed and reconciled Quick, then prepared one
   36-artifact Refresh. It combined actual product context, an explicitly supplied
   fixture boundary-testing policy, one new pattern/catalog entry, conditional
   reassessment of the active seed, both completed-track archives, and the Quick
   assessment. It preserved approved scope and custom workflow policy, and did
   not invent lessons from the completed tracks.
3. After independent proposal inspection and synthetic approval, another session
   applied Refresh and verified all 36 approved artifact changes, then stopped
   before commit. The driver retained the candidate as evidence and removed its
   disposable stage while preserving the original recovery journal.
4. A fresh session resumed under the original authority, made one combined
   Refresh commit, reconciled, and replayed both original tokens with zero changes.

Quick commit: `03c44d01d1e47990fdf2105589847e91f4f0d063`.
Refresh commit: `7aa41fe6bcb850ac51af564c30d8cb4079000f51`.

Independent final verification passed: eleven immutable artifacts retain exact
bytes; both archived state objects preserve Autonomous authority/history except
the permitted archival fields; the workflow is byte-identical; the active track
retains its revision/dependencies and valid reassessed seed; dependency references
relocate correctly; all ten receipts map to one commit each; no recovery journals
remain; and Git/project validation are clean. Seven application assertions and
48,443 additional arithmetic comparisons passed. The new pattern is
`patterns/arithmetic-boundaries.md`.

Prompts, JSONL transcripts, proposals, apply/recovery responses, candidate evidence,
and `independent-verification.json` are retained under
`/tmp/cadre-live-codex-20261105/`. No production runtime changes, live installation,
release, or push were needed for this run.
