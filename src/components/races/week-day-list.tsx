import { TrendingUp } from 'lucide-react'
import { enduranceSlotKmForWeek, type EnduranceSlot, type WeekSlots } from '@/lib/race-plan/day-template'
import type { TrainingWeekSkeleton } from '@/lib/race-plan/periodization'
import { SLOT_TYPE_ICON, STRENGTH_ICON, TYPE_LABEL, formatSlotKm, DAY_ABBREVIATIONS } from '@/components/races/day-slot-display'

interface Props {
  slots: WeekSlots
  week: TrainingWeekSkeleton
  weekIndexWithinPhase: number
}

function kmForSlot(slot: EnduranceSlot, sameTypeSlots: EnduranceSlot[], week: TrainingWeekSkeleton, weekIndexWithinPhase: number): number {
  const totalKm = slot.type === 'cardio' ? week.targetCardioKm : (week.disciplines?.[slot.type].km ?? 0)
  return enduranceSlotKmForWeek(slot, sameTypeSlots, weekIndexWithinPhase, totalKm)
}

// Read-only per-week day list - the primary way to see "what do I do
// this week." A vertical list (Mon-Sun), matching the gym Schedule
// page's list-of-days pattern rather than a 7-column grid, since that
// fits this app's mobile-first, monochrome design language better.
export default function WeekDayList({ slots, week, weekIndexWithinPhase }: Props) {
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
                <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/60 border border-white/20">Brick</span>
              )}
              {endurance.map((slot, i) => {
                const sameTypeSlots = slots.enduranceSlots.filter((s) => s.type === slot.type)
                const km = kmForSlot(slot, sameTypeSlots, week, weekIndexWithinPhase)
                const Icon = SLOT_TYPE_ICON[slot.type]
                return (
                  <span key={`${slot.type}-${i}`} className="flex items-center gap-1 text-xs text-white/70">
                    <Icon className="w-3.5 h-3.5 text-white/40" />
                    {TYPE_LABEL[slot.type]} {formatSlotKm(km)}
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
