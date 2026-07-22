'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Sparkles } from 'lucide-react'
import Link from 'next/link'
import TodaySuggestionsList from '@/components/ai-coach/today-suggestions-list'
import TodayUpcomingList from '@/components/ai-coach/today-upcoming-list'
import type { Suggestion } from '@/lib/ai-coach/types'
import { fetchActiveActionItems, type ActionItem } from '@/lib/projects'
import { getLocalDateString } from '@/lib/date'

const UPCOMING_LOOKAHEAD = 3

function orderStorageKey(userId: string, today: string) {
  return `today-order-${userId}-${today}`
}

export default function TodayPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [upcoming, setUpcoming] = useState<ActionItem[]>([])
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set())
  const [orderedKeys, setOrderedKeys] = useState<string[]>([])

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    setUserId(user.id)

    const today = getLocalDateString()

    const [suggestionsRes, upcomingItems, dismissedRes] = await Promise.all([
      fetch('/api/ai-coach/today').then((r) => (r.ok ? r.json() : { status: 'error' })),
      fetchActiveActionItems(supabase, user.id),
      supabase.from('dismissed_suggestions').select('suggestion_key').eq('user_id', user.id).eq('dismissed_date', today),
    ])

    const fetchedSuggestions: Suggestion[] = suggestionsRes.status === 'ok' ? suggestionsRes.suggestions ?? [] : []
    setSuggestions(fetchedSuggestions)
    setUpcoming(upcomingItems.slice(0, UPCOMING_LOOKAHEAD))
    setDismissedKeys(new Set((dismissedRes.data ?? []).map((d) => d.suggestion_key)))

    // Restore any saved reorder preference, appending newly-seen keys at the
    // end and dropping ones that no longer exist in today's suggestions.
    const currentKeys = fetchedSuggestions.map((s) => s.key)
    let savedOrder: string[] = []
    try {
      const raw = localStorage.getItem(orderStorageKey(user.id, today))
      if (raw) savedOrder = JSON.parse(raw)
    } catch {
      savedOrder = []
    }
    const known = savedOrder.filter((k) => currentKeys.includes(k))
    const unknown = currentKeys.filter((k) => !known.includes(k))
    setOrderedKeys([...known, ...unknown])

    setLoading(false)
  }

  const persistOrder = (keys: string[]) => {
    if (!userId) return
    try {
      localStorage.setItem(orderStorageKey(userId, getLocalDateString()), JSON.stringify(keys))
    } catch {
      // localStorage can fail (private browsing, quota) - ordering just won't
      // persist across a refresh, which is a harmless degradation.
    }
  }

  const handleDismiss = async (key: string) => {
    if (!userId) return
    setDismissedKeys((prev) => new Set(prev).add(key))

    const { error } = await supabase.from('dismissed_suggestions').upsert(
      { user_id: userId, suggestion_key: key, dismissed_date: getLocalDateString() },
      { onConflict: 'user_id,suggestion_key,dismissed_date' }
    )
    if (error) console.error('Error dismissing suggestion:', error)
  }

  const handleMoveUp = (key: string) => {
    setOrderedKeys((prev) => {
      const index = prev.indexOf(key)
      if (index <= 0) return prev
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      persistOrder(next)
      return next
    })
  }

  const handleMoveDown = (key: string) => {
    setOrderedKeys((prev) => {
      const index = prev.indexOf(key)
      if (index === -1 || index >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      persistOrder(next)
      return next
    })
  }

  const handleDoneSuggestion = async (item: Suggestion) => {
    if (!item.sourceTable || !item.sourceId) return

    const { error } = await supabase.from(item.sourceTable).update({ status: 'done' }).eq('id', item.sourceId)
    if (error) {
      console.error('Error marking suggestion done:', error)
      return
    }

    setSuggestions((prev) => prev.filter((s) => s.key !== item.key))
  }

  const handleDoneUpcoming = async (item: ActionItem) => {
    const table = item.kind === 'goal' ? 'goals' : 'projects'
    const { error } = await supabase.from(table).update({ status: 'done' }).eq('id', item.id)
    if (error) {
      console.error('Error marking upcoming item done:', error)
      return
    }

    setUpcoming((prev) => prev.filter((u) => u.id !== item.id))
  }

  const visibleSuggestions = orderedKeys
    .map((key) => suggestions.find((s) => s.key === key))
    .filter((s): s is Suggestion => Boolean(s))
    .filter((s) => !dismissedKeys.has(s.key))

  const visibleUpcoming = upcoming.filter((item) => !dismissedKeys.has(`upcoming:${item.kind}:${item.id}`))

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-white/40">Loading...</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <Sparkles className="w-8 h-8 text-white/80" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">Today&apos;s Plan</h1>
            <p className="text-white/50 text-sm">{formattedDate}</p>
          </div>
        </div>

        <div className="mb-10">
          <h2 className="text-lg font-medium text-white mb-4">Suggestions</h2>
          <TodaySuggestionsList
            items={visibleSuggestions}
            onDismiss={handleDismiss}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onDone={handleDoneSuggestion}
          />
        </div>

        <div>
          <h2 className="text-lg font-medium text-white mb-4">Upcoming</h2>
          <TodayUpcomingList items={visibleUpcoming} onDismiss={handleDismiss} onDone={handleDoneUpcoming} />
        </div>
      </div>
    </AppLayout>
  )
}
