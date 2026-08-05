'use client'

import { useState, useEffect } from 'react'
import { TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { getLocalDateString } from '@/lib/date'
import { selectActiveMesocycle, type Mesocycle, type CurrentMesocycleStatus } from '@/lib/mesocycle'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ok'; active: CurrentMesocycleStatus | null }

const DEFAULT_LENGTH_WEEKS = 6

// Self-contained status card, same pattern as ScheduledVolumeCard - own
// state, own Supabase client, userId prop. "Start New Block" is always
// available, never gated on there being no active block already:
// starting one naturally supersedes an in-range older block via
// selectActiveMesocycle's own "latest start_date wins" tiebreak, so
// there's no separate "end this block early" action needed.
export default function MesocycleCard({ userId }: { userId: string }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [open, setOpen] = useState(false)
  const [startDate, setStartDate] = useState(getLocalDateString())
  const [lengthWeeks, setLengthWeeks] = useState(String(DEFAULT_LENGTH_WEEKS))
  const [includeDeload, setIncludeDeload] = useState(true)
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchAll()
  }, [userId])

  const fetchAll = async () => {
    setState({ status: 'loading' })
    const { data, error } = await supabase
      .from('training_mesocycles')
      .select('id, start_date, length_weeks, deload_week_number, label')
      .eq('user_id', userId)

    if (error) {
      console.error('Error fetching mesocycles:', error)
      setState({ status: 'error' })
      return
    }

    const mesocycles: Mesocycle[] = (data ?? []).map((r) => ({
      id: r.id,
      startDate: r.start_date,
      lengthWeeks: r.length_weeks,
      deloadWeekNumber: r.deload_week_number,
      label: r.label,
    }))

    setState({ status: 'ok', active: selectActiveMesocycle(mesocycles, getLocalDateString()) })
  }

  const resetForm = () => {
    setStartDate(getLocalDateString())
    setLengthWeeks(String(DEFAULT_LENGTH_WEEKS))
    setIncludeDeload(true)
    setLabel('')
  }

  const canSave = startDate.length > 0 && Number(lengthWeeks) >= 1 && Number(lengthWeeks) <= 16

  const handleStartBlock = async () => {
    if (!canSave) return

    setSaving(true)
    const weeks = Number(lengthWeeks)
    const { error } = await supabase.from('training_mesocycles').insert({
      user_id: userId,
      start_date: startDate,
      length_weeks: weeks,
      deload_week_number: includeDeload ? weeks : null,
      label: label.trim() || null,
    })
    setSaving(false)

    if (error) {
      console.error('Error starting mesocycle:', error)
      return
    }

    setOpen(false)
    resetForm()
    fetchAll()
  }

  const startBlockButton = (
    <DialogTrigger>
      <button className="px-4 py-2 rounded-xl bg-white text-black hover:bg-white/90 transition-colors text-sm font-medium">
        Start New Block
      </button>
    </DialogTrigger>
  )

  return (
    <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-white/40" />
        <h3 className="text-lg font-medium text-white">Training Block</h3>
      </div>

      {state.status === 'loading' && <p className="text-white/40 text-sm">Loading...</p>}
      {state.status === 'error' && <p className="text-white/40 text-sm">Couldn&apos;t load your training block right now.</p>}

      {state.status === 'ok' && (
        <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) resetForm() }}>
          {state.active ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-white font-medium">{state.active.mesocycle.label || 'Untitled block'}</p>
                  <p className="text-white/40 text-sm">
                    Week {state.active.currentWeek} of {state.active.mesocycle.lengthWeeks}
                  </p>
                </div>
                {state.active.isDeloadWeek ? (
                  <span className="px-2.5 py-1 rounded-full text-xs bg-white text-black font-medium">Deload week</span>
                ) : (
                  state.active.weeksUntilDeload != null && (
                    <span className="px-2.5 py-1 rounded-full text-xs bg-white/5 text-white/50 border border-white/10">
                      Deload in {state.active.weeksUntilDeload} week{state.active.weeksUntilDeload === 1 ? '' : 's'}
                    </span>
                  )
                )}
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-white transition-all duration-300"
                  style={{ width: `${Math.min((state.active.currentWeek / state.active.mesocycle.lengthWeeks) * 100, 100)}%` }}
                />
              </div>
              {startBlockButton}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-white/40 text-sm">No training block set up — entirely optional.</p>
              <p className="text-white/30 text-xs">
                Set a length and an optional deload week, and the AI Coach will factor it into its next-set recommendations.
              </p>
              {startBlockButton}
            </div>
          )}

          <DialogContent className="bg-black border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Start a Training Block</DialogTitle>
              <DialogDescription className="text-white/40">
                A planned length, with an optional deload week - the AI Coach factors this into its per-set recommendations, it
                doesn&apos;t generate a schedule of its own.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="meso-start-date" className="text-white/80">
                  Start date
                </Label>
                <Input
                  id="meso-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meso-length" className="text-white/80">
                  Length (weeks)
                </Label>
                <Input
                  id="meso-length"
                  type="number"
                  min={1}
                  max={16}
                  value={lengthWeeks}
                  onChange={(e) => setLengthWeeks(e.target.value)}
                  className="bg-white/5 border-white/10 text-white w-24"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-white/70">
                <input type="checkbox" checked={includeDeload} onChange={(e) => setIncludeDeload(e.target.checked)} />
                Include a deload in the final week
              </label>

              <div className="space-y-2">
                <Label htmlFor="meso-label" className="text-white/80">
                  Label (optional)
                </Label>
                <Input
                  id="meso-label"
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Hypertrophy block"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>

              <Button onClick={handleStartBlock} disabled={saving || !canSave} className="w-full bg-white text-black hover:bg-white/90">
                {saving ? 'Starting...' : 'Start Block'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
