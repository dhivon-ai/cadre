# Cadre Docs Website

This directory is the Next.js App Router documentation site for Cadre inside the
root pnpm workspace. Markdown source lives in `content/`, the custom homepage
lives in `app/page.tsx`, and shared docs rendering/navigation lives in
`components/` and `lib/docs.ts`.

```bash
pnpm install
pnpm --filter cadre-docs dev
pnpm --filter cadre-docs lint
pnpm --filter cadre-docs typecheck
pnpm --filter cadre-docs build
```

Or from this directory:

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
```

Cloudflare Pages builds the static export from the `release` branch of
`dhivon-ai/cadre`. After npm confirms a stable `release-*` publication, the release
workflow force-updates that branch to the exact commit used for the package.
Tag pushes alone do not publish or update this branch. Treat `release` as a deployment pointer. Do not develop on it.

Configure the `cadre-docs` Pages project to build from the repository root:

- Production branch: `release`. Disable preview branch deployments for release-only builds.
- Build command: `pnpm --filter cadre-docs check` (includes the static build and export audit).
- Output directory: `docs/out`.
- Build environment: Node.js 22 and pnpm 11.4.0, matching the release workflow.

The Git integration handles deployment without Cloudflare credentials in GitHub.
The canonical site is [cadre.dhivon.ai](https://cadre.dhivon.ai/), served at the domain root.
Attach `cadre.dhivon.ai` as a custom domain on the existing `cadre-docs` Pages
project; the Pages project name does not change with the public domain. Set `NEXT_PUBLIC_BASE_PATH` only for a subpath.
To preview the export locally, run `pnpm preview:pages` from this directory.

## Content and search validation

`pnpm --filter cadre-docs check` validates content/navigation and version parity,
lints, type-checks, exports the site, then audits the rendered HTML with
`check:seo`. The export audit checks every page for unique titles/descriptions,
one H1, canonical URLs, social previews, JSON-LD, internal links and section
anchors, sitemap coverage, crawlable robots rules and a noindex 404.

Canonical URLs use `SITE_ORIGIN` in `lib/seo.ts` plus the configured base path.
Update that origin before deploying to a different canonical domain. Sitemap
and metadata share this URL builder. Dates are not fabricated at build time;
there is no artificial sitemap freshness claim.

Deployment and Google Search Console indexing remain separate from local
validation. Guidance follows [Google's SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
and [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

### Search results showing “Cloudflare”

The label above a result is Google's **site name**, separate from the page's
title. The homepage supplies `WebSite` JSON-LD with the preferred name
`Dhivon Cadre`, alternate brand names, and `cadre.dhivon.ai` as a fallback.
Every page also supplies `og:site_name` and a canonical URL. The export audit
checks the homepage identity and the articles' references to it.

Production hosting must consolidate the old Pages hostname as well. In the
Cloudflare account's **Bulk Redirects**, create a list entry and enable a rule
using that list:

| Setting | Value |
| --- | --- |
| Source URL | `cadre-docs.pages.dev` |
| Target URL | `https://cadre.dhivon.ai` |
| Status | `301` |
| Preserve query string | Enabled |
| Subpath matching | Enabled |
| Preserve path suffix | Enabled |
| Include subdomains | Disabled, to keep deployment previews separate |

This is account configuration, not part of the static build. Cloudflare's
Pages `_redirects` file does not support domain-level source matching; a
path-only catch-all would also redirect the canonical site back to itself.
Follow [Cloudflare's custom-domain redirect guide](https://developers.cloudflare.com/pages/how-to/redirect-to-custom-domain/).
Verify both `/` and `/overview/?source=redirect-check` on the old host return a
301 to the same path and query on the canonical host, and that the destination
returns the actual page without a redirect loop.

After deployment and redirect verification, use Google Search Console's URL
Inspection to test and request indexing for `https://cadre.dhivon.ai/` and
affected internal pages such as `/overview/`. Submit
`https://cadre.dhivon.ai/sitemap.xml` and confirm Google can fetch the actual
homepage rather than a hosting challenge or error. Keep these URLs crawlable
so Google can process the metadata and redirects.

[Google's site-name guidance](https://developers.google.com/search/docs/appearance/site-names)
explains that selection is automatic and recrawling can take days to weeks;
internal results may update after the homepage. Correct metadata does not
guarantee an immediate search-result change.

## Dhivon identity

The site is light-only, with self-hosted Manrope, the shared Dhivon wordmark,
navy text, and emerald accents. Assets live under `public/brand/`; this is a
local copy, with no build dependency on MCP Gateway. Preserve the font's OFL
notice. The previous `cadre-logo.png` and `cadre-mark.png` URLs serve the shared
identity for existing inbound image links.

`SiteHeader`, `SiteFooter`, and `Brand` share the site chrome. The homepage
introduces installation and first workflows; `/overview/` is the guide directory.
Navigation groups come from `navigation.json`. Preserve existing guide routes
and heading IDs when reorganizing content.

Legal downloads mirror the repository's `LICENSE` and `NOTICE`, with Dhivon AI
as the sole Cadre author and copyright attribution. The export audit checks their bytes, Dhivon publisher
metadata, the exact homepage title, and the 1200×630 social preview. Package
validation separately verifies notices in npm and the shared client payload.

The editable social-preview source is `assets/cadre-social.html`. Render it at
1200×630 with the bundled font loaded and capture at device scale 1 to update
`public/brand/cadre-social.png`. It is an asset source, not a public route.
