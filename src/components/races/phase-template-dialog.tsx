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
  assignDays,
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

const RESTRICTED_DAY_WARNING = 'Right after a key/brick session - consider a different day.'

// Single-select weekday pill, same visual family (rounded-full, accent
// fill when active) as the multi-select version already established in
// Calendar's recurrence picker and HabitsCard's schedule picker - not a
// new control, just this feature's single-day variant of it. restrictedDays
// (strength only - see computeRestrictedStrengthDays) marks the pill
// itself with a warning ring BEFORE the day is chosen, not just as text
// after the fact.
function DayPicker({ value, onChange, restrictedDays }: { value: number; onChange: (day: number) => void; restrictedDays?: Set<number> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {WEEKDAY_NAMES.map((name, day) => {
        const isSelected = day === value
        const isRestricted = restrictedDays?.has(day) ?? false
        return (
          <button
            key={day}
            type="button"
            onClick={() => onChange(day)}
            title={isRestricted ? RESTRICTED_DAY_WARNING : undefined}
            className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
              isSelected
                ? 'bg-lapis-accent-500 text-lapis-text-primary'
                : 'bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-subtle hover:bg-lapis-surface-3'
            } ${isRestricted ? 'ring-2 ring-lapis-citrine/60 ring-offset-1 ring-offset-lapis-bg' : ''}`}
          >
            {name.slice(0, 3)}
          </button>
        )
      })}
    </div>
  )
}

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
  const [unavailableDays, setUnavailableDays] = useState<number[]>([])
  const [redistributeNote, setRedistributeNote] = useState<string | null>(null)
  const supabase = createClient()

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setEdited(template) // fresh copy every time it's reopened
      setUnavailableDays([])
      setRedistributeNote(null)
    }
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

  const toggleUnavailableDay = (day: number) => {
    setUnavailableDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  // Moves only the sessions currently sitting on a newly-unavailable day -
  // everything else stays exactly where it is. Reuses assignDays, the
  // same placement primitive buildPhaseTemplate itself uses when
  // generating a template from scratch, rather than a second, parallel
  // algorithm. Endurance moves first (key/threshold before easy/technique,
  // mirroring buildPhaseTemplate's own priority) so the sessions that most
  // need a good day get first pick of what's left; strength moves last,
  // respecting the same restricted-day/hard-day protection - with the
  // same last-resort degradation buildPhaseTemplate itself falls back to
  // (relax the day-after restriction, never the hard day itself). Brick
  // days aren't editable in this dialog and stay fixed - if one lands on
  // a day just marked unavailable, that's surfaced in the result note
  // rather than silently worked around.
  const handleRedistribute = () => {
    const unavailable = new Set(unavailableDays)
    const priority: Record<EnduranceSlot['role'], number> = { key: 0, threshold: 1, vo2max: 1, easy: 2, technique: 2 }
    const enduranceOrder = edited.enduranceSlots.map((s, i) => ({ ...s, index: i })).sort((a, b) => priority[a.role] - priority[b.role])

    const usedDays = new Set<number>(edited.brickDays)
    for (const s of edited.enduranceSlots) if (!unavailable.has(s.day)) usedDays.add(s.day)
    for (const s of edited.strengthSlots) if (!unavailable.has(s.day)) usedDays.add(s.day)

    const newEnduranceSlots = [...edited.enduranceSlots]
    let movedCount = 0
    let strandedCount = 0

    for (const s of enduranceOrder) {
      if (!unavailable.has(s.day)) continue
      const [newDay] = assignDays(1, new Set([...usedDays, ...unavailable]), (s.day + 1) % 7)
      if (newDay == null) {
        strandedCount++
        continue
      }
      newEnduranceSlots[s.index] = { ...newEnduranceSlots[s.index], day: newDay }
      usedDays.add(newDay)
      movedCount++
    }

    const hardDaysAfterMove = new Set<number>([
      ...newEnduranceSlots.filter((s) => s.role === 'key' || s.role === 'threshold').map((s) => s.day),
      ...edited.brickDays,
    ])
    const restrictedAfterMove = computeRestrictedStrengthDays(hardDaysAfterMove)

    const newStrengthSlots = [...edited.strengthSlots]
    for (let i = 0; i < newStrengthSlots.length; i++) {
      const s = newStrengthSlots[i]
      if (!unavailable.has(s.day)) continue
      let [newDay] = assignDays(1, new Set([...usedDays, ...unavailable, ...hardDaysAfterMove, ...restrictedAfterMove]), (s.day + 1) % 7)
      if (newDay == null) {
        ;[newDay] = assignDays(1, new Set([...usedDays, ...unavailable, ...hardDaysAfterMove]), (s.day + 1) % 7)
      }
      if (newDay == null) {
        strandedCount++
        continue
      }
      newStrengthSlots[i] = { ...s, day: newDay }
      usedDays.add(newDay)
      movedCount++
    }

    setEdited((prev) => ({ ...prev, enduranceSlots: newEnduranceSlots, strengthSlots: newStrengthSlots }))

    const notes: string[] = []
    notes.push(
      movedCount === 0
        ? 'Nothing was scheduled on those days - nothing moved.'
        : `Moved ${movedCount} session${movedCount === 1 ? '' : 's'} off ${unavailableDays.length === 1 ? 'that day' : 'those days'}.`
    )
    if (edited.brickDays.some((d) => unavailable.has(d))) {
      notes.push("A brick session still falls on one of them - bricks aren't editable here, so regenerating the plan is the way to move those.")
    }
    if (strandedCount > 0) {
      notes.push(`${strandedCount} session${strandedCount === 1 ? '' : 's'} couldn't find a free day and stayed put - this phase may have more sessions than days can comfortably hold.`)
    }
    setRedistributeNote(notes.join(' '))
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

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div className="border border-lapis-border-subtle rounded-lapis-md p-4">
            <p className="text-sm text-lapis-text-primary font-medium mb-1">Which days can&apos;t you train this phase?</p>
            <p className="text-lapis-text-tertiary text-xs mb-3">
              Pick the days you know are out, then redistribute - only sessions currently on those days move; everything else stays exactly where it is.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {WEEKDAY_NAMES.map((name, day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleUnavailableDay(day)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                    unavailableDays.includes(day)
                      ? 'bg-lapis-accent-500 text-lapis-text-primary'
                      : 'bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-subtle hover:bg-lapis-surface-3'
                  }`}
                >
                  {name.slice(0, 3)}
                </button>
              ))}
            </div>
            <Button
              onClick={handleRedistribute}
              disabled={unavailableDays.length === 0}
              variant="outline"
              className="h-8 text-xs border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2"
            >
              Redistribute around these days
            </Button>
            {redistributeNote && <p className="text-lapis-text-tertiary text-xs mt-2">{redistributeNote}</p>}
          </div>

          {/* Read-only orientation only - the actual editing happens in the
              slot cards below, which each keep one fixed position in the
              list regardless of which day they're assigned to. Grouping by
              day instead (like this strip does, on purpose) is what used to
              make every edit re-shuffle the whole list. */}
          <div className="border border-lapis-border-subtle rounded-lapis-md p-3">
            <p className="text-xs text-lapis-text-tertiary mb-2">Week at a glance</p>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAY_NAMES.map((name, day) => {
                const dayIcons = [
                  ...edited.enduranceSlots.filter((s) => s.day === day).map((s) => ({ key: `e-${s.type}`, Icon: SLOT_TYPE_ICON[s.type] })),
                  ...edited.strengthSlots.filter((s) => s.day === day).map((_, i) => ({ key: `s-${i}`, Icon: STRENGTH_ICON })),
                ]
                return (
                  <div key={day} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-lapis-text-tertiary">{name.slice(0, 2)}</span>
                    <div className="flex flex-col items-center gap-0.5 min-h-[16px]">
                      {dayIcons.length === 0 ? (
                        <span className="text-lapis-text-disabled text-[10px]">–</span>
                      ) : (
                        dayIcons.map(({ key, Icon }) => <Icon key={key} className="w-3 h-3 text-lapis-text-tertiary" />)
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {edited.enduranceSlots.map((slot, index) => {
            const Icon = SLOT_TYPE_ICON[slot.type]
            const zone = ZONE_GUIDANCE[slot.role][phase]
            const paceRange = paceRangeLabel(slot)
            const isBrick = edited.brickDays.includes(slot.day)
            return (
              <div key={index} className="border border-lapis-border-subtle rounded-lapis-md p-4">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Icon className="w-4 h-4 text-lapis-text-tertiary shrink-0" />
                  <span className="text-lapis-text-primary text-sm font-medium">{TYPE_LABEL[slot.type]}</span>
                  <span className="text-lapis-text-tertiary text-xs">({ROLE_LABEL[slot.role]})</span>
                  <span className="text-lapis-text-disabled text-xs" title={thresholdZoneTitle(slot)}>
                    {zone.short}
                  </span>
                  {isBrick && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-strong"
                      title={TRANSITION_GUIDANCE[phase].full}
                    >
                      Brick
                    </span>
                  )}
                </div>
                <p className="text-lapis-text-tertiary text-xs mb-3">
                  {kmRangeLabel(slot)}
                  {paceRange && <> · {paceRange}</>}
                </p>

                <div className="flex items-center gap-3 flex-wrap mb-3">
                  <DayPicker value={slot.day} onChange={(day) => updateEnduranceDay(index, day)} />
                  <Input
                    type="time"
                    value={slot.time ?? ''}
                    onChange={(e) => updateEnduranceTime(index, e.target.value)}
                    className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary w-28 h-8 text-xs"
                  />
                </div>

                {slot.role === 'key' && (
                  <div className="pt-3 border-t border-lapis-border-subtle">
                    <label className="flex items-center gap-2 text-xs text-lapis-text-tertiary mb-2">
                      <input type="checkbox" checked={slot.progression != null} onChange={(e) => toggleProgression(index, e.target.checked)} />
                      Progressive (ramps up across the phase)
                    </label>
                    {slot.progression && (
                      <div className="flex items-center gap-2 text-xs text-lapis-text-tertiary flex-wrap">
                        starts at
                        <Input
                          type="number"
                          value={Math.round(slot.progression.startShareFraction * 100)}
                          onChange={(e) => updateProgressionField(index, 'startShareFraction', Number(e.target.value) / 100)}
                          className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary w-14 h-7 text-xs"
                        />
                        % of peak, reaches full over
                        <Input
                          type="number"
                          value={slot.progression.rampWeeks}
                          onChange={(e) => updateProgressionField(index, 'rampWeeks', Number(e.target.value))}
                          className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary w-12 h-7 text-xs"
                        />
                        wk(s)
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {edited.strengthSlots.map((slot, index) => (
            <div key={`strength-${index}`} className="border border-lapis-border-subtle rounded-lapis-md p-4">
              <div className="flex items-center gap-2 mb-3">
                <STRENGTH_ICON className="w-4 h-4 text-lapis-text-tertiary shrink-0" />
                <span className="text-lapis-text-primary text-sm font-medium">Strength</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <DayPicker value={slot.day} onChange={(day) => updateStrengthDay(index, day)} restrictedDays={restrictedDays} />
                <Input
                  type="time"
                  value={slot.time ?? ''}
                  onChange={(e) => updateStrengthTime(index, e.target.value)}
                  className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary w-28 h-8 text-xs"
                />
              </div>
              {restrictedDays.has(slot.day) && <p className="text-lapis-citrine/60 text-xs mt-2">{RESTRICTED_DAY_WARNING}</p>}
            </div>
          ))}
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110">
          {saving ? 'Saving...' : 'Save Template'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
