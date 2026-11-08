import { HomePage } from "@/components/home/home-page"
import { getAllDocs } from "@/lib/docs"
import { StructuredData } from "@/components/structured-data"
import {
  HOME_TITLE,
  ORGANIZATION_ID,
  pageMetadata,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_ORIGIN,
  siteUrl,
} from "@/lib/seo"

export const metadata = {
  ...pageMetadata(HOME_TITLE, SITE_DESCRIPTION, "/"),
  title: { absolute: HOME_TITLE },
}

const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${siteUrl()}#website`,
  name: SITE_NAME,
  publisher: { "@id": ORGANIZATION_ID },
  // Google can use the canonical hostname if it cannot select a brand name.
  alternateName: ["Cadre", "cadre-ai", new URL(SITE_ORIGIN).hostname],
  url: siteUrl(),
  description: SITE_DESCRIPTION,
  inLanguage: "en",
  sameAs: [
    "https://github.com/dhivon-ai/cadre",
    "https://www.npmjs.com/package/cadre-ai",
  ],
}

export default function Page() {
  return (
    <>
      <StructuredData data={website} />
      <HomePage docs={getAllDocs()} />
    </>
  )
}
