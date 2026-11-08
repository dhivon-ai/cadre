import {
  ArrowDownIcon,
  NetworkIcon,
  PencilRulerIcon,
  RefreshCwIcon,
  ZapIcon,
} from "lucide-react"

export function WorkflowVisual() {
  return (
    <figure
      aria-label="Approved context branches into Track or Quick, then feeds into Refresh"
      className="rounded-lg border bg-card p-5 sm:p-6"
    >
      <div className="flex items-center gap-3 border-b pb-5">
        <PencilRulerIcon
          className="size-5 shrink-0 text-cadre-teal"
          aria-hidden="true"
        />
        <div>
          <p className="font-semibold">Create · approve the context</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Product intent, engineering rules, and workflow policy.
          </p>
        </div>
      </div>
      <div className="flex justify-center py-4">
        <ArrowDownIcon
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border p-4">
          <NetworkIcon
            className="mb-3 size-5 text-cadre-teal"
            aria-hidden="true"
          />
          <p className="font-semibold">Track</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Specify and plan.
            <br />
            Implement.
            <br />
            Verify and review.
          </p>
          <p className="mt-4 border-t pt-3 text-xs font-medium">
            Approved completion
          </p>
        </div>
        <div className="rounded-md border p-4">
          <ZapIcon className="mb-3 size-5 text-cadre-teal" aria-hidden="true" />
          <p className="font-semibold">Quick</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Bound the change.
            <br />
            Implement.
            <br />
            Verify the outcome.
          </p>
          <p className="mt-4 border-t pt-3 text-xs font-medium">
            Approved completion
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 py-4 text-xs leading-5 text-muted-foreground">
        <ArrowDownIcon className="size-4 shrink-0" aria-hidden="true" />
        <span>Track learning + quick outcomes + context changes</span>
      </div>
      <div className="rounded-md border bg-cadre-teal-soft p-4">
        <div className="flex items-center gap-2">
          <RefreshCwIcon className="size-5" aria-hidden="true" />
          <p className="font-semibold">Refresh</p>
        </div>
        <p className="mt-2 text-sm leading-6">
          Update context, consolidate learning, reassess active tracks, and
          archive completed work.
        </p>
        <p className="mt-3 text-xs font-semibold">
          One approval · one receipt · one commit
        </p>
      </div>
      <figcaption className="mt-4 text-xs leading-5 text-muted-foreground">
        Cadre 4.2.0 · Ten workflows
      </figcaption>
    </figure>
  )
}
