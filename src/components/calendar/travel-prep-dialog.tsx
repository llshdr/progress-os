'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatDateRange } from '@/components/disruption-declaration'
import { describeMesocycleOverlap, type Mesocycle } from '@/lib/mesocycle'
import { TRAVEL_DISCIPLINE_LABELS, TRAVEL_CHECKLIST_ITEMS, TRAVEL_NO_GYM_GUIDE, TRAVEL_TIMEZONE_NOTE, type TravelDiscipline } from '@/lib/travel-prep'
import type { CalendarEntry } from '@/lib/calendar'

const ALL_DISCIPLINES = Object.keys(TRAVEL_DISCIPLINE_LABELS) as TravelDiscipline[]

interface Props {
  entry: CalendarEntry
  mesocycles: Mesocycle[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onDisruptionDeclared: () => void
}

// Opt-in helper surfaced from any multi-day Calendar entry - never
// auto-detected from a title, never auto-opened. Everything here is
// static/generic (no destination-specific content) and the packing
// checklist is plain local state, not persisted - see travel-prep.ts.
export default function TravelPrepDialog({ entry, mesocycles, open, onOpenChange, onDisruptionDeclared }: Props) {
  const [disciplines, setDisciplines] = useState<TravelDiscipline[]>([])
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [declaring, setDeclaring] = useState(false)
  const [declared, setDeclared] = useState(false)
  const supabase = createClient()

  const toggleDiscipline = (d: TravelDiscipline) => {
    setDisciplines((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
  }

  const toggleChecked = (item: string) => {
    setChecked((prev) => ({ ...prev, [item]: !prev[item] }))
  }

  const overlapNote = describeMesocycleOverlap(mesocycles, entry.startDate, entry.endDate)

  const handleDeclareDisruption = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setDeclaring(true)
    const { error } = await supabase.from('training_disruptions').insert({
      user_id: user.id,
      start_date: entry.startDate,
      end_date: entry.endDate,
      reason: 'travel',
      note: `Travel: ${entry.title}`,
    })
    setDeclaring(false)
    if (error) {
      console.error('Error declaring training disruption:', error)
      return
    }
    setDeclared(true)
    onDisruptionDeclared()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-lapis-bg border-lapis-border-subtle text-lapis-text-primary max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Travel Prep - {entry.title}</DialogTitle>
          <DialogDescription className="text-lapis-text-tertiary">{formatDateRange(entry.startDate, entry.endDate)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {overlapNote && <p className="text-lapis-text-tertiary text-xs border border-lapis-border-subtle rounded-lapis-sm px-3 py-2">{overlapNote}</p>}

          <div className="space-y-2">
            <p className="text-lapis-text-secondary text-sm font-medium">What are you keeping up?</p>
            <div className="flex flex-wrap gap-2">
              {ALL_DISCIPLINES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDiscipline(d)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                    disciplines.includes(d) ? 'bg-lapis-accent-500 text-lapis-text-primary' : 'bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-subtle hover:bg-lapis-surface-2'
                  }`}
                >
                  {TRAVEL_DISCIPLINE_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          {disciplines.length > 0 && (
            <div className="space-y-2">
              <p className="text-lapis-text-secondary text-sm font-medium">Packing checklist</p>
              <div className="space-y-1.5">
                {disciplines.flatMap((d) => TRAVEL_CHECKLIST_ITEMS[d]).map((item) => (
                  <label key={item} className="flex items-center gap-2 text-sm text-lapis-text-secondary">
                    <input type="checkbox" checked={!!checked[item]} onChange={() => toggleChecked(item)} />
                    {item}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-lapis-text-secondary text-sm font-medium">No gym, no problem</p>
            <p className="text-lapis-text-tertiary text-xs">{TRAVEL_NO_GYM_GUIDE}</p>
          </div>

          <p className="text-lapis-text-disabled text-xs">{TRAVEL_TIMEZONE_NOTE}</p>

          <Button
            onClick={handleDeclareDisruption}
            disabled={declaring || declared}
            className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110"
          >
            {declared ? 'Declared as a training disruption' : declaring ? 'Declaring...' : 'Also declare this as a training disruption'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
