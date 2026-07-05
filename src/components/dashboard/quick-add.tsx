"use client"

import { useEffect, useState } from "react"
import { ArrowUp, Command } from "lucide-react"

import { cn } from "@/lib/utils"

const EXAMPLES = [
  "67.8kg",
  "Bench 82.5 x 8",
  "Ran 6km in 42 min",
  "Finished editing intro",
]

/**
 * A calm, natural-language capture box. Purely presentational for now —
 * parsing is intentionally not implemented. The placeholder gently cycles
 * through example inputs to hint at future capability.
 */
export function QuickAdd() {
  const [value, setValue] = useState("")
  const [exampleIndex, setExampleIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setExampleIndex((i) => (i + 1) % EXAMPLES.length)
    }, 3200)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-2xl border border-border/80 bg-card/60 px-5 py-4",
        "shadow-sm backdrop-blur transition-all duration-300 ease-out",
        "focus-within:border-primary/50 focus-within:bg-card focus-within:shadow-md focus-within:shadow-primary/10"
      )}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Log anything — e.g. ${EXAMPLES[exampleIndex]}`}
        className={cn(
          "flex-1 bg-transparent text-base text-foreground outline-none",
          "placeholder:text-muted-foreground placeholder:transition-opacity"
        )}
      />
      <kbd className="hidden items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-1 text-xs text-muted-foreground sm:flex">
        <Command className="size-3" />K
      </kbd>
      <div
        className={cn(
          "flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-all duration-300",
          value.trim() && "bg-primary text-primary-foreground"
        )}
      >
        <ArrowUp className="size-4" />
      </div>
    </div>
  )
}
