---
title: Documentation
navTitle: Documentation home
description: Find the right Cadre guide for installation, your first workflow, maintenance, recovery, or contributing.
section: Get started
order: 10
---

# Documentation

Cadre, a product of Dhivon AI, brings approved project context and resumable
workflows to Codex, Claude Code, and Zed. Start with installation, then choose
Quick or a planned track. Your repository keeps approved state in `.cadre/`.

## Start Here

- [Install for your client](/getting-started): copy the commands, reload, and verify the integration.
- [Run your first workflow](/quickstart): create context, deliver a bounded Quick change or plan a feature, then Refresh.
- [Choose a workflow](/workflows): decide what to invoke for the work in front of you.

## What Cadre Solves

| Your task | Guide |
|---|---|
| Understand context, approvals, and recovery | [How Cadre works](/how-cadre-works) |
| Deliver work with parallel agents | [Parallel execution](/parallel-execution) and [worked example](/parallel-execution-walkthrough) |
| Change approval or scheduling policy | [Configuration](/configuration) and [tuning](/tuning) |
| Resume interrupted work | [Operations](/operations) and [troubleshooting](/troubleshooting) |
| Understand current limits | [Capabilities](/capabilities) |
| Explore future team and polyrepo support | [Roadmap](/team-and-polyrepo) |

## Lifecycle

Start with approved context. Use a track for specified and planned delivery, or
Quick for a bounded change. Verify the result and approve completion. Bring the
learning together through Refresh.

[Follow the first-workflow walkthrough](/quickstart) or consult the
[workflow reference](/workflow-reference) for lifecycle rules.

## Unified Refresh

Refresh updates context, consolidates learning, reassesses active-track seeds,
and archives completed work under one approval, one receipt, and one commit.
It remains valid without completed tracks or new guidance.

[Use Refresh](/workflows#refresh) · [Maintain and recover](/operations)

## Ten Workflow Skills

[Create](/workflow-reference#create), [Track](/workflow-reference#track),
[Implement](/workflow-reference#implement), [Review](/workflow-reference#review),
[Revise](/workflow-reference#revise), [Quick](/workflow-reference#quick),
[Refresh](/workflow-reference#refresh), [Revert](/workflow-reference#revert),
[Status](/workflow-reference#status), and [Wisp](/workflow-reference#wisp).

## Cadre 4.2.0

Version 4.2.0 adds optional timing, sanitized-error, and inventory telemetry.
It is on by default outside CI with clear disclosure, persistent opt-out, own-DSN
support, and Sentry-free builds. Existing 4.1.0 projects need no migration.
[Configure or disable telemetry](/configuration#optional-telemetry).

## Cadre 4.1.0

Version 4.1.0 adds Quick and unified Refresh, with ten
workflows, 21 MCP tools, and immutable template v8. Existing supported projects
adopt the new workflow contract through an approved Refresh preserving custom policy.

[Release notes](/release-notes) · [MCP reference](/mcp-reference) ·
[Configuration reference](/configuration-reference) · [Licensing](/licensing)

## Contribute

Begin with the [architecture](/architecture) and [development guide](/development).
Then explore [runtime and MCP](/runtime-and-mcp), the [workflow engine](/workflow-engine),
[state and artifacts](/state-and-artifacts), and [testing and release](/testing-and-release).
