'use client'

import { useState, useEffect } from 'react'
import { TrendingDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { getLocalDateString } from '@/lib/date'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ok'; activeSince: string | null }

// Replaces MesocycleCard's whole "Start New Block" dialog (start date,
// length, deload-week checkbox, label) - an ad-hoc deload needs none of
// that. Starting means "starting today," ending means "ending today,"
// so this is a single button with no form/dialog at all - see migration
// 083 for the schema and full reasoning.
export default function DeloadCard({ userId }: { userId: string }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchStatus()
  }, [userId])

  const fetchStatus = async () => {
    setState({ status: 'loading' })
    const { data, error } = await supabase
      .from('user_settings')
      .select('active_deload_started_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching deload status:', error)
      setState({ status: 'error' })
      return
    }

    setState({ status: 'ok', activeSince: data?.active_deload_started_at ?? null })
  }

  const handleStart = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, active_deload_started_at: getLocalDateString() }, { onConflict: 'user_id' })
    setSaving(false)

    if (error) {
      console.error('Error starting deload:', error)
      return
    }
    fetchStatus()
  }

  const handleEnd = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, active_deload_started_at: null }, { onConflict: 'user_id' })
    setSaving(false)

    if (error) {
      console.error('Error ending deload:', error)
      return
    }
    fetchStatus()
  }

  return (
    <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingDown className="w-4 h-4 text-lapis-text-tertiary" />
        <h3 className="text-lg font-medium text-lapis-text-primary">Deload</h3>
      </div>

      {state.status === 'loading' && <p className="text-lapis-text-tertiary text-sm">Loading...</p>}
      {state.status === 'error' && <p className="text-lapis-text-tertiary text-sm">Couldn&apos;t load your deload status right now.</p>}

      {state.status === 'ok' &&
        (state.activeSince ? (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-lapis-text-primary font-medium">Deload active</p>
              <p className="text-lapis-text-tertiary text-sm">
                Since {new Date(state.activeSince + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - the AI Coach is
                suggesting ~50% weight, normal reps and sets.
              </p>
            </div>
            <Button onClick={handleEnd} disabled={saving} variant="outline" className="border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2">
              {saving ? 'Ending...' : 'End Deload'}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-lapis-text-tertiary text-sm">
              Any length, start and end whenever - a single day or a full week. The AI Coach cuts recommended weight to ~50% while it&apos;s active.
            </p>
            <Button onClick={handleStart} disabled={saving} className="bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 shrink-0">
              {saving ? 'Starting...' : 'Start Deload'}
            </Button>
          </div>
        ))}
    </div>
  )
}
