import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"

export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Dhivon Cadre home"
      className={cn(
        "flex min-h-11 shrink-0 items-center gap-2 sm:gap-3",
        className
      )}
    >
      <Image
        src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/brand/dhivon.svg`}
        alt=""
        width={142}
        height={44}
        className="h-auto w-[100px] sm:w-[142px]"
        priority
      />
      <span className="border-l border-border pl-2 text-sm font-semibold text-cadre-ink sm:pl-3 sm:text-base">
        Cadre
      </span>
    </Link>
  )
}
