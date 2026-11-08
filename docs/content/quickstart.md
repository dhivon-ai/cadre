---
title: Quickstart
description: Create project context, choose Quick or a planned track, and bring the learning together with Refresh.
section: Get started
order: 30
---

# Quickstart

This walkthrough assumes Cadre is installed and the client has been reloaded.
Cadre commands are agent skills, not `cadre-ai` shell subcommands.

Codex, Claude Code, and native Zed Agent support is stable. The commands below
use each client's native skill integration.

## 1. Create Project Context

Open the target repository in Codex, Claude Code, or Zed Agent:

```text
# Codex
$cadre:create

# Claude Code
/cadre:create

# Zed Agent
/cadre-create
```

Cadre inspects the repository, establishes its exact root and Git disposition,
and explicitly classifies the project as greenfield or brownfield. When the
evidence is ambiguous, it asks before drafting.

Review the proposed product, engineering guidelines, technology stack,
workflow, styleguides, patterns, project state, and Git disposition in one final
authorization envelope. Cadre identifies unchanged bundled defaults concisely
and asks separately only when a material choice is unresolved. After approval,
it creates `.cadre/`, validates it, and records one setup/receipt commit without more
approval prompts.

## Choose Your First Workflow

After Create, choose the smallest path that fits the work:

- **Quick:** one bounded fix, test, refactor, or documentation change. Use the example below.
- **Planned track:** a feature or bug that needs a specification and dependency plan. Continue with [step 2](#2-create-a-feature-or-bug-track).

Quick and unified Refresh require [Cadre 4.1.0 or newer](/release-notes).

### A Bounded Change With Quick

```text
# Codex
$cadre:quick Fix the broken installation link in README and verify it

# Claude Code
/cadre:quick Fix the broken installation link in README and verify it

# Zed Agent
/cadre-quick Fix the broken installation link in README and verify it
```

Cadre implements the bounded change, verifies it, and presents the result and
outcome record for one final approval and one combined commit. Material scope
choices are clarified first. Quick does not create a track or require the track
review lifecycle. Later, [Refresh](#6-refresh-and-archive-completed-work) assesses
the outcome alongside project context and eligible completed tracks. For a
Quick-only project, invoke Refresh without a track ID.

## 2. Create A Feature Or Bug Track

```text
# Codex
$cadre:track Add passwordless login as a feature

# Claude Code
/cadre:track Add passwordless login as a feature

# Zed Agent
/cadre-track Add passwordless login as a feature
```

Cadre proposes specification, plan, learning, dependency context and state together when the request is clear. One approval covers the validated graph, commit groups, inherited constraints, pattern seed, lifecycle transition, generated state and one receipt-bearing commit.
Ask for staged specification/plan review explicitly when desired.

The plan is an acyclic dependency graph:

- each regular phase declares phase dependencies;
- each regular task declares same-phase task dependencies;
- every delivery phase ends with a derived `User Manual Verification` barrier;
- the final phase contains only track-level manual verification and depends on
  every delivery phase.

The track becomes `planned` only after the plan graph and pattern seed are
approved, validated, and committed.

## 3. Check Status

```text
$cadre:status
/cadre:status
/cadre-status
```

Status is read-only. It reports project and track checkpoints, pending
operations, dependencies, execution nodes, review/archive readiness, validation
errors, and managed worktrees.

## 4. Implement The Plan

```text
$cadre:implement passwordless-login
/cadre:implement passwordless-login
/cadre-implement passwordless-login
```

Parallel mode is the default. Request sequential execution explicitly:

```text
$cadre:implement passwordless-login sequentially
/cadre:implement passwordless-login sequentially
/cadre-implement passwordless-login sequentially
```

Track approval is the default: Cadre verifies phases automatically and pauses at
track verification, then ordinary review approval. Request `phase` for phase
verification gates, `governed` for task gates, or `autonomous` to implement, verify,
review, and fix in-scope findings until clean, with one final completion approval.
Parallel/Sequential scheduling remains independent. Phase, Track, and Autonomous
do not add a start-approval prompt.

Cadre starts an execution journal under the requested approval mode, derives a global queue from ready
phases and phase-local tasks, and creates workers only when at least two safe
nodes can run. A phase can move between sequential execution and task fan-out
only at a clean checkpoint. Workers use isolated Git worktrees; main reviews
every diff and presents it according to the persisted approval mode.

The main agent alone records state, directs commits, integrates branches,
resolves conflicts, removes worktrees, and records manual verification. When
all nodes, learning, provenance, and cleanup are complete, an approved finish
transition moves the track to `ready_for_review`.

## 5. Review

```text
$cadre:review passwordless-login
/cadre:review passwordless-login
/cadre-review passwordless-login
```

Review inspects the recorded implementation range and relevant context. If it
finds actionable bugs, it presents the findings together with exact bug and
remediation-plan artifacts. Approved remediation returns the track to
implementation.

When evidence is clean, Cadre previews completion bound to the current
execution, plan revision, graph digest and reviewed HEAD. Outside Autonomous
mode, the human may explicitly reject findings and record accepted risks.
Autonomous requires all findings resolved. Every mode requires explicit approval
of the exact completion proposal; only `review` can mark the track `completed`.

## 6. Refresh And Archive Completed Work

```text
$cadre:refresh passwordless-login
/cadre:refresh passwordless-login
/cadre-refresh passwordless-login
```

Refresh updates project context and can process one or more completed tracks in a single approved,
resumable batch. It moves track history to the derived archive location,
distills durable learning into project patterns, reseeds relevant active
tracks, rebuilds `tracks.md`, and records Git provenance under one approval,
one receipt, and one commit. Omit track IDs to include all eligible completed
tracks; explicit IDs limit the batch. An explicit empty selection performs
context maintenance without track archival. Refresh also works when no tracks
are completed and when archival justifies no guidance changes.

For a bounded fix or documentation change, use `quick` instead of creating a
track. One final approval covers the verified change and its outcome record. A
later Refresh assesses up to 20 quick outcomes alongside the selected tracks;
there is no separate track batch limit. See [Quick](workflows.md#quick).

## Supporting Commands

- Use `revise` when the approved desired behavior, scope, or plan changes.
- Use `refresh` when project product, workflow, stack, styleguides, or patterns
  drift from repository evidence or user intent.
- Use `revert` to prepare an additive Git-aware reversal.
- Use `wisp` for lightweight exploration that should not mutate Cadre state.

Continue with [How Cadre Works](how-cadre-works.md) or the complete
[Workflow Guide](workflows.md).

## Optional Telemetry

Telemetry-capable Cadre 4.2.0 builds default on outside CI and announce it before
installation and on MCP startup. Disable before installing with
`cadre-ai install --target all --telemetry off`, or use
`cadre-ai telemetry disable` / `DO_NOT_TRACK=1`. Saved choices survive upgrades
and `--yes`. Timings, sanitized errors, versions, counts, and random IDs help
identify bottlenecks; prompts, files, names, paths, and raw MCP payloads are excluded.
Use `cadre-ai telemetry configure --dsn <DSN>` for your own Sentry destination.
See [configuration](https://cadre.dhivon.ai/configuration/#optional-telemetry)
for precedence, privacy, delivery limitations, and Sentry-free builds.
