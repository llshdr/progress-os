'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, X, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateString } from '@/lib/date'
import type { Suggestion } from '@/lib/ai-coach/types'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ok'; items: Suggestion[] }

// Replaces the old slim teaser + dedicated /today page: suggestions are
// visible directly on the dashboard again. The single top suggestion (the
// pipeline's own existing "ordered by importance" order - no new sorting)
// renders prominently; the rest render as a compact secondary stack below.
// No reorder - that only mattered when suggestions were a dedicated page's
// entire content. Dismiss and Done both still write to the exact same
// tables the removed /today page used.
export default function TodaySuggestionsSection() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const supabase = createClient()

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setState({ status: 'loading' })

    try {
      const res = await fetch('/api/ai-coach/today')
      if (!res.ok) throw new Error('request failed')
      const data = await res.json()
      if (data.status !== 'ok') throw new Error('bad response')

      const suggestions: Suggestion[] = data.suggestions ?? []

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

      setState({ status: 'ok', items: suggestions.filter((s) => !dismissedKeys.has(s.key)) })
    } catch {
      setState({ status: 'error' })
    }
  }

  const handleDismiss = async (key: string) => {
    if (state.status !== 'ok') return
    setState({ status: 'ok', items: state.items.filter((s) => s.key !== key) })

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('dismissed_suggestions').upsert(
      { user_id: user.id, suggestion_key: key, dismissed_date: getLocalDateString() },
      { onConflict: 'user_id,suggestion_key,dismissed_date' }
    )
    if (error) console.error('Error dismissing suggestion:', error)
  }

  const handleDone = async (item: Suggestion) => {
    if (!item.sourceTable || !item.sourceId || state.status !== 'ok') return
    setState({ status: 'ok', items: state.items.filter((s) => s.key !== item.key) })

    const { error } = await supabase.from(item.sourceTable).update({ status: 'done' }).eq('id', item.sourceId)
    if (error) console.error('Error marking suggestion done:', error)
  }

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

      {state.status === 'ok' && state.items.length === 0 && (
        <p className="text-white/40 text-sm">Nothing urgent today — you&apos;re on track.</p>
      )}

      {state.status === 'ok' && state.items.length > 0 && (
        <div className="space-y-4">
          {/* Top suggestion - prominent */}
          {(() => {
            const top = state.items[0]
            const canMarkDone = Boolean(top.sourceTable && top.sourceId)
            return (
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-white/90 mb-1">{top.text}</p>
                  {top.action && (
                    <Link href={top.action.href} className="text-sm text-white/50 hover:text-white transition-colors">
                      {top.action.label} →
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {canMarkDone && (
                    <button
                      onClick={() => handleDone(top)}
                      className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors"
                      title="Mark done"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDismiss(top.key)}
                    className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors"
                    title="Dismiss for today"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })()}

          {/* Remaining suggestions - compact secondary stack */}
          {state.items.length > 1 && (
            <div className="space-y-2 pt-1 border-t border-white/5">
              {state.items.slice(1).map((item) => {
                const canMarkDone = Boolean(item.sourceTable && item.sourceId)
                return (
                  <div key={item.key} className="flex items-center justify-between gap-3 pt-2">
                    <p className="text-white/60 text-sm flex-1">{item.text}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      {canMarkDone && (
                        <button
                          onClick={() => handleDone(item)}
                          className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/50 transition-colors"
                          title="Mark done"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDismiss(item.key)}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/50 transition-colors"
                        title="Dismiss for today"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
