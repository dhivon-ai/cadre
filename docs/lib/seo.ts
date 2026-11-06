import type { Metadata } from "next"

export const SITE_NAME = "Dhivon Cadre"
export const SITE_ORIGIN = "https://cadre.dhivon.ai"
export const HOME_TITLE =
  "Dhivon AI: Cadre - Spec-driven AI workflows for Codex, Claude Code and Zed."
export const SITE_DESCRIPTION =
  "Cadre by Dhivon AI brings spec-driven workflows to Codex, Claude Code and Zed. Install cadre-ai, approve context, and deliver verified, resumable work."

// Match next.config.ts when exporting the documentation under a base path.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ""

export function siteUrl(path = "/") {
  return new URL(`${basePath}${path}`, SITE_ORIGIN).href
}

export function pageMetadata(
  title: string,
  description: string,
  path: string
): Metadata {
  const displayTitle = path === "/" ? title : `${title} | Dhivon Cadre`
  return {
    title,
    description,
    alternates: { canonical: siteUrl(path) },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      title: displayTitle,
      description,
      url: siteUrl(path),
      images: [
        {
          url: siteUrl("/brand/cadre-social.png"),
          width: 1200,
          height: 630,
          alt: "Dhivon Cadre — Measure twice, code once.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: displayTitle,
      description,
      images: [
        {
          url: siteUrl("/brand/cadre-social.png"),
          alt: "Dhivon Cadre — Measure twice, code once.",
        },
      ],
    },
  }
}

export const ORGANIZATION_ID = "https://dhivon.ai/#organization"
export const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: "Dhivon AI",
  url: "https://dhivon.ai",
  logo: siteUrl("/brand/dhivon.svg"),
  sameAs: ["https://github.com/dhivon-ai"],
}
