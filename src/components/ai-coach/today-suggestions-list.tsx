'use client'

import { ArrowUp, ArrowDown, X, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import type { Suggestion } from '@/lib/ai-coach/types'

interface TodaySuggestionsListProps {
  items: Suggestion[]
  onDismiss: (key: string) => void
  onMoveUp: (key: string) => void
  onMoveDown: (key: string) => void
  onDone: (item: Suggestion) => void
}

// The full interactive rendering of today's suggestions - dismiss, reorder,
// and (projects only) a real done action. Used only on the /today page; the
// dashboard card stays a slim read-only teaser.
export default function TodaySuggestionsList({ items, onDismiss, onMoveUp, onMoveDown, onDone }: TodaySuggestionsListProps) {
  if (items.length === 0) {
    return (
      <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center">
        <p className="text-white/40">Nothing urgent today — you&apos;re on track.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const canMarkDone = Boolean(item.sourceTable && item.sourceId)

        return (
          <div
            key={item.key}
            className="border border-white/10 rounded-2xl bg-white/[0.02] p-5 flex items-start justify-between gap-4"
          >
            <div className="flex-1">
              <p className="text-white/90 text-sm mb-1">{item.text}</p>
              {item.action && (
                <Link href={item.action.href} className="text-sm text-white/50 hover:text-white transition-colors">
                  {item.action.label} →
                </Link>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onMoveUp(item.key)}
                disabled={index === 0}
                className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
                title="Move up"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => onMoveDown(item.key)}
                disabled={index === items.length - 1}
                className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
                title="Move down"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              {canMarkDone && (
                <button
                  onClick={() => onDone(item)}
                  className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors"
                  title="Mark done"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => onDismiss(item.key)}
                className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors"
                title="Dismiss for today"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
