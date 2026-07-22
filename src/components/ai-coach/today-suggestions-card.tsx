'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateString } from '@/lib/date'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ok'; count: number }

// Slim dashboard teaser — the full interactive list (dismiss/reorder/done)
// lives on the dedicated /today page, not here.
export default function TodaySuggestionsCard() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const supabase = createClient()

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch('/api/ai-coach/today')
        if (!res.ok) throw new Error('request failed')
        const data = await res.json()
        if (data.status !== 'ok') throw new Error('bad response')
        if (cancelled) return

        const suggestions: { key: string }[] = data.suggestions ?? []

        const {
          data: { user },
        } = await supabase.auth.getUser()

        let dismissedKeys = new Set<string>()
        if (user) {
          const { data: dismissed } = await supabase
            .from('dismissed_suggestions')
            .select('suggestion_key')
            .eq('user_id', user.id)
            .eq('dismissed_date', getLocalDateString())

          dismissedKeys = new Set((dismissed ?? []).map((d) => d.suggestion_key))
        }

        if (cancelled) return
        const count = suggestions.filter((s) => !dismissedKeys.has(s.key)).length
        setState({ status: 'ok', count })
      } catch {
        if (!cancelled) setState({ status: 'error' })
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Link href="/today">
      <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all duration-200">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-white/60" />
            <div>
              <h3 className="text-lg font-medium text-white">Today's Plan</h3>
              {state.status === 'loading' && <p className="text-white/40 text-sm">Loading...</p>}
              {state.status === 'error' && <p className="text-white/40 text-sm">Couldn&apos;t load today&apos;s plan</p>}
              {state.status === 'ok' && (
                <p className="text-white/40 text-sm">
                  {state.count === 0
                    ? "Nothing urgent today — you're on track."
                    : `${state.count} thing${state.count === 1 ? '' : 's'} need attention today`}
                </p>
              )}
            </div>
          </div>
          <span className="text-white/40 text-sm shrink-0">View your day →</span>
        </div>
      </div>
    </Link>
  )
}
