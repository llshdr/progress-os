'use client'

import { X, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import type { ActionItem } from '@/lib/projects'

interface TodayUpcomingListProps {
  items: ActionItem[]
  onDismiss: (key: string) => void
  onDone: (item: ActionItem) => void
}

// Widened lookahead beyond the single most-urgent projects/goals suggestion
// - the next few active items by the same target_date-then-staleness sort
// the actionmaxxing dashboard already uses. Read via fetchActiveActionItems
// directly, independent of the AI suggestions pipeline.
export default function TodayUpcomingList({ items, onDismiss, onDone }: TodayUpcomingListProps) {
  if (items.length === 0) {
    return (
      <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-8 text-center">
        <p className="text-white/40 text-sm">No active goals or projects to look ahead to.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.editHref}
          className="border border-white/10 rounded-2xl bg-white/[0.02] p-5 flex items-start justify-between gap-4"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10">
                {item.kind === 'goal' ? 'Goal' : 'Project'}
              </span>
              <Link href={item.editHref} className="text-white font-medium hover:text-white/80 transition-colors">
                {item.title}
              </Link>
            </div>
            <p className="text-white/60 text-sm">
              <span className="text-white/40">Next: </span>
              {item.nextAction || <span className="text-white/30 italic">not set</span>}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onDone(item)}
              className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors"
              title="Mark done"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDismiss(`upcoming:${item.kind}:${item.id}`)}
              className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors"
              title="Dismiss for today"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
