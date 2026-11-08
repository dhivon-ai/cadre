---
title: Development
description: Work safely in the Cadre harness and documentation workspace.
section: Contribute
order: 170
---

# Development

This repository builds the Cadre package. It is not itself a Cadre-initialized
target project. Do not create a root `.cadre/` unless a fixture explicitly tests
project creation.

## Install The Workspace

```bash
pnpm install --frozen-lockfile
```

The root workspace contains `harness/` and `docs/`.

## Common Commands

```bash
pnpm check                         # Harness and docs checks
pnpm --filter cadre-ai check       # TypeScript only
pnpm --filter cadre-ai test        # Build and all harness tests
pnpm --filter cadre-ai validate    # Build and package-source validation
pnpm --filter cadre-ai build       # Build the two dist bundles
pnpm --filter cadre-docs check     # Content, lint, types, and static build
pnpm --filter cadre-docs dev       # Local documentation server
```

## Edit Source Files

Primary sources are:

- `harness/skills/*/SKILL.md` and `agents/openai.yaml`;
- `harness/agents/` worker definitions;
- `harness/src/domain/` and `harness/src/mcp/`;
- `harness/scripts/*.ts`;
- `harness/templates/v1/` through `v7/` (immutable history; excluded from release payloads), and active `harness/templates/v8/`;
- tracked plugin manifests, MCP configs, and marketplace catalogs;
- `harness/test/`;
- `docs/content/` and the docs application.

`harness/dist/` and `node_modules/` are generated and ignored. The installed
marketplace under `~/.cadre/marketplaces/cadre` is also generated. Never make a
source fix only in those outputs.

## TypeScript Conventions

- Read an existing file and its direct callers/tests/templates before editing.
- Normalize MCP and JSON input at boundaries.
- Prefer explicit interfaces, literal unions, and validation over broad
  business-logic `unknown` values.
- Keep the MCP server focused on registration and boundary schemas; move
  reusable behavior into the relevant capability module.
- Preserve atomic writes, stale-digest rejection, path safety, Git ancestry
  checks, and resumable checkpoints.
- Prefer cohesive modules. Avoid casually growing already-large files; split
  when a real capability boundary can be separated safely.

## Focused Tests

From `harness/`:

```bash
node --import tsx --test --test-name-pattern='<pattern>' test/harness.test.ts
node --import tsx --test test/cli.test.ts
```

Run focused coverage first, then the full harness check appropriate to the
change.

## Documentation Work

Markdown frontmatter, navigation membership, heading IDs, internal links,
workflow coverage, MCP tool coverage, and release version are checked by
`docs/scripts/check-content.mjs`. The site statically exports through Next.js.

When React components are touched, keep static data at module scope, reuse the
existing shadcn components, and avoid adding client-side state for content-only
changes.

### Search discovery and indexing

The production site is `https://cadre.dhivon.ai/`. The static build emits
`/sitemap.xml` from the documentation catalog and `/robots.txt` with its sitemap
location. Each page has a distinct canonical URL, title, description and social
metadata. The homepage includes WebSite structured data, and guides include
breadcrumbs matching the visible navigation. These improve discovery and
identification; they do not guarantee Google indexing or rankings.

After deployment, use a verified [Google Search Console](https://search.google.com/search-console/)
property covering `https://cadre.dhivon.ai/`. The documentation build does not
include a Google verification meta tag or HTML verification file.

Submit `https://cadre.dhivon.ai/sitemap.xml` in Search Console, inspect the
homepage and a guide, and request indexing. Use the Page Indexing report to
diagnose exclusions. npm's package page is outside this site's Search Console
property. See [Google's sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

Production canonicals remain on the production origin for preview builds; an
optional `NEXT_PUBLIC_BASE_PATH` is included consistently. Change `SITE_ORIGIN`
in `docs/lib/seo.ts` only as part of an intentional domain migration. Do not add
invented ratings, reviews or modification dates to search metadata.

## Release gates

Run frozen-lockfile installation, harness type checking, full tests, package validation, `pnpm --filter cadre-ai pack --dry-run`, and the documentation check. During local release preparation, label the versioned notes as pending publication. Create a tag or publish only after explicit authorization and all release gates pass.

Use disposable projects for native Claude and Codex workflow tests, including dirty-worktree revert preparation and fresh-session recovery. SDK client-identity tests cover wire compatibility but do not replace native activation. Before publishing, validate the packaged installer, enabled candidate version, narrow MCP approvals, and server activation in Codex, Claude Code, and Zed; Zed must discover all ten skills. Record absent or untested clients as incomplete gates. Personal-client installation and publication require their own authorization.

The 100-node aggregate benchmark compares current request/response bytes with a captured response-only baseline and resets retained context halfway through. This is a conservative retrieval comparison, not a before/after live-delivery token experiment. Report small-fixture overhead and client-reported usage separately.

## Telemetry Adapters And Sentry-Free Builds

**Since 4.2.0.** `harness/src/telemetry/runtime.ts` exposes vendor-neutral
operation, phase, counter, sanitized-error, observation, and bounded-flush APIs.
Request-local context isolates concurrent operations. Only `sentry.ts` imports
Sentry. The pinned `@sentry/node` 10.75.2 package is a build dependency; generated
runtime distributions need no production dependencies or `node_modules`.
No SDK management token, loader hook, profiling, or automatic instrumentation is
required. The adapter constructs allowlisted envelopes and uses an isolated transport;
global Sentry scopes and event processors cannot attach unrelated data. Bundled dependency licenses are in `dist/THIRD_PARTY_NOTICES.txt`.

By default, source builds omit Sentry. To include it, supply a valid HTTPS
public ingestion DSN through `CADRE_BUILD_SENTRY_DSN` in the build environment.
The release workflow maps the repository's `CADRE_SENTRY_DSN` GitHub Actions
secret into this variable. Never commit a real DSN or put one in a workflow literal.
Missing, empty, and invalid build values produce telemetry-free artifacts without
printing the value. The explicit exclusion below takes precedence even when a
build DSN is present.

```bash
CADRE_BUILD_TELEMETRY=none pnpm --filter cadre-ai build
CADRE_BUILD_TELEMETRY=none pnpm --filter cadre-ai pack --pack-destination /tmp
```

Keep the environment setting on commands that rebuild, including `prepack`.
The build resolves the adapter/defaults to no-op alternatives, excluding Sentry,
its dependencies, and the centralized DSN from generated runtime artifacts.
Telemetry controls still explain that collection is unavailable; runtime DSN
overrides cannot enable Sentry in these artifacts. An enabled distribution
necessarily contains its public ingestion DSN in the generated bundle, even
though source and Git history do not. Never supply a management token. For a source
fork, these module boundaries also allow deleting the Sentry adapter and removing
its build dependency without changing domain behavior. To send to your own
Sentry, changing the DSN is sufficient; replacing the provider requires only the
exporter interface, not changes throughout the MCP server.

Tests use a recording transport and temporary homes, never the centralized DSN.
For an intentional synthetic ingestion check only, first set `CADRE_SENTRY_DSN`
in your environment to the destination to verify:

```bash
pnpm --filter cadre-ai exec node --import tsx scripts/verify-telemetry.ts --send
```

This sends synthetic traces, errors, metrics, and inventory in `telemetry-test`.
It does not read a project. Keep production and test filters separate in the
[Cadre bottlenecks](https://dhivonai.sentry.io/dashboard/6577996/) dashboard. Use operation percentiles, phase timings and
error-code breakdowns; use distinct installation/project IDs for observed counts.
Inventory views must show timestamped observations, never sums of snapshots.

Package verification (missing/empty/invalid DSNs, explicit exclusion, enabled
builds, Node 18/20/22, recording transport):

```bash
pnpm --filter cadre-ai exec node --import tsx scripts/verify-telemetry-package.ts
```

Use `cadre_project_id` for Cadre's random project ID; Sentry's built-in
`project_id` identifies the Sentry ingestion project. Logs require typed columns
such as `tags[tracks_active,number]` and `tags[complete,boolean]`. This avoids
interpreting missing values as zero or counting the ingestion project as a user
project. The dashboard's global environment selector supports `production` and
`telemetry-test`; test events are synthetic and should be excluded from adoption
reporting.
