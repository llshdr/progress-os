'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, X, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateString } from '@/lib/date'
import type { Suggestion } from '@/lib/ai-coach/types'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ok'; items: Suggestion[] }

// Shared by Today (one suggestion) and Coach (the full list).
// Dismiss/complete actions only disappear after a successful write.
export default function TodaySuggestionsSection({ limit }: { limit?: number } = {}) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [pending, setPending] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
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
    if (state.status !== 'ok' || pending) return
    setPending(key)
    setActionError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sign in required')
      const { error } = await supabase.from('dismissed_suggestions').upsert(
        { user_id: user.id, suggestion_key: key, dismissed_date: getLocalDateString() },
        { onConflict: 'user_id,suggestion_key,dismissed_date' }
      )
      if (error) throw error
      setState(current => current.status === 'ok' ? { ...current, items: current.items.filter(s => s.key !== key) } : current)
    } catch { setActionError('Could not dismiss this suggestion. Please try again.') }
    finally { setPending(null) }
  }

  const handleDone = async (item: Suggestion) => {
    if (!item.sourceTable || !item.sourceId || state.status !== 'ok' || pending) return
    setPending(item.key)
    setActionError(null)
    try {
      const { error } = await supabase.from(item.sourceTable).update({ status: 'done' }).eq('id', item.sourceId)
      if (error) throw error
      setState(current => current.status === 'ok' ? { ...current, items: current.items.filter(s => s.key !== item.key) } : current)
    } catch { setActionError('Could not mark this done. Please try again.') }
    finally { setPending(null) }
  }

  return (
    <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-lapis-accent-400" />
        <h3 className="text-lg font-medium text-lapis-text-primary">Today&apos;s Suggestions</h3>
      </div>

      {actionError && <p role="alert" className="mb-3 text-sm text-lapis-text-secondary">{actionError}</p>}
      {state.status === 'loading' && (
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-lapis-surface-2 rounded w-3/4"></div>
          <div className="h-4 bg-lapis-surface-2 rounded w-2/3"></div>
        </div>
      )}

      {state.status === 'error' && (
        <div><p className="text-lapis-text-secondary text-sm">Couldn&apos;t load today&apos;s suggestions.</p><button onClick={load} className="mt-2 min-h-11 text-sm text-lapis-accent-400">Try again</button></div>
      )}

      {state.status === 'ok' && state.items.length === 0 && (
        <p className="text-lapis-text-tertiary text-sm">Nothing urgent today — you&apos;re on track.</p>
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
                  <p className="text-lapis-text-primary mb-1">{top.text}</p>
                  {top.action && (
                    <Link href={top.action.href} className="text-sm text-lapis-text-tertiary hover:text-lapis-text-primary transition-colors">
                      {top.action.label} →
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {canMarkDone && (
                    <button
                      disabled={pending !== null}
                      onClick={() => handleDone(top)}
                      className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors"
                      title="Mark done"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    disabled={pending !== null}
                    onClick={() => handleDismiss(top.key)}
                    className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors"
                    title="Dismiss for today"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })()}

          {/* Remaining suggestions - compact secondary stack */}
          {state.items.length > 1 && limit !== 1 && (
            <div className="space-y-2 pt-1 border-t border-lapis-border-subtle">
              {state.items.slice(1, limit).map((item) => {
                const canMarkDone = Boolean(item.sourceTable && item.sourceId)
                return (
                  <div key={item.key} className="flex items-center justify-between gap-3 pt-2">
                    <p className="text-lapis-text-secondary text-sm flex-1">{item.text}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      {canMarkDone && (
                        <button
                          disabled={pending !== null}
                      onClick={() => handleDone(item)}
                          className="p-1.5 rounded-lapis-sm hover:bg-lapis-surface-2 text-lapis-text-disabled hover:text-lapis-text-tertiary transition-colors"
                          title="Mark done"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        disabled={pending !== null}
                    onClick={() => handleDismiss(item.key)}
                        className="p-1.5 rounded-lapis-sm hover:bg-lapis-surface-2 text-lapis-text-disabled hover:text-lapis-text-tertiary transition-colors"
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
