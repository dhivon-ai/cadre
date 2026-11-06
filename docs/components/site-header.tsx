import Link from "next/link"
import type { ReactNode } from "react"
import { MenuIcon } from "lucide-react"
import { Brand } from "@/components/brand"
import { SearchCommand } from "@/components/search-command"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { DocMeta } from "@/lib/docs"

const links = [
  { href: "/how-cadre-works", label: "How it works" },
  { href: "/overview", label: "Documentation" },
  { href: "/team-and-polyrepo", label: "Roadmap" },
]

export function SiteHeader({
  docs,
  mobileNavigation,
}: {
  docs: DocMeta[]
  mobileNavigation?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-background focus:p-3"
      >
        Skip to content
      </a>
      <div className="site-width flex min-h-24 items-center gap-3 py-4 sm:gap-6">
        <Brand />
        <nav
          aria-label="Main navigation"
          className="ml-auto hidden items-center gap-7 text-sm font-semibold xl:flex"
        >
          {links.map(({ href, label }) => (
            <Link key={href} href={href} className="site-link">
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 xl:ml-0">
          <SearchCommand docs={docs} mode="responsive" />
          <Button
            className="hidden h-12 px-5 xl:inline-flex"
            render={<Link href="/getting-started" />}
          >
            Get started
          </Button>
          {mobileNavigation ?? (
            <Sheet>
              <SheetTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-lg"
                    className="size-11 xl:hidden"
                    aria-label="Open site navigation"
                  />
                }
              >
                <MenuIcon />
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(90vw,22rem)]">
                <SheetHeader>
                  <SheetTitle>Dhivon Cadre</SheetTitle>
                  <SheetDescription>Choose your next step.</SheetDescription>
                </SheetHeader>
                <nav
                  aria-label="Mobile navigation"
                  className="flex flex-col gap-1 px-4"
                >
                  {[
                    ...links,
                    { href: "/getting-started", label: "Get started" },
                    { href: "/quickstart", label: "First workflow" },
                  ].map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className="rounded-md px-3 py-4 hover:bg-muted"
                    >
                      {label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </header>
  )
}
