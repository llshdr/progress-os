import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A minimal, elegant progress bar. No numbers baked in — just an intentional
 * track and fill with a calm easing animation. Meant for the premium,
 * low-noise Progress OS aesthetic.
 */
function ProgressBar({
  value,
  className,
  trackClassName,
  ...props
}: React.ComponentProps<"div"> & {
  value: number
  trackClassName?: string
}) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div
      data-slot="progress-bar"
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", trackClassName)}
      {...props}
    >
      <div
        className={cn(
          "h-full rounded-full bg-primary transition-[width] duration-700 ease-out",
          className
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export { ProgressBar }
