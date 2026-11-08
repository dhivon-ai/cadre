---
title: Testing And Release
description: Validate the runtime, package payload, native installers, and documentation before release.
section: Contribute
order: 180
---

# Testing And Release

Release validation covers TypeScript, runtime behavior, skill/template/package
integrity, the npm payload, all three native clients, and the public docs.

## Harness Checks

```bash
pnpm --filter cadre-ai check
pnpm --filter cadre-ai test
pnpm --filter cadre-ai validate
```

- `check` runs strict TypeScript without emitting.
- `test` builds both bundles and runs CLI plus integration tests.
- `validate` builds and verifies manifests, marketplace catalogs, package
  identity, the sole `cadre-ai` bin, self-contained dependency policy, skills,
  agent isolation rules, templates, MCP configs, and absence of retired source.

## Extended Quick and Refresh Matrix

```bash
pnpm --filter cadre-ai test:maintenance-matrix
```

This opt-in suite runs 660 cases in disposable Git projects against the packaged
stdio MCP server. Four isolated workers retain logs and JSON results under a
printed temporary directory; set `CADRE_MATRIX_REPORT_DIR` to choose that directory.
Failed dummy projects are retained for diagnosis. Successful projects are removed.

- 576 combinations cross Codex/Claude Code/Zed protocol identities, four track
  approval modes, two schedules, default/explicit/empty archive selection,
  incorporated/no-change guidance assessments, and normal/intent/partial/receipt
  interruption boundaries. Every case delivers Quick and then consolidates it
  through Refresh alongside the selected completed tracks.
- 60 Quick cases cross the three protocol identities, additions/edits/deletions/
  executable modes/binary files, and all four interruption boundaries.
- 24 cases cover Refresh without completed tracks, with and without Quick
  outcomes, changed or unchanged guidance, and default or empty selection.

Checks include frozen selection, one commit per receipt, unchanged historical
artifacts, active dependency relocation and seed reassessment, recovery without
candidate stages, committed replay, valid final project state, and a working
dummy arithmetic app. Existing focused tests cover rejection and eligibility
guards, legacy receipts, workflow adoption, and installer fixtures.

Client names in this matrix identify MCP protocol clients, not native model
sessions. The execution schedule is configured and validated; this suite does
not run simultaneous model workers. Native skill following, authentication,
discovery, and UI behavior require separate native-client tests.

## Package Inspection

```bash
pnpm --filter cadre-ai pack --dry-run
```

Confirm the payload contains manifests, MCP configs, skills, agents, immutable
templates, license, README, and both runtime bundles. It must not contain source
tests, development dependencies, `node_modules`, or a second binary alias.

## Documentation Checks

```bash
pnpm --filter cadre-docs check
```

This runs content validation, ESLint, TypeScript, the static Next.js build, and
rendered SEO/internal-link validation.
The docs package version and release notes must match `harness/package.json`.

## Native Installer Validation

Build locally and install for all supported clients:

```bash
pnpm --filter cadre-ai build
node harness/dist/cadre-cli.mjs doctor
node harness/dist/cadre-cli.mjs install --target all --scope user
codex plugin list --json
claude plugin list --json
zed --version
```

Verify:

- Codex and Claude report `cadre@cadre` installed and enabled at the candidate
  version (with installation cache-buster metadata where applicable);
- Codex launches `./dist/cadre-mcp.mjs` from the packaged plugin root;
- Claude launches `${CLAUDE_PLUGIN_ROOT}/dist/cadre-mcp.mjs`;
- Codex has the plugin-scoped MCP approval mode;
- Claude has both the `cadre` enabled server and `mcp__cadre__*` allow rule;
- Zed Agent has ten global `cadre-*` skills, an active Cadre context server, and exact
  `mcp:cadre:<tool>` allow entries;
- new Codex and Zed sessions plus a reloaded Claude session discover all ten
  workflows.

There is no current `install --check` mode. Native listing and a real skill/MCP
smoke test are the verification path. Zed has no plugin-list CLI, so verify its
Skills and MCP Server pages and run `/cadre-status` in a native Zed Agent thread.

## 4.2.0 Verification Scope

Telemetry checks cover disclosure, persistent opt-out, environment precedence,
custom DSN isolation, direct MCP startup, live disabling, bounded delivery,
privacy allowlists, concurrent contexts, nested timing, and inventory counts.
A recording transport checks that disabled modes send no requests and raw data
cannot enter exported envelopes. Efficiency fixtures compare telemetry on/off
without extra Git processes or full validation passes.

Telemetry-enabled and Sentry-free self-contained packages are exercised on Node 18, 20,
and 22. Native installation checks cover Codex, Claude Code, and Zed discovery,
permissions, and MCP activation. The
[4.2.0 release validation record](https://github.com/dhivon-ai/cadre/blob/main/docs/development/cadre-4.2.0-release.md)
keeps the automated, native, and Sentry verification scopes distinct.

## 4.1.0 Verification Scope

Quick and unified Refresh passed 660 disposable-project protocol cases: 220 each
for Codex, Claude Code, and Zed identities. Live Codex sessions also exercised
Quick, combined context/pattern/track consolidation, active-track reseeding,
interrupted promotion, and recovery without candidate stages. Claude Code and
Zed were limited to protocol and installer coverage. This does not establish
native model execution coverage for those two clients.

The evidence and reproduction details are in
[the Quick and Refresh verification report](https://github.com/dhivon-ai/cadre/blob/main/docs/development/cadre-quick-refresh-verification.md).
The final 4.1.0 local validation record is maintained separately from those
preparation runs; a local version bump does not imply publication or deployment.

## 4.0.0 Verification Record

The local 4.0.0 implementation passed 480 harness tests, type checking, package
validation, pack dry run and the complete documentation check. A native Codex
fixture completed 14 fresh sessions covering brownfield setup, interrupted track
drafting, revision during implementation, review and remediation, manual product
changes invalidating clean completion, archive interruption/recovery and refresh.
Its 26 tests passed, including 200,020 arithmetic oracle comparisons. All nine
receipts had exactly one verified commit and historical evidence was preserved.

The native workflow test used Autonomous approval and sequential execution with
synthetic fixture approvals. It did not change global installations and does not
replace the three-client installer/discovery/activation gate above. The detailed
record is `docs/development/cadre-4.0.0-native-flow.md` in the source repository.
Final 4.0.0 user-scope installation and activation passed for all three clients.
Codex completed a fresh read-only status smoke test; Claude reported a connected
Cadre server; Zed showed all ten skills and an active server. Packaged MCP bytes
matched the tested build, and narrow Cadre approval settings were verified.
See `docs/development/cadre-4.0.0-release.md` for the release validation record.

## Release Sequence

1. Update runtime, package, and both plugin manifest versions together; Zed
   adapters inherit the package version from the shared payload.
2. Update docs package version and release notes.
3. Install with the locked workspace dependencies.
4. Run harness check, tests, validation, and package inspection.
5. Run the complete docs check.
6. Validate local-build installation against Codex, Claude, and Zed.
7. Stop and fix any installer, listing, discovery, MCP, permission, or version
   mismatch before creating or publishing the release.

Publishing, tagging, pushing, and external release creation require explicit
user authorization; local validation does not imply it.


## Stable Release Publishing

The `release.yml` workflow publishes only a published, non-prerelease GitHub
release to npm's `latest` channel. A tag push alone does not publish. Prepare
4.2.0 locally first; creating a tag, pushing, publishing a GitHub release, and
publishing to npm require explicit authorization.

For `cadre-ai`, configure the GitHub Actions trusted publisher with organization
`dhivon-ai`, repository `cadre`, and workflow filename `release.yml`. Leave the
environment name empty to match the current workflow, allow `npm publish`, and
leave dist-tag management disabled. The package repository URL must match
`https://github.com/dhivon-ai/cadre.git` for provenance. After a repository
transfer, replace the old npm trust connection; changing Git's `origin` alone
does not update npm's publishing authorization. No npm token belongs in the repository.

Store the public ingestion DSN in the `CADRE_SENTRY_DSN` repository Actions
secret. The release job supplies it as `CADRE_BUILD_SENTRY_DSN` on every rebuild,
including prepack. Missing, empty, or invalid values produce Sentry-free packages;
`CADRE_BUILD_TELEMETRY=none` forces that mode. The release gate exercises all
five configurations on Node 18/20/22 using a recording transport. Never commit
a real DSN or embed it in workflow YAML.

- Keep the runtime, harness/docs packages, and both plugin manifests at `4.2.0`.
  Complete the release gates and use the prepared 4.2.0 release notes.
- Use `release-4.2.0` for the stable release tag after authorization. The tag's
  version must exactly match the package; prerelease versions are rejected.
- The workflow checks the tag/version pair, runs harness checks, tests and
  package validation, then publishes with `--tag latest --provenance`.
- A separate job waits up to roughly 15 minutes for npm processing and verifies
  the channel. If it times out, retry only the failed verification job; do not
  republish or move the release tag.
- After npm verifies a `release-*` tag on `latest`, the workflow points the
  `release` branch at the published commit. Cloudflare Pages deploys the
  production documentation from that branch.
- Never move an existing release tag or reuse a published npm version. Fix a
  failed candidate and validate a new version when its contents need to change.

After publication, users install with `npm install -g cadre-ai@4.2.0` and run
the normal installer. For native installer validation without changing personal
installations, use a disposable home and client configuration directories for
all installer and client processes.
