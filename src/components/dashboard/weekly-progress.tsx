"use client"

import { cn } from "@/lib/utils"

type Day = {
  label: string
  /** 0–1 completion for the day. */
  value: number
  today?: boolean
}

interface WeeklyProgressProps {
  days: Day[]
}

/**
 * An elegant, minimal weekly progress visualization. Not a chart, not a table —
 * just seven calm vertical tracks that fill according to the day's completion.
 * The current day is subtly highlighted.
 */
export function WeeklyProgress({ days }: WeeklyProgressProps) {
  return (
    <div className="flex items-end justify-between gap-3 sm:gap-4">
      {days.map((day, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-3">
          <div className="relative flex h-32 w-full max-w-[3.5rem] items-end justify-center overflow-hidden rounded-full bg-muted/60">
            <div
              className={cn(
                "w-full rounded-full transition-[height] duration-700 ease-out",
                day.today ? "bg-primary" : "bg-foreground/25"
              )}
              style={{ height: `${Math.min(100, Math.max(4, day.value * 100))}%` }}
            />
          </div>
          <span
            className={cn(
              "text-xs font-medium tracking-wide",
              day.today ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {day.label}
          </span>
        </div>
      ))}
    </div>
  )
}
