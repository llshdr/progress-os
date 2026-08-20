import { TrendingUp } from 'lucide-react'
import { enduranceSlotKmForWeek, effectiveSlotRole, ZONE_GUIDANCE, type EnduranceSlot, type SlotRole, type WeekSlots } from '@/lib/race-plan/day-template'
import type { TrainingWeekSkeleton, RaceApproach } from '@/lib/race-plan/periodization'
import type { Discipline, ExperienceLevel } from '@/lib/race-plan/self-assessment'
import { SLOT_TYPE_ICON, STRENGTH_ICON, TYPE_LABEL, ROLE_LABEL, formatSlotKm, DAY_ABBREVIATIONS } from '@/components/races/day-slot-display'
import { TRANSITION_GUIDANCE } from '@/lib/race-plan/race-day-prep'
import { paceTargetForWeek } from '@/lib/race-plan/pace-targets'
import { formatPaceForDiscipline } from '@/lib/race-plan/pace-units'
import { describePaceGap, type PaceGap } from '@/lib/race-plan/goal-achievability'

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
  // Drives the sparingly-used VO2max relabeling (see effectiveSlotRole
  // in day-template.ts) - gated to race_focused/race_leaning/balanced
  // only, never muscle_leaning/muscle_focused.
  approach: RaceApproach
  // Real-data-grounded goal-achievability gap per discipline (see
  // goal-achievability.ts) - empty when no goal is stated or no real
  // Zone 2 pace is logged yet. Only ever shown on the Peak-phase 'key'
  // slot's pace tooltip, where a numeric pace target already appears.
  paceGaps: PaceGap[]
  weeksUntilRace: number
  level: ExperienceLevel
}

function kmForSlot(slot: EnduranceSlot, sameTypeSlots: EnduranceSlot[], week: TrainingWeekSkeleton, weekIndexWithinPhase: number): number {
  const totalKm = slot.type === 'cardio' ? week.targetCardioKm : (week.disciplines?.[slot.type].km ?? 0)
  const protectedKeyKm = slot.type === 'cardio' ? null : week.disciplines?.[slot.type].protectedKeyKm
  return enduranceSlotKmForWeek(slot, sameTypeSlots, weekIndexWithinPhase, totalKm, protectedKeyKm)
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

// Only meaningful once race pace actually applies (Peak, 'key' slot) -
// same real-data-only, no-fabrication precedent as thresholdZoneTitle's
// hint (only shown when a real gap was computed for this discipline).
function paceGapTitle(slot: EnduranceSlot, week: TrainingWeekSkeleton, paceGaps: PaceGap[], weeksUntilRace: number, level: ExperienceLevel): string | undefined {
  if (slot.type === 'cardio' || slot.role !== 'key' || week.phase !== 'peak') return undefined
  const gap = paceGaps.find((g) => g.discipline === slot.type)
  return gap ? describePaceGap(gap, weeksUntilRace, level) : undefined
}

// `displayRole` is the effective role for THIS specific week (may be
// 'vo2max' on a qualifying Peak week even though the slot is still
// stored as 'threshold' - see effectiveSlotRole) - the threshold-pace
// hint only ever applies to the real 'threshold' guidance, never to a
// VO2max week (that's qualitative-only, Zone 5 has no numeric target).
function thresholdZoneTitle(
  slot: EnduranceSlot,
  displayRole: SlotRole,
  phase: TrainingWeekSkeleton['phase'],
  thresholdPaceHints: Record<Discipline, number | null> | null
): string {
  const base = ZONE_GUIDANCE[displayRole][phase].full
  if (displayRole !== 'threshold' || slot.type === 'cardio') return base
  const hint = thresholdPaceHints?.[slot.type]
  return hint != null ? `${base} Your recent time trial suggests a threshold pace around ${formatPaceForDiscipline(hint, slot.type)}.` : base
}

// Read-only per-week day list - the primary way to see "what do I do
// this week." A vertical list (Mon-Sun), matching the gym Schedule
// page's list-of-days pattern rather than a 7-column grid, since that
// fits this app's mobile-first, monochrome design language better.
export default function WeekDayList({
  slots,
  week,
  weekIndexWithinPhase,
  easyPaceTargets,
  peakPaceTargets,
  thresholdPaceHints,
  approach,
  paceGaps,
  weeksUntilRace,
  level,
}: Props) {
  return (
    <div className="mt-3 pt-3 border-t border-lapis-border-subtle space-y-1.5">
      {DAY_ABBREVIATIONS.map((label, day) => {
        const endurance = slots.enduranceSlots.filter((s) => s.day === day)
        const strength = slots.strengthSlots.filter((s) => s.day === day)
        const isBrick = slots.brickDays.includes(day)

        if (endurance.length === 0 && strength.length === 0) {
          return (
            <div key={day} className="flex items-center gap-3">
              <span className="text-lapis-text-disabled text-xs w-9 shrink-0">{label}</span>
              <span className="text-lapis-text-disabled text-xs">Rest</span>
            </div>
          )
        }

        return (
          <div key={day} className="flex items-center gap-3 flex-wrap">
            <span className="text-lapis-text-tertiary text-xs w-9 shrink-0">{label}</span>
            <div className="flex items-center gap-3 flex-wrap">
              {isBrick && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-strong"
                  title={TRANSITION_GUIDANCE[week.phase].full}
                >
                  Brick
                </span>
              )}
              {endurance.map((slot, i) => {
                const sameTypeSlots = slots.enduranceSlots.filter((s) => s.type === slot.type)
                const km = kmForSlot(slot, sameTypeSlots, week, weekIndexWithinPhase)
                const Icon = SLOT_TYPE_ICON[slot.type]
                const displayRole = effectiveSlotRole(slot, week.phase, weekIndexWithinPhase, approach)
                const zone = ZONE_GUIDANCE[displayRole][week.phase]
                const paceLabel = paceLabelForSlot(slot, week, weekIndexWithinPhase, easyPaceTargets, peakPaceTargets)
                return (
                  <span key={`${slot.type}-${i}`} className="flex items-center gap-1 text-xs text-lapis-text-secondary">
                    <Icon className="w-3.5 h-3.5 text-lapis-text-tertiary" />
                    {TYPE_LABEL[slot.type]} {formatSlotKm(km)}
                    <span className="text-lapis-text-tertiary">({ROLE_LABEL[displayRole]})</span>
                    <span className="text-lapis-text-disabled" title={thresholdZoneTitle(slot, displayRole, week.phase, thresholdPaceHints)}>
                      {zone.short}
                    </span>
                    {paceLabel && (
                      <span className="text-lapis-text-tertiary" title={paceGapTitle(slot, week, paceGaps, weeksUntilRace, level)}>
                        · ~{paceLabel}
                      </span>
                    )}
                    {slot.progression && <TrendingUp className="w-3 h-3 text-lapis-text-tertiary" />}
                  </span>
                )
              })}
              {strength.map((_, i) => (
                <span key={`strength-${i}`} className="flex items-center gap-1 text-xs text-lapis-text-secondary">
                  <STRENGTH_ICON className="w-3.5 h-3.5 text-lapis-text-tertiary" />
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
