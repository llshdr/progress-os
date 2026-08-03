'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { WEEKDAY_NAMES } from '@/lib/gym-schedule'
import {
  enduranceSlotKmForWeek,
  computeRestrictedStrengthDays,
  ZONE_GUIDANCE,
  type PhaseTemplate,
  type PhaseTemplates,
  type EnduranceSlot,
} from '@/lib/race-plan/day-template'
import type { TrainingPhase, TrainingWeekSkeleton } from '@/lib/race-plan/periodization'
import { SLOT_TYPE_ICON, STRENGTH_ICON, TYPE_LABEL, ROLE_LABEL, formatSlotKm } from '@/components/races/day-slot-display'
import { TRANSITION_GUIDANCE } from '@/lib/race-plan/race-day-prep'

const PHASE_LABEL: Record<TrainingPhase, string> = { base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper' }

interface Props {
  raceId: string
  phase: TrainingPhase
  template: PhaseTemplate
  allTemplates: PhaseTemplates
  weeksInPhase: TrainingWeekSkeleton[]
  onSaved: (updated: PhaseTemplate) => void
}

export default function PhaseTemplateDialog({ raceId, phase, template, allTemplates, weeksInPhase, onSaved }: Props) {
  const [open, setOpen] = useState(false)
  const [edited, setEdited] = useState<PhaseTemplate>(template)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) setEdited(template) // fresh copy every time it's reopened
  }

  const weekDisciplineTotalKm = (type: EnduranceSlot['type'], weekIndex: number): number => {
    const week = weeksInPhase[weekIndex]
    if (!week) return 0
    if (type === 'cardio') return week.targetCardioKm
    return week.disciplines ? week.disciplines[type].km : 0
  }

  const kmRangeLabel = (slot: EnduranceSlot): string => {
    const siblings = edited.enduranceSlots.filter((s) => s.type === slot.type)
    const startKm = enduranceSlotKmForWeek(slot, siblings, 0, weekDisciplineTotalKm(slot.type, 0))
    if (!slot.progression) return `${formatSlotKm(startKm)} (flat)`
    const peakIndex = weeksInPhase.length - 1
    const peakKm = enduranceSlotKmForWeek(slot, siblings, peakIndex, weekDisciplineTotalKm(slot.type, peakIndex))
    return `${formatSlotKm(startKm)} → ${formatSlotKm(peakKm)} across the phase`
  }

  const hardDays = new Set<number>([...edited.enduranceSlots.filter((s) => s.role === 'key').map((s) => s.day), ...edited.brickDays])
  const restrictedDays = computeRestrictedStrengthDays(hardDays)

  const updateEnduranceDay = (index: number, day: number) => {
    setEdited((prev) => ({ ...prev, enduranceSlots: prev.enduranceSlots.map((s, i) => (i === index ? { ...s, day } : s)) }))
  }

  const updateStrengthDay = (index: number, day: number) => {
    setEdited((prev) => ({ ...prev, strengthSlots: prev.strengthSlots.map((s, i) => (i === index ? { ...s, day } : s)) }))
  }

  const toggleProgression = (index: number, enabled: boolean) => {
    setEdited((prev) => ({
      ...prev,
      enduranceSlots: prev.enduranceSlots.map((s, i) => (i === index ? { ...s, progression: enabled ? { startShareFraction: 0.65, rampWeeks: 6 } : null } : s)),
    }))
  }

  const updateProgressionField = (index: number, field: 'startShareFraction' | 'rampWeeks', value: number) => {
    setEdited((prev) => ({
      ...prev,
      enduranceSlots: prev.enduranceSlots.map((s, i) => (i === index && s.progression ? { ...s, progression: { ...s.progression, [field]: value } } : s)),
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('race_training_plans')
      .update({ phase_templates: { ...allTemplates, [phase]: edited } })
      .eq('race_id', raceId)

    setSaving(false)
    if (error) {
      console.error('Error saving phase template:', error)
      return
    }
    onSaved(edited)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger>
        <button className="text-xs text-white/40 hover:text-white/60 transition-colors underline underline-offset-2">View/Edit Template</button>
      </DialogTrigger>
      <DialogContent className="bg-black border-white/10 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>{PHASE_LABEL[phase]} Phase Template</DialogTitle>
          <DialogDescription className="text-white/40">
            Repeats every week of this phase. Editing here is separate from regenerating the plan - regenerating recomputes every phase&apos;s template from scratch and discards these edits.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {WEEKDAY_NAMES.map((name, day) => {
            const endurance = edited.enduranceSlots.map((s, i) => ({ ...s, index: i })).filter((s) => s.day === day)
            const strength = edited.strengthSlots.map((s, i) => ({ ...s, index: i })).filter((s) => s.day === day)
            const isBrick = edited.brickDays.includes(day)

            if (endurance.length === 0 && strength.length === 0) {
              return (
                <div key={day} className="flex items-center gap-3 py-1">
                  <span className="text-white/50 text-sm w-24 shrink-0">{name}</span>
                  <span className="text-white/25 text-xs">Rest</span>
                </div>
              )
            }

            return (
              <div key={day} className="border border-white/10 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-white text-sm font-medium w-24 shrink-0">{name}</span>
                  {isBrick && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/60 border border-white/20"
                      title={TRANSITION_GUIDANCE[phase].full}
                    >
                      Brick
                    </span>
                  )}
                </div>

                <div className="space-y-2 pl-1">
                  {endurance.map((slot) => {
                    const Icon = SLOT_TYPE_ICON[slot.type]
                    const zone = ZONE_GUIDANCE[slot.role][phase]
                    return (
                    <div key={slot.index} className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="flex items-center gap-1.5 text-white/80">
                        <Icon className="w-4 h-4 text-white/40" />
                        {TYPE_LABEL[slot.type]} <span className="text-white/40 text-xs">({ROLE_LABEL[slot.role]})</span>
                        <span className="text-white/30 text-xs" title={zone.full}>
                          {zone.short}
                        </span>
                      </span>
                      <span className="text-white/40 text-xs">{kmRangeLabel(slot)}</span>
                      <select
                        value={slot.day}
                        onChange={(e) => updateEnduranceDay(slot.index, Number(e.target.value))}
                        className="bg-white/5 border border-white/10 text-white text-xs rounded-lg px-2 py-1"
                      >
                        {WEEKDAY_NAMES.map((n, d) => (
                          <option key={d} value={d} className="bg-black">
                            {n}
                          </option>
                        ))}
                      </select>
                      {slot.role === 'key' && (
                        <label className="flex items-center gap-1 text-xs text-white/50">
                          <input type="checkbox" checked={slot.progression != null} onChange={(e) => toggleProgression(slot.index, e.target.checked)} />
                          Progressive
                        </label>
                      )}
                      {slot.progression && (
                        <span className="flex items-center gap-1 text-xs text-white/50">
                          starts at
                          <Input
                            type="number"
                            value={Math.round(slot.progression.startShareFraction * 100)}
                            onChange={(e) => updateProgressionField(slot.index, 'startShareFraction', Number(e.target.value) / 100)}
                            className="bg-white/5 border-white/10 text-white w-14 h-7 text-xs"
                          />
                          % of peak, reaches full over
                          <Input
                            type="number"
                            value={slot.progression.rampWeeks}
                            onChange={(e) => updateProgressionField(slot.index, 'rampWeeks', Number(e.target.value))}
                            className="bg-white/5 border-white/10 text-white w-12 h-7 text-xs"
                          />
                          wk(s)
                        </span>
                      )}
                    </div>
                  )})}

                  {strength.map((slot) => (
                    <div key={`strength-${slot.index}`} className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="flex items-center gap-1.5 text-white/80">
                        <STRENGTH_ICON className="w-4 h-4 text-white/40" />
                        Strength
                      </span>
                      <select
                        value={slot.day}
                        onChange={(e) => updateStrengthDay(slot.index, Number(e.target.value))}
                        className="bg-white/5 border border-white/10 text-white text-xs rounded-lg px-2 py-1"
                      >
                        {WEEKDAY_NAMES.map((n, d) => (
                          <option key={d} value={d} className="bg-black">
                            {n}
                          </option>
                        ))}
                      </select>
                      {restrictedDays.has(slot.day) && <span className="text-yellow-200/60 text-xs">Right after a key/brick session - consider a different day.</span>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full bg-white text-black hover:bg-white/90">
          {saving ? 'Saving...' : 'Save Template'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
