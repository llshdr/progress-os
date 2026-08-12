'use client'

import { AlertCircle } from 'lucide-react'

interface LoadErrorBannerProps {
  message?: string
}

// Same inline-warning treatment as the offline banner in set-logger.tsx
// (border/bg/text all on lapis-garnet) - a visible notice instead of a
// silent console.error that leaves a page looking like an honest "no
// data" empty state when a fetch actually failed.
export function LoadErrorBanner({ message = "Couldn't load this page's data. Try refreshing." }: LoadErrorBannerProps) {
  return (
    <div className="flex items-center gap-2 border border-lapis-garnet/40 bg-lapis-garnet/[0.06] rounded-lapis-md px-4 py-3 text-sm text-lapis-garnet mb-6">
      <AlertCircle className="w-4 h-4 shrink-0" />
      {message}
    </div>
  )
}
