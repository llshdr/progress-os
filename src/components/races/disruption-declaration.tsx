'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DISRUPTION_GUIDANCE } from '@/lib/race-plan/race-day-prep'

export type DisruptionReason = 'travel' | 'illness' | 'other'

export interface TrainingDisruption {
  id: string
  start_date: string
  end_date: string
  reason: DisruptionReason
  note: string | null
}

interface Props {
  disruptions: TrainingDisruption[]
  onChanged: () => void
}

const REASON_OPTIONS: { value: DisruptionReason; label: string }[] = [
  { value: 'travel', label: 'Travel' },
  { value: 'illness', label: 'Illness' },
  { value: 'other', label: 'Other' },
]

export function formatDateRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const startLabel = new Date(start + 'T00:00:00').toLocaleDateString('en-US', opts)
  const endLabel = new Date(end + 'T00:00:00').toLocaleDateString('en-US', opts)
  return start === end ? startLabel : `${startLabel} - ${endLabel}`
}

// Declared, user-level disruptions (travel/illness/other) - shared
// across every race, not race-specific (see migration 057). Excludes
// overlapping weeks from the benchmark compliance flag
// (benchmark-verification.ts) without touching real fitness-tier
// derivation, which stays honest to logged activity regardless of why
// a gap exists - see current-form.ts, deliberately untouched.
export default function DisruptionDeclaration({ disruptions, onChanged }: Props) {
  const [open, setOpen] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState<DisruptionReason>('travel')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setStartDate('')
      setEndDate('')
      setReason('travel')
      setNote('')
    }
  }

  const handleSave = async () => {
    if (!startDate || !endDate) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setSaving(true)
    const { error } = await supabase.from('training_disruptions').insert({
      user_id: user.id,
      start_date: startDate,
      end_date: endDate,
      reason,
      note: note.trim() || null,
    })
    setSaving(false)
    if (error) {
      console.error('Error declaring training disruption:', error)
      return
    }
    setOpen(false)
    onChanged()
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('training_disruptions').delete().eq('id', id)
    if (error) {
      console.error('Error deleting training disruption:', error)
      return
    }
    onChanged()
  }

  return (
    <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-medium text-white">Training Disruptions</h2>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger>
            <button className="text-xs text-white/40 hover:text-white/60 transition-colors underline underline-offset-2">Declare a disruption</button>
          </DialogTrigger>
          <DialogContent className="bg-black border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Declare a disruption</DialogTitle>
              <DialogDescription className="text-white/40">
                Travel, illness, or anything else that pauses or limits training - before it starts or after the fact. This won&apos;t affect your
                real fitness tracking, just keeps the plan from flagging a gap you already know about.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="disruption-start" className="text-white/80">
                    Start date
                  </Label>
                  <Input
                    id="disruption-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="disruption-end" className="text-white/80">
                    End date
                  </Label>
                  <Input
                    id="disruption-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || undefined}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Reason</Label>
                <div className="flex gap-2">
                  {REASON_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setReason(opt.value)}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        reason === opt.value ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">What&apos;s still possible? (optional)</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. can do bodyweight strength, no swim/bike/run"
                  rows={2}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
                />
              </div>
              <Button onClick={handleSave} disabled={saving || !startDate || !endDate} className="w-full bg-white text-black hover:bg-white/90">
                {saving ? 'Saving...' : 'Declare'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {disruptions.length === 0 ? (
        <p className="text-white/40 text-sm">None declared.</p>
      ) : (
        <div className="space-y-3">
          {disruptions.map((d) => (
            <div key={d.id} className="border border-white/10 rounded-xl p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-white text-sm">
                  {formatDateRange(d.start_date, d.end_date)} <span className="text-white/40 text-xs capitalize">({d.reason})</span>
                </p>
                <button onClick={() => handleDelete(d.id)} className="text-white/30 hover:text-white/60 text-xs transition-colors">
                  Remove
                </button>
              </div>
              {d.note && <p className="text-white/50 text-xs mt-1">&quot;{d.note}&quot;</p>}
              <p className="text-white/40 text-xs mt-1">{DISRUPTION_GUIDANCE[d.reason]}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
