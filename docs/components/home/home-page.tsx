import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { WorkflowVisual } from "@/components/home/workflow-visual"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Button } from "@/components/ui/button"
import type { DocMeta } from "@/lib/docs"

const tasks = [
  {
    title: "Install for your client",
    description:
      "Connect Codex, Claude Code, or Zed. Reload, verify, and create your project context.",
    href: "/getting-started",
    action: "Install Cadre",
  },
  {
    title: "Make a bounded change",
    description:
      "Use Quick for a small fix, test, or documentation change with a verified outcome.",
    href: "/quickstart#choose-your-first-workflow",
    action: "Try Quick",
  },
  {
    title: "Plan a feature",
    description:
      "Approve a specification and dependency plan, then implement and review the work.",
    href: "/quickstart#2-create-a-feature-or-bug-track",
    action: "Start a track",
  },
  {
    title: "Maintain or recover",
    description:
      "Refresh context and learning, archive completed tracks, or resume interrupted work.",
    href: "/operations",
    action: "Maintain your project",
  },
]

export function HomePage({ docs }: { docs: DocMeta[] }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader docs={docs} />
      <main id="main-content" tabIndex={-1}>
        <section className="site-width grid items-center gap-14 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20 lg:py-24">
          <div>
            <p className="mb-6 text-sm font-semibold text-cadre-teal">
              Spec-driven AI workflows · Dhivon Cadre
            </p>
            <h1 className="max-w-3xl text-[clamp(3.25rem,6.3vw,5.5rem)] leading-[1.08] font-[750] tracking-[-0.045em]">
              Measure twice,
              <br />
              code once.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">
              Turn approved intent into verified, resumable work. Cadre brings
              project context, plans, and review to Codex, Claude Code, and Zed.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button
                className="h-13 px-6 text-base"
                render={<Link href="/getting-started" />}
              >
                Get started <ArrowRightIcon />
              </Button>
              <Button
                className="h-13 px-6 text-base"
                variant="outline"
                render={<Link href="/how-cadre-works" />}
              >
                How it works
              </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Open source · Local project state · Human approval
            </p>
          </div>
          <WorkflowVisual />
        </section>

        <section className="border-y bg-muted/50">
          <div className="site-width site-section">
            <p className="mb-4 text-sm font-semibold text-cadre-teal">
              From intent to evidence
            </p>
            <h2 className="site-heading max-w-3xl">
              A workflow you can inspect.
              <br />
              And pick up again.
            </h2>
            <ol className="mt-12 grid gap-8 md:grid-cols-4">
              {[
                [
                  "Approve context",
                  "Agree on the product, engineering rules, and project policy before delivery starts.",
                ],
                [
                  "Choose the scope",
                  "Use a planned track for substantial work or Quick for a bounded change.",
                ],
                [
                  "Verify the result",
                  "Keep checks, review evidence, and explicit completion approval with the work.",
                ],
                [
                  "Refresh together",
                  "Assess context and learning, update active seeds, and archive completed work.",
                ],
              ].map(([title, description], index) => (
                <li key={title} className="border-t pt-5">
                  <span className="text-sm font-semibold text-cadre-teal">
                    0{index + 1}
                  </span>
                  <h3 className="mt-4 text-xl font-semibold">{title}</h3>
                  <p className="mt-3 leading-7 text-muted-foreground">
                    {description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="site-width site-section">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <p className="mb-4 text-sm font-semibold text-cadre-teal">
                Your next step
              </p>
              <h2 className="site-heading">
                Start with
                <br />
                your task.
              </h2>
              <p className="mt-6 max-w-sm text-lg leading-8 text-muted-foreground">
                One shared workflow model across three coding clients. Choose
                the path that fits the work.
              </p>
            </div>
            <div>
              {tasks.map((task, index) => (
                <Link
                  key={task.href}
                  href={task.href}
                  className="group flex gap-5 border-t py-7 last:border-b"
                >
                  <span className="pt-1 text-sm text-cadre-teal">
                    0{index + 1}
                  </span>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold underline-offset-4 group-hover:underline">
                      {task.title}
                    </h3>
                    <p className="mt-2 leading-7 text-muted-foreground">
                      {task.description}
                    </p>
                    <p className="mt-4 flex items-center gap-2 text-sm font-semibold">
                      {task.action}
                      <ArrowRightIcon className="size-4" aria-hidden="true" />
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/50">
          <div className="site-width site-section grid gap-12 lg:grid-cols-2 lg:gap-24">
            <div>
              <p className="mb-4 text-sm font-semibold text-cadre-teal">
                Current capabilities
              </p>
              <h2 className="site-heading">
                Built around
                <br />
                approved work.
              </h2>
              <p className="mt-6 text-lg leading-8 text-muted-foreground">
                Durable journals, dependency-aware plans, isolated Git
                worktrees, and review gates keep delivery inspectable. Your
                client supplies the model; Cadre supplies the workflow.
              </p>
              <p className="mt-4 leading-7 text-muted-foreground">
                Version 4.1.0 adds Quick for bounded changes and unified Refresh
                for context, learning, and completed-track archival.
              </p>
              <Link
                className="site-link mt-6 inline-flex items-center gap-2 font-semibold"
                href="/release-notes"
              >
                Read the release notes <ArrowRightIcon className="size-4" />
              </Link>
            </div>
            <div className="lg:border-l lg:pl-12">
              <p className="mb-4 text-sm font-semibold text-muted-foreground">
                Roadmap · Coming soon
              </p>
              <h2 className="text-3xl leading-tight font-semibold tracking-tight">
                More ways to coordinate.
              </h2>
              <p className="mt-6 text-lg leading-8 text-muted-foreground">
                GitHub and GitLab coordination, a reusable knowledge base, and
                polyrepo support are planned. Each will be independently opt-in
                and disabled by default.
              </p>
              <p className="mt-4 leading-7 text-muted-foreground">
                These are future capabilities. Current Cadre workflows operate
                on the local repository and its approved project state.
              </p>
              <Link
                className="site-link mt-6 inline-flex items-center gap-2 font-semibold"
                href="/team-and-polyrepo"
              >
                Explore the roadmap <ArrowRightIcon className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
