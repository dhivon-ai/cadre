# Cadre 4.1.0 local release preparation — 6 November 2026

This records local preparation of the stable 4.1.0 package. No new tag, push,
GitHub release, npm publication, deployment, or live-client installation was
performed. Existing tags and remote state were preserved. The release notes
remain marked **Pending publication**.

## Candidate contents

- Runtime, npm package, docs package, and Codex/Claude plugin manifests: 4.1.0.
- Ten workflows, 21 MCP tools, and active template set v8.
- Quick delivery and unified Refresh context/learning/archival with one approval,
  receipt, and commit; historical approved archive operations remain recoverable.
- Existing 3.9.0/3.9.1/3.9.2 and 4.0.0 schema-2 projects remain supported. The
  upgrade bridge reports the current runtime version rather than a stale target.
- Stable GitHub release publication only, using the existing `release.yml`
  trusted publisher for `dhivon-ai/cadre`. Tag pushes do not publish.
- Current documentation and package metadata point to `cadre.dhivon.ai` and
  `github.com/dhivon-ai/cadre`. Historical integration maturity descriptions
  remain historical; retired release-channel terminology is removed.
- Shared Dhivon wordmark, navy/emerald palette, self-hosted Manrope, and light-only
  homepage and documentation. The homepage leads to installation and first work;
  the guide directory and five task-oriented navigation groups retain public routes.
- Exact homepage title: “Dhivon AI: Cadre - Spec-driven AI workflows for Codex,
  Claude Code and Zed.” Dhivon publisher structured data and a 1200×630 social image.
- Apache-2.0 across repository, npm, and assembled client payloads. Dhivon AI
  is the sole Cadre author and copyright attribution.
  Manrope retains its unchanged OFL notice. Public legal downloads match source bytes.

The immutable template directories and third-party lockfile are unchanged.
No root `.cadre/` project was initialized in this harness repository.

## Local validation

- `pnpm install --frozen-lockfile`: passed.
- `pnpm --filter cadre-ai check`: passed.
- Focused release-channel and project-format tests: 41 passed, no failures or skips.
- `pnpm --filter cadre-ai validate`: passed; all ten workflows, three client
  integrations, templates, and package identity verified.
- `pnpm --filter cadre-ai pack --dry-run`: passed for `cadre-ai@4.1.0`.
- `pnpm --filter cadre-docs check`: passed; 25 exported pages and 1,642 internal
  links, plus content, lint, types, canonical metadata, publisher JSON-LD, sitemap,
  robots, legal-download bytes, social image dimensions, and exact homepage title.
- All 301 pre-redesign guide anchors remain available. A checked-in anchor fixture
  now protects the existing routes and fragments in the export audit.
- Chrome testing at 1440px desktop and 390px/320px mobile: homepage, guide directory,
  installation, Quickstart, search navigation, command tabs, copy control, mobile
  navigation, table of contents, and workflow diagram rendering verified. Narrow
  header and long inline-code overflow found at 320px were corrected.
- Dark OS preference retains white/navy light-only rendering; browser error/warning
  logs were empty. Dhivon wordmark/font assets were reused directly from MCP Gateway.
- Focused package/installer tests: 3 passed, including byte-identical legal notices
  in the shared payload used by Codex, Claude, and Zed. The final attribution
  adjustment was verified again with these focused tests and package validation.
- `git diff --check`: passed.

The final `pnpm --filter cadre-ai test` run passed **532 tests**, with zero
failures, cancellations, or skips. The initial full run exposed one stale test
expectation for the old upgrade target; it was corrected to use the runtime
version, its focused rerun passed, and the complete suite then passed.
The complete 532-test suite passed again after the Dhivon packaging changes.
Current command logs use `/tmp/cadre-dhivon-*.log` on the validation machine;
the earlier version-preparation logs remain under `/tmp/cadre-410-*.log`.

## Earlier implementation evidence and remaining publication gates

The [Quick and Refresh verification report](cadre-quick-refresh-verification.md)
records 660 protocol cases and live Codex delivery/recovery on the pre-versioned
implementation. Those cases were not relabelled as a new full matrix run on
4.1.0. Claude Code and Zed coverage remains protocol/installer coverage, not
native model execution.

Before actual publication, complete the repository's final native installation
and activation gates at the candidate version, review the final committed source,
and obtain explicit authorization for tagging, pushing, publishing, and deployment.
Live clients were intentionally not changed during this local preparation.

## Final release authorization — 6 November 2026

After the local preparation above, the maintainer authorized committing and
pushing to `main` and creating the final 4.1.0 release. Public notes and website
copy now describe 4.1.0 as the current release. At the maintainer's request, no
fresh local check or live-client installation run is required for this step;
the already-completed validation above is retained. A newly started redundant
test run was stopped. GitHub Actions retains its configured publication checks.

The release uses tag `release-4.1.0`, npm's `latest` channel, and the existing
post-publication update of the `release` deployment branch.
