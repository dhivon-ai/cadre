import Link from "next/link"
import { Brand } from "@/components/brand"

export function SiteFooter() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ""
  return (
    <footer className="border-t bg-muted/40">
      <div className="site-width flex flex-col gap-10 py-12">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
          <div>
            <Brand />
            <p className="mt-3 text-sm text-muted-foreground">
              Cadre, a product of Dhivon AI.
            </p>
          </div>
          <nav
            aria-label="Footer"
            className="flex flex-wrap gap-x-6 gap-y-4 text-sm font-medium"
          >
            <Link className="site-link" href="https://dhivon.ai/sitemap">
              Dhivon sites
            </Link>
            <Link className="site-link" href="/overview">
              Documentation
            </Link>
            <Link className="site-link" href="/team-and-polyrepo">
              Roadmap
            </Link>
            <Link
              className="site-link"
              href="https://github.com/dhivon-ai/cadre"
            >
              GitHub
            </Link>
            <Link
              className="site-link"
              href="https://www.npmjs.com/package/cadre-ai"
            >
              npm
            </Link>
            <Link className="site-link" href="/licensing">
              Licensing
            </Link>
          </nav>
        </div>
        <div className="flex flex-wrap justify-between gap-4 border-t pt-6 text-xs text-muted-foreground">
          <p>© 2026 Dhivon AI.</p>
          <p>
            <a className="site-link" href={`${basePath}/LICENSE.txt`}>
              Apache-2.0
            </a>{" "}
            ·{" "}
            <a className="site-link" href={`${basePath}/NOTICE.txt`}>
              Notices
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
