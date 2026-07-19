'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import type { Suggestion } from '@/lib/ai-coach/types'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ok'; suggestions: Suggestion[] }

export default function TodaySuggestionsCard() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    fetch('/api/ai-coach/today')
      .then(async (res) => {
        if (!res.ok) throw new Error('request failed')
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        if (data.status === 'ok') {
          setState({ status: 'ok', suggestions: data.suggestions ?? [] })
        } else {
          setState({ status: 'error' })
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-white/60" />
        <h3 className="text-lg font-medium text-white">Today&apos;s Suggestions</h3>
      </div>

      {state.status === 'loading' && (
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-white/5 rounded w-3/4"></div>
          <div className="h-4 bg-white/5 rounded w-2/3"></div>
        </div>
      )}

      {state.status === 'error' && (
        <p className="text-white/40 text-sm">Couldn&apos;t load today&apos;s suggestions. Try again later.</p>
      )}

      {state.status === 'ok' && state.suggestions.length === 0 && (
        <p className="text-white/40 text-sm">Nothing urgent today — you&apos;re on track.</p>
      )}

      {state.status === 'ok' && state.suggestions.length > 0 && (
        <div className="space-y-3">
          {state.suggestions.map((s, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-4 border-b border-white/5 pb-3 last:border-0 last:pb-0"
            >
              <p className="text-white/80 text-sm">{s.text}</p>
              {s.action && (
                <Link
                  href={s.action.href}
                  className="shrink-0 text-sm text-white/50 hover:text-white transition-colors"
                >
                  {s.action.label} →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
