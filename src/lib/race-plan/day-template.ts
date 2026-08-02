import type { TrainingPhase, TrainingWeekSkeleton } from '@/lib/race-plan/periodization'
import type { Discipline } from '@/lib/race-plan/self-assessment'

export type EnduranceSlotType = 'swim' | 'bike' | 'run' | 'cardio' // 'cardio' only for single-discipline races
export type SlotRole = 'key' | 'easy' | 'technique'

export interface SlotProgression {
  startShareFraction: number // this slot's share at week 0 of the phase, as a fraction of its target shareOfWeeklyTotal (e.g. 0.65 = starts at 65% of eventual target)
  rampWeeks: number // reaches the full target share after this many weeks; holds there after - never overshoots the target
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
  // Bounded linear ramp from startShareFraction*target up to the target
  // itself (never past it) - a previous compounding-%-per-interval model
  // could overshoot its own stored target share; this can't.
  const rawShare = (s: EnduranceSlot) => {
    if (!s.progression) return s.shareOfWeeklyTotal
    const progress = Math.min(1, weekIndexWithinPhase / Math.max(1, s.progression.rampWeeks))
    return s.shareOfWeeklyTotal * (s.progression.startShareFraction + (1 - s.progression.startShareFraction) * progress)
  }

  const total = siblingSlots.reduce((sum, s) => sum + rawShare(s), 0)
  return total > 0 ? weekDisciplineTotalKm * (rawShare(slot) / total) : 0
}

// Real Ironman weeks are built around ONE clearly dominant long session
// per discipline, not an even split - published guidance (Beginner
// Triathlete/MyMottiv plans already cited above, TrainingPeaks, Triathlete,
// 220 Triathlon) puts the long ride at ~70-85% of weekly bike km, the long
// run at ~55-65% of weekly run km. Swim is the exception - technique and
// endurance work are more evenly distributed by design, so its long swim
// is only ~40-50%. 'cardio' (single-discipline run races) follows run's
// shape but can exceed 3 sessions/week, unlike the multisport disciplines
// (see DISCIPLINE_MAX_SESSIONS in periodization.ts).
const KEY_SHARE: Record<EnduranceSlotType, Record<number, number>> = {
  bike: { 1: 1.0, 2: 0.8, 3: 0.75 },
  run: { 1: 1.0, 2: 0.65, 3: 0.6 },
  cardio: { 1: 1.0, 2: 0.65, 3: 0.6, 4: 0.58, 5: 0.56, 6: 0.55, 7: 0.55 },
  swim: { 1: 1.0, 2: 0.5, 3: 0.45 },
}

function keyShareForSessionCount(type: EnduranceSlotType, sessions: number): number {
  const table = KEY_SHARE[type]
  if (table[sessions] != null) return table[sessions]
  const knownCounts = Object.keys(table).map(Number)
  return table[Math.max(...knownCounts)]
}

// Only Build ramps the key slot's share - Base is foundation/technique
// (no within-phase shape shift beyond the week-level ramp already
// happening). Peak is deliberately frozen (null), not ramping further:
// real plans reach peak long-ride/run-session distance by mid-Build and
// REPEAT it through Peak (Peak's week-level total is already flat via
// rampValue) rather than continuing to grow every week - Hal Higdon's
// well-known marathon plan is the clearest public example (peak 20-miler
// repeated in weeks 17/19/21, not escalating past 20). Taper stays null
// too - already cutting back, no reason to reshape further.
// rampWeeks=6/startShareFraction=0.65 are synthesized, not independently
// sourced to the exact week/fraction - a reasonable ramp-in shape, not a
// claim of precise research.
const PROGRESSION_BY_PHASE: Record<TrainingPhase, SlotProgression | null> = {
  base: null,
  build: { startShareFraction: 0.65, rampWeeks: 6 },
  peak: null,
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
  const keyShare = keyShareForSessionCount(type, days.length)
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
    // Strength MAY share a day with an easy/technique endurance slot -
    // same-day pairing with low-intensity endurance is the research-
    // backed guidance already cited in STRENGTH_SEQUENCING_NOTES
    // (periodization.ts: "pair it with an easy day instead" / "keep
    // strength on easy days only") - only key/brick days and the day
    // right after them stay off-limits. This (plus the lower
    // DISCIPLINE_MAX_SESSIONS caps) is what keeps a realistic week's
    // total sessions representable within 7 calendar days.
    let days = assignDays(week.targetStrengthSessions, new Set([...hardDays, ...restrictedDays]))
    if (days.length < week.targetStrengthSessions) {
      // Last-resort degradation: relax even the day-after restriction,
      // but never place strength directly on a key/brick day itself.
      days = assignDays(week.targetStrengthSessions, new Set(hardDays))
    }
    for (const day of days) strengthSlots.push({ day })
  }

  return { enduranceSlots, strengthSlots, brickDays }
}

// Reduces a phase's template down to what THIS specific week actually
// has - the piece the count-mismatch bug was missing. A week's own
// session counts (week.disciplines[d].sessions/targetCardioSessions/
// targetStrengthSessions) ramp continuously within Base/Build and
// decrease across Taper, but computeDayByDayTemplates sizes one static
// template against the phase's single highest-count week; every other
// week needs a subset of that template's slots, not the whole thing.
//
// Priority when a discipline's real count this week is lower than the
// template's slot count for it: any slot on a day that's this week's
// actual brick day, then the 'key' slot, then the rest in day order.
// week.brickSessions is phase-constant except on the literal race week
// (forced to 0 - see periodization.ts's computeTrainingWeeks), so
// brickDays only ever needs to shrink to [] there, never partially.
export interface WeekSlots {
  enduranceSlots: EnduranceSlot[]
  strengthSlots: StrengthSlot[]
  brickDays: number[]
}

export function slotsForWeek(template: PhaseTemplate, week: TrainingWeekSkeleton): WeekSlots {
  const brickDays = week.brickSessions ? template.brickDays.slice(0, week.brickSessions) : []
  const brickDaySet = new Set(brickDays)

  const slotPriority = (s: EnduranceSlot): number => {
    if (brickDaySet.has(s.day) && (s.type === 'bike' || s.type === 'run')) return 0
    if (s.role === 'key') return 1
    return 2
  }

  const enduranceSlots: EnduranceSlot[] = []
  const types: EnduranceSlotType[] = week.disciplines ? ['swim', 'bike', 'run'] : ['cardio']
  for (const type of types) {
    const targetCount = week.disciplines ? week.disciplines[type as Discipline].sessions : week.targetCardioSessions
    const candidates = template.enduranceSlots.filter((s) => s.type === type)
    const prioritized = [...candidates].sort((a, b) => slotPriority(a) - slotPriority(b))
    enduranceSlots.push(...prioritized.slice(0, Math.min(targetCount, candidates.length)))
  }

  const strengthSlots = template.strengthSlots.slice(0, Math.min(week.targetStrengthSessions, template.strengthSlots.length))

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
