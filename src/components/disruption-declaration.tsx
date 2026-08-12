'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DISRUPTION_GUIDANCE } from '@/lib/disruptions'

export type DisruptionReason = 'travel' | 'illness' | 'injury' | 'other'

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
  { value: 'injury', label: 'Injury' },
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
    <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-medium text-lapis-text-primary">Training Disruptions</h2>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger>
            <button className="text-xs text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors underline underline-offset-2">Declare a disruption</button>
          </DialogTrigger>
          <DialogContent className="bg-lapis-bg border-lapis-border-subtle text-lapis-text-primary">
            <DialogHeader>
              <DialogTitle>Declare a disruption</DialogTitle>
              <DialogDescription className="text-lapis-text-tertiary">
                Travel, illness, or anything else that pauses or limits training - before it starts or after the fact. This won&apos;t affect your
                real fitness tracking, just keeps the plan from flagging a gap you already know about.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="disruption-start" className="text-lapis-text-secondary">
                    Start date
                  </Label>
                  <Input
                    id="disruption-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="disruption-end" className="text-lapis-text-secondary">
                    End date
                  </Label>
                  <Input
                    id="disruption-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || undefined}
                    className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-lapis-text-secondary">Reason</Label>
                <div className="flex gap-2">
                  {REASON_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setReason(opt.value)}
                      className={`px-3 py-2 rounded-lapis-sm text-sm transition-colors ${
                        reason === opt.value ? 'bg-lapis-accent-500 text-lapis-text-primary' : 'bg-lapis-surface-2 text-lapis-text-secondary hover:bg-lapis-surface-2'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-lapis-text-secondary">What&apos;s still possible? (optional)</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. can do bodyweight strength, no swim/bike/run"
                  rows={2}
                  className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled resize-none"
                />
              </div>
              <Button onClick={handleSave} disabled={saving || !startDate || !endDate} className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110">
                {saving ? 'Saving...' : 'Declare'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {disruptions.length === 0 ? (
        <p className="text-lapis-text-tertiary text-sm">None declared.</p>
      ) : (
        <div className="space-y-3">
          {disruptions.map((d) => (
            <div key={d.id} className="border border-lapis-border-subtle rounded-lapis-md p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-lapis-text-primary text-sm">
                  {formatDateRange(d.start_date, d.end_date)} <span className="text-lapis-text-tertiary text-xs capitalize">({d.reason})</span>
                </p>
                <button onClick={() => handleDelete(d.id)} className="text-lapis-text-disabled hover:text-lapis-text-secondary text-xs transition-colors">
                  Remove
                </button>
              </div>
              {d.note && <p className="text-lapis-text-tertiary text-xs mt-1">&quot;{d.note}&quot;</p>}
              <p className="text-lapis-text-tertiary text-xs mt-1">{DISRUPTION_GUIDANCE[d.reason]}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
