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
import type { Discipline } from '@/lib/race-plan/self-assessment'
import { SLOT_TYPE_ICON, STRENGTH_ICON, TYPE_LABEL, ROLE_LABEL, formatSlotKm } from '@/components/races/day-slot-display'
import { TRANSITION_GUIDANCE } from '@/lib/race-plan/race-day-prep'
import { paceTargetForWeek } from '@/lib/race-plan/pace-targets'
import { formatPaceForDiscipline } from '@/lib/race-plan/pace-units'

const PHASE_LABEL: Record<TrainingPhase, string> = { base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper' }

interface Props {
  raceId: string
  phase: TrainingPhase
  template: PhaseTemplate
  allTemplates: PhaseTemplates
  weeksInPhase: TrainingWeekSkeleton[]
  onSaved: (updated: PhaseTemplate) => void
  easyPaceTargets: Record<Discipline, number> | null
  peakPaceTargets: Record<Discipline, number> | null
  thresholdPaceHints: Record<Discipline, number | null> | null
}

export default function PhaseTemplateDialog({
  raceId,
  phase,
  template,
  allTemplates,
  weeksInPhase,
  onSaved,
  easyPaceTargets,
  peakPaceTargets,
  thresholdPaceHints,
}: Props) {
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

  // Mirrors kmRangeLabel's shape exactly, applied to pace instead of km -
  // only meaningful for a 'key' slot (see pace-targets.ts for why easy/
  // technique slots never get a numeric pace target).
  const paceRangeLabel = (slot: EnduranceSlot): string | null => {
    if (slot.type === 'cardio' || slot.role !== 'key' || !easyPaceTargets || !peakPaceTargets) return null
    const easy = easyPaceTargets[slot.type]
    const peak = peakPaceTargets[slot.type]
    const startPace = paceTargetForWeek(easy, peak, phase, 0, slot.progression)
    if (!slot.progression) return `~${formatPaceForDiscipline(startPace, slot.type)} (flat)`
    const peakIndex = weeksInPhase.length - 1
    const peakPace = paceTargetForWeek(easy, peak, phase, peakIndex, slot.progression)
    return `~${formatPaceForDiscipline(startPace, slot.type)} → ${formatPaceForDiscipline(peakPace, slot.type)}`
  }

  // 'threshold' slots are hard days too - same extension as
  // buildPhaseTemplate's own hardDays set (day-template.ts), kept in
  // sync here since this operates on `edited`, not the stored template.
  const hardDays = new Set<number>([
    ...edited.enduranceSlots.filter((s) => s.role === 'key' || s.role === 'threshold').map((s) => s.day),
    ...edited.brickDays,
  ])
  const restrictedDays = computeRestrictedStrengthDays(hardDays)

  // Mirrors WeekDayList's own thresholdZoneTitle - qualitative guidance
  // is the baseline for 'threshold' slots, this layers in the optional
  // opportunistic recentTimeTrial-based pace hint when honestly available.
  const thresholdZoneTitle = (slot: EnduranceSlot): string => {
    const base = ZONE_GUIDANCE[slot.role][phase].full
    if (slot.role !== 'threshold' || slot.type === 'cardio') return base
    const hint = thresholdPaceHints?.[slot.type]
    return hint != null ? `${base} Your recent time trial suggests a threshold pace around ${formatPaceForDiscipline(hint, slot.type)}.` : base
  }

  const updateEnduranceDay = (index: number, day: number) => {
    setEdited((prev) => ({ ...prev, enduranceSlots: prev.enduranceSlots.map((s, i) => (i === index ? { ...s, day } : s)) }))
  }

  const updateStrengthDay = (index: number, day: number) => {
    setEdited((prev) => ({ ...prev, strengthSlots: prev.strengthSlots.map((s, i) => (i === index ? { ...s, day } : s)) }))
  }

  // Blank input -> null, never a fabricated default - the calendar's day
  // view shows this slot as all-day/untimed until the athlete sets one.
  const updateEnduranceTime = (index: number, time: string) => {
    setEdited((prev) => ({ ...prev, enduranceSlots: prev.enduranceSlots.map((s, i) => (i === index ? { ...s, time: time || null } : s)) }))
  }

  const updateStrengthTime = (index: number, time: string) => {
    setEdited((prev) => ({ ...prev, strengthSlots: prev.strengthSlots.map((s, i) => (i === index ? { ...s, time: time || null } : s)) }))
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
        <button className="text-xs text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors underline underline-offset-2">View/Edit Template</button>
      </DialogTrigger>
      <DialogContent className="bg-lapis-bg border-lapis-border-subtle text-lapis-text-primary max-w-2xl">
        <DialogHeader>
          <DialogTitle>{PHASE_LABEL[phase]} Phase Template</DialogTitle>
          <DialogDescription className="text-lapis-text-tertiary">
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
                  <span className="text-lapis-text-tertiary text-sm w-24 shrink-0">{name}</span>
                  <span className="text-lapis-text-disabled text-xs">Rest</span>
                </div>
              )
            }

            return (
              <div key={day} className="border border-lapis-border-subtle rounded-lapis-md p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lapis-text-primary text-sm font-medium w-24 shrink-0">{name}</span>
                  {isBrick && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-strong"
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
                    const paceRange = paceRangeLabel(slot)
                    return (
                    <div key={slot.index} className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="flex items-center gap-1.5 text-lapis-text-secondary">
                        <Icon className="w-4 h-4 text-lapis-text-tertiary" />
                        {TYPE_LABEL[slot.type]} <span className="text-lapis-text-tertiary text-xs">({ROLE_LABEL[slot.role]})</span>
                        <span className="text-lapis-text-disabled text-xs" title={thresholdZoneTitle(slot)}>
                          {zone.short}
                        </span>
                      </span>
                      <span className="text-lapis-text-tertiary text-xs">{kmRangeLabel(slot)}</span>
                      {paceRange && <span className="text-lapis-text-tertiary text-xs">{paceRange}</span>}
                      <select
                        value={slot.day}
                        onChange={(e) => updateEnduranceDay(slot.index, Number(e.target.value))}
                        className="bg-lapis-surface-2 border border-lapis-border-subtle text-lapis-text-primary text-xs rounded-lapis-sm px-2 py-1"
                      >
                        {WEEKDAY_NAMES.map((n, d) => (
                          <option key={d} value={d} className="bg-lapis-bg">
                            {n}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="time"
                        value={slot.time ?? ''}
                        onChange={(e) => updateEnduranceTime(slot.index, e.target.value)}
                        className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary w-28 h-7 text-xs"
                      />
                      {slot.role === 'key' && (
                        <label className="flex items-center gap-1 text-xs text-lapis-text-tertiary">
                          <input type="checkbox" checked={slot.progression != null} onChange={(e) => toggleProgression(slot.index, e.target.checked)} />
                          Progressive
                        </label>
                      )}
                      {slot.progression && (
                        <span className="flex items-center gap-1 text-xs text-lapis-text-tertiary">
                          starts at
                          <Input
                            type="number"
                            value={Math.round(slot.progression.startShareFraction * 100)}
                            onChange={(e) => updateProgressionField(slot.index, 'startShareFraction', Number(e.target.value) / 100)}
                            className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary w-14 h-7 text-xs"
                          />
                          % of peak, reaches full over
                          <Input
                            type="number"
                            value={slot.progression.rampWeeks}
                            onChange={(e) => updateProgressionField(slot.index, 'rampWeeks', Number(e.target.value))}
                            className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary w-12 h-7 text-xs"
                          />
                          wk(s)
                        </span>
                      )}
                    </div>
                  )})}

                  {strength.map((slot) => (
                    <div key={`strength-${slot.index}`} className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="flex items-center gap-1.5 text-lapis-text-secondary">
                        <STRENGTH_ICON className="w-4 h-4 text-lapis-text-tertiary" />
                        Strength
                      </span>
                      <select
                        value={slot.day}
                        onChange={(e) => updateStrengthDay(slot.index, Number(e.target.value))}
                        className="bg-lapis-surface-2 border border-lapis-border-subtle text-lapis-text-primary text-xs rounded-lapis-sm px-2 py-1"
                      >
                        {WEEKDAY_NAMES.map((n, d) => (
                          <option key={d} value={d} className="bg-lapis-bg">
                            {n}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="time"
                        value={slot.time ?? ''}
                        onChange={(e) => updateStrengthTime(slot.index, e.target.value)}
                        className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary w-28 h-7 text-xs"
                      />
                      {restrictedDays.has(slot.day) && <span className="text-lapis-citrine/60 text-xs">Right after a key/brick session - consider a different day.</span>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110">
          {saving ? 'Saving...' : 'Save Template'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
