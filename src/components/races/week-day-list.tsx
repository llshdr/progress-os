import { TrendingUp } from 'lucide-react'
import { enduranceSlotKmForWeek, ZONE_GUIDANCE, type EnduranceSlot, type WeekSlots } from '@/lib/race-plan/day-template'
import type { TrainingWeekSkeleton } from '@/lib/race-plan/periodization'
import type { Discipline } from '@/lib/race-plan/self-assessment'
import { SLOT_TYPE_ICON, STRENGTH_ICON, TYPE_LABEL, ROLE_LABEL, formatSlotKm, DAY_ABBREVIATIONS } from '@/components/races/day-slot-display'
import { TRANSITION_GUIDANCE } from '@/lib/race-plan/race-day-prep'
import { paceTargetForWeek } from '@/lib/race-plan/pace-targets'
import { formatPaceForDiscipline } from '@/lib/race-plan/pace-units'

interface Props {
  slots: WeekSlots
  week: TrainingWeekSkeleton
  weekIndexWithinPhase: number
  // Per-discipline pace bookends (Base baseline / Peak target), null for
  // non-multisport plans - only 'key' slots ever show a pace target
  // (see pace-targets.ts for why easy/technique slots don't).
  easyPaceTargets: Record<Discipline, number> | null
  peakPaceTargets: Record<Discipline, number> | null
  // Opportunistic threshold-pace proxy per discipline, from the
  // athlete's own recentTimeTrial when its duration fits a real
  // threshold-test window (see thresholdPaceHint in day-template.ts) -
  // qualitative guidance is the baseline for 'threshold' slots, this is
  // just an optional numeric hint layered on top when it's honestly
  // available.
  thresholdPaceHints: Record<Discipline, number | null> | null
}

function kmForSlot(slot: EnduranceSlot, sameTypeSlots: EnduranceSlot[], week: TrainingWeekSkeleton, weekIndexWithinPhase: number): number {
  const totalKm = slot.type === 'cardio' ? week.targetCardioKm : (week.disciplines?.[slot.type].km ?? 0)
  return enduranceSlotKmForWeek(slot, sameTypeSlots, weekIndexWithinPhase, totalKm)
}

function paceLabelForSlot(
  slot: EnduranceSlot,
  week: TrainingWeekSkeleton,
  weekIndexWithinPhase: number,
  easyPaceTargets: Record<Discipline, number> | null,
  peakPaceTargets: Record<Discipline, number> | null
): string | null {
  if (slot.type === 'cardio' || slot.role !== 'key' || !easyPaceTargets || !peakPaceTargets) return null
  const pace = paceTargetForWeek(easyPaceTargets[slot.type], peakPaceTargets[slot.type], week.phase, weekIndexWithinPhase, slot.progression)
  return formatPaceForDiscipline(pace, slot.type)
}

function thresholdZoneTitle(slot: EnduranceSlot, phase: TrainingWeekSkeleton['phase'], thresholdPaceHints: Record<Discipline, number | null> | null): string {
  const base = ZONE_GUIDANCE[slot.role][phase].full
  if (slot.role !== 'threshold' || slot.type === 'cardio') return base
  const hint = thresholdPaceHints?.[slot.type]
  return hint != null ? `${base} Your recent time trial suggests a threshold pace around ${formatPaceForDiscipline(hint, slot.type)}.` : base
}

// Read-only per-week day list - the primary way to see "what do I do
// this week." A vertical list (Mon-Sun), matching the gym Schedule
// page's list-of-days pattern rather than a 7-column grid, since that
// fits this app's mobile-first, monochrome design language better.
export default function WeekDayList({ slots, week, weekIndexWithinPhase, easyPaceTargets, peakPaceTargets, thresholdPaceHints }: Props) {
  return (
    <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
      {DAY_ABBREVIATIONS.map((label, day) => {
        const endurance = slots.enduranceSlots.filter((s) => s.day === day)
        const strength = slots.strengthSlots.filter((s) => s.day === day)
        const isBrick = slots.brickDays.includes(day)

        if (endurance.length === 0 && strength.length === 0) {
          return (
            <div key={day} className="flex items-center gap-3">
              <span className="text-white/30 text-xs w-9 shrink-0">{label}</span>
              <span className="text-white/25 text-xs">Rest</span>
            </div>
          )
        }

        return (
          <div key={day} className="flex items-center gap-3 flex-wrap">
            <span className="text-white/50 text-xs w-9 shrink-0">{label}</span>
            <div className="flex items-center gap-3 flex-wrap">
              {isBrick && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/60 border border-white/20"
                  title={TRANSITION_GUIDANCE[week.phase].full}
                >
                  Brick
                </span>
              )}
              {endurance.map((slot, i) => {
                const sameTypeSlots = slots.enduranceSlots.filter((s) => s.type === slot.type)
                const km = kmForSlot(slot, sameTypeSlots, week, weekIndexWithinPhase)
                const Icon = SLOT_TYPE_ICON[slot.type]
                const zone = ZONE_GUIDANCE[slot.role][week.phase]
                const paceLabel = paceLabelForSlot(slot, week, weekIndexWithinPhase, easyPaceTargets, peakPaceTargets)
                return (
                  <span key={`${slot.type}-${i}`} className="flex items-center gap-1 text-xs text-white/70">
                    <Icon className="w-3.5 h-3.5 text-white/40" />
                    {TYPE_LABEL[slot.type]} {formatSlotKm(km)}
                    <span className="text-white/40">({ROLE_LABEL[slot.role]})</span>
                    <span className="text-white/30" title={thresholdZoneTitle(slot, week.phase, thresholdPaceHints)}>
                      {zone.short}
                    </span>
                    {paceLabel && <span className="text-white/40">· ~{paceLabel}</span>}
                    {slot.progression && <TrendingUp className="w-3 h-3 text-white/40" />}
                  </span>
                )
              })}
              {strength.map((_, i) => (
                <span key={`strength-${i}`} className="flex items-center gap-1 text-xs text-white/70">
                  <STRENGTH_ICON className="w-3.5 h-3.5 text-white/40" />
                  Strength
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
