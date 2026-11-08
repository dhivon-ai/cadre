---
title: Project Configuration
navTitle: Configuration
description: Configure Cadre through approved project context, workflow, styleguides, and track plans.
section: Deliver and maintain
order: 90
---

# Project Configuration

Cadre 4.1 does not use the retired `cadre/config.json` policy model. Persistent
behavior is defined by approved, version-controlled artifacts under `.cadre/`.

## Configuration Sources

| Artifact | Governs |
|---|---|
| `.cadre/product.md` | Product purpose, users, behavior, scope, and constraints. |
| `.cadre/guidelines.md` | Engineering principles, trust boundaries, non-goals, and decision rules. |
| `.cadre/tech-stack.md` | Languages, frameworks, build tools, platforms, and verification commands. |
| `.cadre/workflow.md` | Lifecycle, approval, testing, review, commit, and delivery expectations. |
| `.cadre/styleguides/*.md` | General and technology-specific implementation conventions. |
| `.cadre/patterns/index.md` | Durable reusable patterns and provenance. |
| Track `spec.md` | Track scope, requirements, acceptance, and dependencies. |
| Track `plan.md` | Execution DAG, tasks, verification barriers, and task provenance. |
| Execution journal | Requested/effective mode, worker bound, graph identity, and runtime evidence. |

These files are human-readable sources of truth, not generated projections of
a hidden configuration database.

## Change Project Context

Use `refresh` when product, engineering, workflow, technology, styleguide, or
pattern context drifts:

```text
$cadre:refresh
/cadre:refresh
/cadre-refresh
```

Refresh inspects user input, repository changes since setup or the last
refresh, completed-track outcomes, and current code/manifests. It proposes
focused diffs and a refresh record before writing. Exact cascading changes to
active tracks join the same authorization envelope rather than requiring
separate revision approvals.

Changes that affect active execution wait for a safe boundary. Changes that
affect track scope or plans follow `revise` impact analysis inside the same
refresh approval envelope.

## Change A Track

Use `revise` for a change to an approved specification, acceptance criterion,
dependency, or plan. Do not edit track state by hand or use `refresh` to bypass
track-specific impact assessment.

## Choose Execution Mode

Implementation defaults to parallel mode. Ask for sequential mode in the
workflow request:

```text
$cadre:implement checkout sequentially
/cadre:implement checkout sequentially
/cadre-implement checkout sequentially
```

The execution journal persists requested/effective mode and its worker bound.
Changing mode after execution starts requires a clean safe boundary and
approval.

Approval prompts are configured independently. `track` is the default;
it verifies phases automatically and pauses for track verification and ordinary
review approval. Request `phase` for phase gates, `governed` for task gates, or
`autonomous` for implementation, verification, review, and in-scope remediation
until a clean review with one final completion approval:

```text
$cadre:implement checkout governed
$cadre:implement checkout autonomous
/cadre:implement checkout governed
/cadre:implement checkout autonomous
/cadre-implement checkout governed
/cadre-implement checkout autonomous
```

The selected `approvalMode` is persisted in the execution journal and active
track operation. Changing it after execution starts also requires a clean safe
boundary and approval.

## Change Styleguides

`create` resolves a complete default set from the proposed technology list and
includes it in the single final initialization approval. It asks only when a
material convention cannot be inferred, rather than requesting acceptance for
each guide. Later changes belong in `refresh` so the technology list,
styleguide set, active-track impact, and Git record stay consistent.

## Safe Editing Rule

Cadre artifacts are ordinary version-controlled files, but stateful workflows
expect their changes to be approved, journaled, validated, and committed with
matching provenance. Use the owning workflow instead of manually changing
`project.json`, track `state.json`, execution journals, operation journals, or
the generated `tracks.md` index.

Legacy Autonomous executions require an explicit Track-or-Autonomous choice through
an approved refresh before resuming. New policies persist `approvalPolicyVersion: 2`.
Autonomous pauses when a finding survives two remediation attempts or needs a scope
decision, required human input, or an external prerequisite.

## Optional Telemetry

Available in Cadre 4.2.0 and newer.

Telemetry-capable Cadre builds default on outside CI. Installation announces the effective
setting before initializing telemetry; direct MCP startup repeats the notice on
stderr, keeping stdout reserved for MCP. The default destination is Dhivon AI's
Sentry project, injected during the release build from a GitHub Actions secret.
Builds without a valid `CADRE_BUILD_SENTRY_DSN` omit Sentry entirely; runtime DSN
settings cannot add it back. The documentation website has no Sentry or browser analytics.

```bash
cadre-ai install --target all --telemetry off
cadre-ai telemetry status
cadre-ai telemetry disable
cadre-ai telemetry enable
cadre-ai telemetry configure --dsn 'https://PUBLIC_KEY@YOUR_SENTRY_HOST/PROJECT_ID'
cadre-ai telemetry configure --default-dsn
```

A custom DSN **replaces** the Dhivon destination. Use a public ingestion DSN,
never a management token. A malformed or explicitly empty DSN disables sending;
there is no fallback. Preferences live in `${CADRE_HOME:-~/.cadre}/telemetry.json`,
outside project state and marketplace payloads. Reinstalling, updating, and
`--yes` preserve a saved opt-out. `--home` during installation selects the same
home for installed MCP clients; set `CADRE_HOME` when subsequently managing it.

Precedence, from strongest to weakest:

1. A telemetry-free build or `DO_NOT_TRACK=1` disables collection.
2. `CADRE_TELEMETRY=0|1` overrides the saved enabled setting.
3. A saved enabled/disabled preference applies.
4. CI defaults off; ordinary interactive installations default on.

`CADRE_SENTRY_DSN` overrides the saved DSN, including when it is empty.
Invalid preferences or invalid `CADRE_TELEMETRY` values fail closed. `telemetry
status` and `doctor` explain the effective setting and destination without a test
event. Help, version, configuration commands, and installation dry runs send no
telemetry. Disabling is rechecked before subsequent MCP operations and sends;
queued records are discarded. An already delivered event cannot be recalled.

### Collected And Excluded Data

An enabled runtime records each registered MCP operation and template-resource
read in memory: static tool/action category, outcome, wall duration, execution
duration, approval wait, nested phase timings, file/reused-read/byte/Git counters,
client family/version, Cadre release, Node major, OS family, and observed project
schema/template/runtime versions. The installed template catalog is separate
from the project's template version. Installer phases and sanitized failures
use the same recording layer. Approval-required, declined, and cancelled results
are distinct from failures.

Only allowlisted fields leave the process. Errors contain stable codes, static
descriptions, and normalized Cadre stack frames. No prompts, source or file
contents, project/track names, paths, Git remotes/branches/commits, raw MCP
arguments/results, subprocess arguments/output, credentials, or arbitrary
environment variables are exported. There is no console capture, profiling,
automatic instrumentation, or browser instrumentation. The ingestion service
necessarily receives the network connection's source IP; Cadre does not add IP
or user identity fields to events. The Dhivon Sentry project is configured to
prevent storing IP addresses. Configure equivalent privacy settings when using
your own destination.

### Inventory And Identity Limits

Random installation and project IDs are stored under the same user home in
`telemetry-identities/`. Linked worktrees share their Git common-directory
identity without an additional Git subprocess. IDs are pseudonymous, not an
anonymity guarantee. Removing this local directory resets the IDs. A repository
on two machines or under two Cadre homes can count twice.

Project totals mean **distinct observed project installations within the selected
reporting window**, not globally unique repositories. Inventory events are
timestamped observations from existing inspections, never new repository scans
solely for telemetry. Track counts cover every lifecycle status; active means
all except completed and archived. Quick counts distinguish staged, commit
pending, completed-unarchived, archived, and invalid observations. Archived
records are excluded from completed-unarchived totals. Missing/malformed records
can make observations incomplete; validation-error counts indicate the gaps.
Track observations expose completeness and staleness; Quick completeness is
separate. Absent fields mean unobserved, not zero.

Keep the latest complete snapshot per installation/project pair when reporting
current counts, display its observation time, and define a freshness window.
**Never sum repeated snapshots.** Inventory logs are separate from operation
counters, so repeated status calls do not mean additional projects or tracks.

### Delivery

Recording is local and in memory while enabled; delivery is asynchronous and
best effort. There is no disk spool. Up to 64 records and 256 nested spans per
operation are retained; additional spans are counted as dropped. Rate limits,
offline endpoints, queue pressure, process termination, and Sentry quotas can
drop events. Shutdown flushing is bounded to two seconds. Telemetry failures do
not change MCP responses, exit codes, approvals, Git operations, or state writes.
See [development](/development/#telemetry-adapters-and-sentry-free-builds) for a
build with Sentry and its dependencies removed.
