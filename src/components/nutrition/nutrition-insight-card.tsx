'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not_enough_data' }
  | { status: 'ok'; text: string }

// Re-fetches whenever `refreshKey` changes (e.g. after a new entry is logged)
// — the API route itself is cached server-side, so this doesn't cause extra
// Gemini calls unless the underlying data actually changed.
export default function NutritionInsightCard({ refreshKey }: { refreshKey: number }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    fetch('/api/ai-coach/nutrition-insight')
      .then(async (res) => {
        if (!res.ok) throw new Error('request failed')
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        if (data.status === 'ok') {
          setState({ status: 'ok', text: data.text })
        } else if (data.status === 'not_enough_data') {
          setState({ status: 'not_enough_data' })
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
  }, [refreshKey])

  return (
    <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-white/40" />
        <h3 className="text-lg font-medium text-white">AI Insight</h3>
      </div>

      {state.status === 'loading' && <p className="text-white/40 text-sm">Analyzing your trend...</p>}

      {state.status === 'not_enough_data' && (
        <p className="text-white/40 text-sm">Log a few more days to unlock a trend insight.</p>
      )}

      {state.status === 'error' && (
        <p className="text-white/40 text-sm">Couldn&apos;t generate an insight right now. Try again later.</p>
      )}

      {state.status === 'ok' && <p className="text-white/80 text-sm">{state.text}</p>}
    </div>
  )
}
