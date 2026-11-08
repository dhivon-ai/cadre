# Cadre 4.2.0 release validation — 8 November 2026

The maintainer authorized updating the ecosystem and publishing stable 4.2.0.
The release includes optional MCP/installer telemetry with replaceable Sentry
support, disclosure, opt-out controls, and Sentry-free builds. The website itself
has no browser analytics or Sentry instrumentation.

## Version and compatibility

Runtime, npm package, docs package, and both native plugin manifests are 4.2.0.
The payload retains ten workflows, 21 MCP tools, and immutable template v8.
Existing supported 3.9.x, 4.0.0, and 4.1.0 schema-2 projects remain compatible;
telemetry does not require project migration. No root `.cadre/` was created.

## Validation

- Frozen dependency installation and harness TypeScript checks passed.
- The complete harness suite passed on Node 22: 546 tests, zero failures.
- Missing, empty, and invalid build DSNs, explicit exclusion with a DSN present,
  and enabled builds passed the 15-case Node/package recording matrix. Disabled
  builds omit SDK/dependency code and make zero telemetry requests even with a
  runtime custom DSN.
- Self-contained telemetry-enabled and Sentry-free CLI/MCP packages passed on Node
  18.20.8, 20, and 22 using an isolated recording transport and no node_modules.
- Package validation and pack dry-run passed for `cadre-ai@4.2.0`.
- Documentation content, lint, types, static build, SEO, metadata, legal-byte,
  and link checks passed: 25 exported pages and 1,680 internal links.
- Local-build installation passed for Codex, Claude Code, and Zed at user scope.
- Codex and Claude list enabled `cadre@cadre` plugins at 4.2.0 with client-specific
  installation cache-buster suffixes. A fresh Codex session successfully called
  `template_get_many`; Claude's MCP health check reports Cadre connected.
- Zed 1.27.0 shows the Cadre server active and discovers all ten `cadre-*` skills.
  Installed MCP bytes match the source build. All 21 current exact tool approvals
  are present; Codex and Claude's narrow Cadre approvals are retained.
- Native smoke checks establish installation, discovery, and transport activation;
  they do not repeat exhaustive native model delivery across all workflows.
- Earlier implementation validation verified synthetic errors, nested traces,
  metrics, and inventory in Sentry's `telemetry-test` environment and the
  Cadre bottlenecks dashboard. Production/test filtering and observation-count
  limitations are documented. Sentry is configured to prevent storing client IPs.

## Publication path

Use the immutable `release-4.2.0` tag and a stable GitHub release. The existing
trusted-publisher workflow runs its release gates, publishes npm `latest` with
provenance, verifies registry visibility, then fast-forwards `release` for the
Cloudflare production documentation deployment. It no longer force-pushes that
branch. Existing published release tags and remote history are preserved. Unpublished
implementation commits were replaced before pushing to remove the default DSN.
Release CI injects it from the `CADRE_SENTRY_DSN` repository secret; builds without
a valid build-time DSN omit Sentry support.

## Published outcome

GitHub and npm published 4.2.0 with signed provenance. The release job passed
all 546 tests and the 15-case telemetry build matrix. npm processing completed
before updating the production branch. The first branch-update attempt could
not establish ancestry from a shallow checkout; the maintainer's full checkout
verified ancestry and fast-forwarded `release` to the immutable release commit.
Future branch-update jobs fetch full history. The package and release tag were
not republished or moved.
