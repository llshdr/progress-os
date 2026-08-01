import type { TrainingPhase, TrainingWeekSkeleton } from '@/lib/race-plan/periodization'
import type { Discipline } from '@/lib/race-plan/self-assessment'

export type EnduranceSlotType = 'swim' | 'bike' | 'run' | 'cardio' // 'cardio' only for single-discipline races
export type SlotRole = 'key' | 'easy' | 'technique'

export interface SlotProgression {
  incrementPct: number // relative growth applied per interval, e.g. 8 = +8%
  intervalWeeks: number
}

export interface EnduranceSlot {
  day: number // 0=Mon..6=Sun, matches WEEKDAY_NAMES/getLocalWeekdayIndex
  type: EnduranceSlotType
  role: SlotRole
  shareOfWeeklyTotal: number // this slot's fraction of the discipline's weekly km AT PHASE START
  progression: SlotProgression | null // null = flat - the "some slots ramp, some don't" mechanism
}

export interface StrengthSlot {
  day: number
}

export interface PhaseTemplate {
  enduranceSlots: EnduranceSlot[]
  strengthSlots: StrengthSlot[]
  // Days where the bike slot + run slot together ARE that week's brick -
  // informational badge only, doesn't change any math.
  brickDays: number[]
}

export type PhaseTemplates = Partial<Record<TrainingPhase, PhaseTemplate>>

const ALL_PHASES: TrainingPhase[] = ['base', 'build', 'peak', 'taper']
const DISCIPLINES: Discipline[] = ['swim', 'bike', 'run']

// Days off-limits for strength: immediately after a 'key' endurance slot
// or a brick day - the actual placement enforcement of the >=6h-
// separation / never-stack-hard-on-hard concurrent-training guidance
// already cited in STRENGTH_SEQUENCING_NOTES (periodization.ts).
export function computeRestrictedStrengthDays(hardDays: Set<number>): Set<number> {
  return new Set([...hardDays].map((d) => (d + 1) % 7))
}

// weekIndexWithinPhase: 0-based index of the week within its phase.
// Renormalizes every sibling slot's share so they always sum to exactly
// 1.0 before multiplying by the week's real, already-computed discipline
// total (from computeTrainingWeeks) - a day template can never disagree
// with the week card it's describing, since easy/technique slots
// implicitly cede share as the key slot's grows.
export function enduranceSlotKmForWeek(
  slot: EnduranceSlot,
  siblingSlots: EnduranceSlot[],
  weekIndexWithinPhase: number,
  weekDisciplineTotalKm: number
): number {
  const rawShare = (s: EnduranceSlot) =>
    s.progression
      ? s.shareOfWeeklyTotal * Math.pow(1 + s.progression.incrementPct / 100, Math.floor(weekIndexWithinPhase / s.progression.intervalWeeks))
      : s.shareOfWeeklyTotal

  const total = siblingSlots.reduce((sum, s) => sum + rawShare(s), 0)
  return total > 0 ? weekDisciplineTotalKm * (rawShare(slot) / total) : 0
}

// Peak-appropriate share for the key slot, scaled down as session count
// rises - not independently sourced, just a reasonable split so the key
// slot is always clearly the largest.
function keyShareForSessionCount(sessions: number): number {
  if (sessions <= 1) return 1
  if (sessions === 2) return 0.55
  if (sessions === 3) return 0.45
  return 0.4
}

// Only Build/Peak assign a progression to the key slot - Base is
// foundation/technique (no within-phase shape shift beyond the week-
// level ramp already happening) and Taper is already cutting back, so
// neither reshapes further. Peak's progression matters most since
// Peak's week-level total is flat (rampValue holds at `peak` for the
// whole phase) - any felt growth in the key session there is entirely
// attributable to this share-shift.
const PROGRESSION_BY_PHASE: Record<TrainingPhase, SlotProgression | null> = {
  base: null,
  build: { incrementPct: 5, intervalWeeks: 2 },
  peak: { incrementPct: 8, intervalWeeks: 2 },
  taper: null,
}

function buildEnduranceSlots(type: EnduranceSlotType, days: number[], phase: TrainingPhase, progressionForKey: SlotProgression | null): EnduranceSlot[] {
  if (days.length === 0) return []

  // Swim in Base is technique-building, not volume-specific (published
  // triathlon swim-coaching guidance) - every slot stays flat regardless
  // of role, a concrete grounded example of "some session types
  // legitimately stay flat," not a blanket rule. Swim's non-key slots
  // in every other phase are technique/drill sessions alongside the key
  // one, also flat.
  const swimBaseTechnique = type === 'swim' && phase === 'base'
  const keyShare = keyShareForSessionCount(days.length)
  const restShare = days.length > 1 ? (1 - keyShare) / (days.length - 1) : 0

  return days.map((day, i) => {
    const isKey = i === 0 && !swimBaseTechnique
    const role: SlotRole = swimBaseTechnique ? 'technique' : isKey ? 'key' : type === 'swim' ? 'technique' : 'easy'
    return {
      day,
      type,
      role,
      shareOfWeeklyTotal: days.length === 1 ? 1 : isKey ? keyShare : restShare,
      progression: isKey ? progressionForKey : null,
    }
  })
}

// Round-robin day assignment, skipping days already in `blockedDays` -
// simple, even spacing, not an optimizer (same "not real sports
// science" honesty as periodization.ts's allocatePhases). Mutates
// `blockedDays` with the days it places, so repeated calls sharing the
// same set naturally avoid colliding with each other.
function assignDays(count: number, blockedDays: Set<number>, preferredStart = 0): number[] {
  const days: number[] = []
  let cursor = preferredStart
  let attempts = 0
  while (days.length < count && attempts < 7) {
    if (!blockedDays.has(cursor)) {
      days.push(cursor)
      blockedDays.add(cursor)
    }
    cursor = (cursor + 2) % 7 // spread sessions rather than clumping
    attempts++
  }
  for (let d = 0; days.length < count && d < 7; d++) {
    if (!blockedDays.has(d)) {
      days.push(d)
      blockedDays.add(d)
    }
  }
  return days
}

function buildPhaseTemplate(week: TrainingWeekSkeleton, phase: TrainingPhase): PhaseTemplate {
  const usedDays = new Set<number>()
  const brickDays: number[] = []

  if (week.disciplines && week.brickSessions) {
    // 1 brick -> Saturday; 2 -> Wednesday + Saturday (spread apart).
    const candidates = week.brickSessions >= 2 ? [2, 5] : [5]
    for (const d of candidates) {
      usedDays.add(d)
      brickDays.push(d)
    }
  }

  const enduranceSlots: EnduranceSlot[] = []

  if (week.disciplines) {
    for (const discipline of DISCIPLINES) {
      const sessions = week.disciplines[discipline].sessions
      if (sessions === 0) continue

      // A brick day consumes one bike slot + one run slot on the same
      // day - not additive (resolves the overlap ambiguity flagged
      // during Phase 3 inspection). Capped at `sessions` so a discipline
      // never ends up with more days than it actually has sessions.
      const brickDaysForDiscipline = discipline === 'bike' || discipline === 'run' ? brickDays.slice(0, sessions) : []
      const remaining = sessions - brickDaysForDiscipline.length
      const days = [...brickDaysForDiscipline, ...assignDays(remaining, usedDays)]

      enduranceSlots.push(...buildEnduranceSlots(discipline, days, phase, PROGRESSION_BY_PHASE[phase]))
    }
  } else if (week.targetCardioSessions > 0) {
    const days = assignDays(week.targetCardioSessions, usedDays)
    enduranceSlots.push(...buildEnduranceSlots('cardio', days, phase, PROGRESSION_BY_PHASE[phase]))
  }

  const hardDays = new Set<number>([...enduranceSlots.filter((s) => s.role === 'key').map((s) => s.day), ...brickDays])
  const restrictedDays = computeRestrictedStrengthDays(hardDays)

  const strengthSlots: StrengthSlot[] = []
  if (week.targetStrengthSessions > 0) {
    let days = assignDays(week.targetStrengthSessions, new Set([...usedDays, ...restrictedDays]))
    if (days.length < week.targetStrengthSessions) {
      // Graceful degradation: not enough non-restricted free days - allow
      // a restricted day (never one that already has an endurance
      // session) rather than under-placing strength sessions.
      days = assignDays(week.targetStrengthSessions, new Set(usedDays))
    }
    for (const day of days) strengthSlots.push({ day })
  }

  return { enduranceSlots, strengthSlots, brickDays }
}

function totalSessionsInWeek(w: TrainingWeekSkeleton): number {
  const enduranceCount = w.disciplines ? w.disciplines.swim.sessions + w.disciplines.bike.sessions + w.disciplines.run.sessions : w.targetCardioSessions
  return enduranceCount + w.targetStrengthSessions
}

// Generation is fully deterministic and code-computed - the model never
// sees or writes anything about this. Sizes each phase's template
// against whichever of its own weeks has the HIGHEST session counts -
// correct both for ramping-up phases (Base/Build, where the LAST week
// is highest) and Taper, which ramps DOWN within itself (so its FIRST
// week is highest) - "peak week" means "highest," not "last."
export function computeDayByDayTemplates(skeleton: TrainingWeekSkeleton[]): PhaseTemplates {
  const templates: PhaseTemplates = {}

  for (const phase of ALL_PHASES) {
    const weeksInPhase = skeleton.filter((w) => w.phase === phase)
    if (weeksInPhase.length === 0) continue

    const sizingWeek = weeksInPhase.reduce((best, w) => (totalSessionsInWeek(w) > totalSessionsInWeek(best) ? w : best))
    templates[phase] = buildPhaseTemplate(sizingWeek, phase)
  }

  return templates
}
