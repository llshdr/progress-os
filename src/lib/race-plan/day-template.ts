import type { TrainingPhase, TrainingWeekSkeleton, RaceApproach } from '@/lib/race-plan/periodization'
import type { Discipline } from '@/lib/race-plan/self-assessment'

export type EnduranceSlotType = 'swim' | 'bike' | 'run' | 'cardio' // 'cardio' only for single-discipline races
export type SlotRole = 'key' | 'easy' | 'technique' | 'threshold' | 'vo2max'

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
  // A usual time for this slot, e.g. "06:30" - optional and never
  // generated/guessed (see buildEnduranceSlots), only ever set by the
  // athlete via PhaseTemplateDialog. Undefined/null for every slot
  // generated before this field existed - the calendar's day view shows
  // those as all-day/untimed until a time is explicitly set. Phase-level,
  // same as day/role/progression - one time applies to every week that
  // reuses this phase's template, not a specific week.
  time?: string | null
}

// Not a full exercise-level muscle system - the smallest tag that
// enables real body-part-specific interference logic (see
// restrictedDaysForFocus below). Deterministically assigned by
// strengthFocusForSessionCount at generation time, not read from the
// model - buildPhaseTemplate is deterministic/code-computed and the AI
// call's own response schema has no per-slot strength data to reuse.
export type StrengthFocus = 'upper' | 'lower' | 'full_body'

export interface StrengthSlot {
  day: number
  // See EnduranceSlot.time above - same optional, never-guessed, phase-
  // level convention.
  time?: string | null
  // Optional (not every existing stored plan has this - it's purely
  // additive JSONB, no migration): undefined means a slot generated
  // before this field existed. See restrictedDaysForFocus for how that
  // case is handled safely (falls back to the old, more conservative
  // blanket restriction rather than assuming flexibility it can't verify).
  focus?: StrengthFocus
}

export interface PhaseTemplate {
  enduranceSlots: EnduranceSlot[]
  strengthSlots: StrengthSlot[]
  // Days where the bike slot + run slot together ARE that week's brick -
  // informational badge only, doesn't change any math.
  brickDays: number[]
  // Non-null only when this phase's sizing week (see computeDayByDayTemplates)
  // has more sessions for a discipline than there are free days left to
  // place them on - a genuinely over-subscribed week, not a rounding
  // artifact. Each entry's shortfall (requestedSessions - placedDays)
  // worth of weekly volume is deliberately left off every specific day
  // (see buildEnduranceSlots' intendedSessions param) rather than being
  // silently dumped onto whichever day did get placed - see
  // buildPhaseTemplate for where this is detected.
  dayCapacityWarning: DayCapacityWarning[] | null
}

export interface DayCapacityWarning {
  discipline: EnduranceSlotType
  requestedSessions: number
  placedDays: number
}

export type PhaseTemplates = Partial<Record<TrainingPhase, PhaseTemplate>>

// Zone/intensity guidance per role, phase-aware for 'key' since race-pace
// segments only belong once race day is close. Static, cited text - not
// model-generated, same pattern as STRENGTH_SEQUENCING_NOTES
// (periodization.ts). Zone 2 = "conversational effort" - ~70-80% of
// total training time should sit here for athletes training 8+ hrs/week
// (Tri-Revolution: https://www.tri-revolution.co.uk/tips/zone-2-training-for-triathlons/,
// D3 Multisport: https://www.d3multisport.com/d3-university/the-ideal-heart-rate-for-ironman-training,
// 80/20 Endurance: https://www.8020endurance.com/understanding-your-8020-triathlon-plan/);
// race-pace segments belong in the final part of Build and especially
// Peak, not earlier (MyProCoach: https://www.myprocoach.net/blog/how-to-structure-a-triathlon-training-program/,
// Triathlon Magazine Canada: https://triathlonmagazine.ca/training/periodize-your-triathlon-training-for-peak-race-day-performance/).
// Peak's key session is deliberately worded as "this IS race effort," not
// "Zone 2 plus a separate race-pace thing" - Ironman race pace itself is
// commonly run at ~65-72% FTP / RPE 5-6, i.e. Zone 2, specifically
// because overcooking the bike costs far more on the run than it gains
// on the bike - a single pacing decision ~30km into the bike can cost
// 15-25 minutes on the marathon (BestBikeSplit:
// https://www.bestbikesplit.com/ironman-bike-pacing-plan, 8020 Endurance
// / Jim Vance: https://www.8020endurance.com/how-to-pace-the-ironman-marathon/,
// MyProCoach: https://www.myprocoach.net/blog/how-to-pace-an-ironman-triathlon/).
// Technique work is drill-focused, not zone-based - consistent with how
// this feature already treats the 'technique' role for swim.
export const ZONE_GUIDANCE: Record<SlotRole, Record<TrainingPhase, { short: string; full: string }>> = {
  key: {
    base: { short: 'Zone 2', full: 'Zone 2, aerobic - building the long-session foundation, no race-pace work yet.' },
    build: {
      short: 'Zone 2 (building toward race effort)',
      full: "Mostly Zone 2, with occasional short race-pace segments as race day approaches - practicing the effort you'll actually hold on race day.",
    },
    peak: {
      short: 'Zone 2 = race effort',
      full: 'This IS your race effort, by design: Ironman pace is deliberately Zone 2 (commonly ~65-72% FTP, RPE 5-6/10) because overcooking it costs far more on the run than it gains on the bike - a single pacing decision ~30km into the bike can cost 15-25 minutes on the marathon.',
    },
    taper: { short: 'Zone 2', full: 'Zone 2, shorter - keep the intensity, cut the duration.' },
  },
  easy: {
    base: { short: 'Zone 1-2', full: 'Zone 1-2, recovery effort - conversational pace throughout.' },
    build: { short: 'Zone 1-2', full: 'Zone 1-2, recovery effort - conversational pace throughout.' },
    peak: { short: 'Zone 1-2', full: 'Zone 1-2, recovery effort - conversational pace throughout.' },
    taper: { short: 'Zone 1-2', full: 'Zone 1-2, recovery effort - conversational pace throughout.' },
  },
  technique: {
    base: { short: 'Drills', full: 'Drill-focused, not zone-based - about form, not effort.' },
    build: { short: 'Drills', full: 'Drill-focused, not zone-based - about form, not effort.' },
    peak: { short: 'Drills', full: 'Drill-focused, not zone-based - about form, not effort.' },
    taper: { short: 'Drills', full: 'Drill-focused, not zone-based - about form, not effort.' },
  },
  // Controlled Zone 3-4 work, not a VO2max/all-out interval session -
  // per Stephen Seiler's 80/20 rule (the most cited, evidence-backed
  // framework in endurance sport), roughly 1-2 quality/hard sessions a
  // week is the correct ceiling, not more - this feature caps it at
  // exactly one per discipline per week (see buildEnduranceSlots).
  // Never present in Base (foundation first, no quality work yet) -
  // introduced in Build, race-specific in Peak, deliberately minimal in
  // Taper.
  threshold: {
    base: { short: 'N/A', full: 'No threshold work yet in Base - foundation first.' },
    build: {
      short: 'Zone 3-4 (threshold)',
      full: 'A controlled, sustained hard effort - Zone 3-4, RPE 6-7/10, comfortably hard but not all-out. This is where real threshold adaptation happens; keep it controlled, not a race.',
    },
    peak: {
      short: 'Zone 3-4, race-specific',
      full: 'Threshold work here is race-specific - segments that mimic race-day surges or sustained hard efforts, still controlled (RPE 6-7/10), not a max-effort interval session.',
    },
    taper: {
      short: 'Short and sharp',
      full: "If included at all, keep it brief - a short, sharp reminder of race intensity, not a real training stimulus this close to race day.",
    },
  },
  // Genuine Zone 5/VO2max work - distinct from (and stacked, never
  // additional to, the existing ~1-2 quality-sessions/week ceiling
  // already enforced via 'threshold') - "the tap determines the floor":
  // a higher max sustainable effort makes race-pace Zone 2 feel easier.
  // Bike/swim only, never run (running full race distance in training
  // and high running intensity are both universally advised against for
  // injury-risk reasons - research confirmed, no exception carved out
  // here) - see effectiveSlotRole below, the only place this role is
  // ever actually assigned (ZONE_GUIDANCE still needs every phase for
  // its Record<SlotRole, Record<TrainingPhase,...>> shape, even though
  // only 'peak' is ever reached in practice).
  vo2max: {
    base: { short: 'N/A', full: 'No VO2max work in Base - foundation first.' },
    build: { short: 'N/A', full: 'No VO2max work in Build - threshold work only until Peak.' },
    peak: {
      short: 'Zone 5, sparingly',
      full: 'A genuine all-out effort - Zone 5, short high-intensity intervals, full recovery between reps. Used sparingly (at most every 2-3 weeks) to raise your performance ceiling, not as a regular training stimulus.',
    },
    taper: { short: 'N/A', full: 'No VO2max work this close to race day.' },
  },
}

const ALL_PHASES: TrainingPhase[] = ['base', 'build', 'peak', 'taper']
const DISCIPLINES: Discipline[] = ['swim', 'bike', 'run']

// Days off-limits for strength: immediately after a 'key' endurance slot
// or a brick day - the actual placement enforcement of the >=6h-
// separation / never-stack-hard-on-hard concurrent-training guidance
// already cited in STRENGTH_SEQUENCING_NOTES (periodization.ts).
export function computeRestrictedStrengthDays(hardDays: Set<number>): Set<number> {
  return new Set([...hardDays].map((d) => (d + 1) % 7))
}

// A reasonable default split, not independently sourced - same honesty
// precedent as BASE_START_FRACTION_OF_PEAK/the acclimation weeks split
// elsewhere in this feature. Deliberately stays within upper/lower/
// full_body (never invents a finer split like push/pull/legs) - that's
// the whole point of keeping this the smallest honest tag, not a full
// exercise-level muscle system.
const STRENGTH_FOCUS_ROTATION: Record<number, StrengthFocus[]> = {
  1: ['full_body'],
  2: ['upper', 'lower'],
  3: ['upper', 'lower', 'full_body'],
  4: ['upper', 'lower', 'upper', 'lower'],
  5: ['upper', 'lower', 'upper', 'lower', 'full_body'],
}

function strengthFocusForSessionCount(sessions: number): StrengthFocus[] {
  const table = STRENGTH_FOCUS_ROTATION[sessions]
  if (table) return table
  // Beyond the known range (shouldn't happen - STRENGTH_SESSION_CAPS
  // tops out at 5) - a safe fallback rather than crashing or returning
  // too few entries.
  return Array.from({ length: sessions }, (_, i) => (i % 2 === 0 ? 'upper' : 'lower'))
}

// A full-body session typically includes real lower-body loading -
// treated identically to a dedicated lower-body day, not a partial/
// discounted restriction. There's no real data to size a fractional
// adjustment confidently, and this feature's own precedent throughout
// is to stay conservative rather than fabricate that precision.
export function involvesLowerBody(focus: StrengthFocus): boolean {
  return focus === 'lower' || focus === 'full_body'
}

// Muscle-group-aware day-after restriction, grounded in real concurrent-
// training research (cited in full in STRENGTH_SEQUENCING_NOTES's own
// neighborhood, periodization.ts):
//  - Interference is muscle-group-specific, not systemic - lower-body
//    endurance doesn't meaningfully hurt upper-body strength outcomes
//    (Wilson et al.-style concurrent-training meta-analyses).
//  - Running specifically causes measurable interference with
//    hypertrophy/strength; cycling showed no significant interference in
//    the same analysis.
//  - Swimming causes LESS interference than running (lower inflammatory/
//    mechanical load) - concurrent resistance training alongside
//    swimming has even shown performance benefits, not just neutral
//    coexistence.
// So: only RUN's hard days (key/threshold/vo2max + brick, since a brick
// always has a run leg) ever trigger the day-after restriction, and only
// for focuses that involve the lower body - upper gets none at all. The
// SAME-day block (hardDays, unchanged, computed by the caller) stays
// universal across every discipline and focus - the cited research
// frames same-day hard+hard pairing as a general fatigue/recovery-
// capacity risk, not a muscle-specific molecular one, so that part was
// never discipline-specific to begin with.
//
// focus undefined means a strength slot generated before this field
// existed (no migration - purely additive JSONB) - falls back to the
// full, unfiltered hardDays (allHardDays, every discipline) rather than
// assuming a flexibility that was never actually verified for that slot,
// so old plans' behavior stays exactly as conservative as it always was.
export function restrictedDaysForFocus(focus: StrengthFocus | undefined, runHardDays: Set<number>, allHardDays: Set<number>): Set<number> {
  if (focus == null) return computeRestrictedStrengthDays(allHardDays)
  if (!involvesLowerBody(focus)) return new Set()
  return computeRestrictedStrengthDays(runHardDays)
}

// The one endurance slot (if any) sharing a day with a strength slot -
// used for the same-day sequencing note (see STRENGTH_SEQUENCING_NOTES's
// own citation: same-session order has small/negligible effect on most
// adaptations, so this is informational, not a new restriction. The
// real risk - pairing hard+hard the same day - is already prevented by
// hardDays blocking strength from ever sharing a day with a key/
// threshold/vo2max/brick slot in the first place, so whatever this
// finds is structurally guaranteed to be an easy/technique slot, a
// genuinely fine pairing per that same guidance).
export function sameDayEnduranceSlot(day: number, enduranceSlots: EnduranceSlot[]): EnduranceSlot | null {
  return enduranceSlots.find((s) => s.day === day) ?? null
}

// weekIndexWithinPhase: 0-based index of the week within its phase.
// Renormalizes every sibling slot's share so they always sum to exactly
// 1.0 before multiplying by the week's real, already-computed discipline
// total (from computeTrainingWeeks) - a day template can never disagree
// with the week card it's describing, since easy/technique slots
// implicitly cede share as the key slot's grows.
//
// protectedKeyKm (bike only, set when a guaranteed commute applies - see
// DisciplineTarget.protectedKeyKm/commuteAdjustedDisciplineWeek in
// periodization.ts): when present, the key slot's km comes directly from
// this fixed value instead of being re-derived via share/total below.
// Re-deriving it here from weekDisciplineTotalKm was the exact
// circularity the commute-load investigation found - this function
// would silently re-shrink the "protected" key value on every render.
// Non-key slots still split by share, but against what's actually left
// AFTER the protected key ride (weekDisciplineTotalKm - protectedKeyKm),
// not the full total, so they never silently absorb km that's already
// spoken for. Progression's within-phase ramp-in still applies to the
// protected value itself (unaffected discipline/weeks - protectedKeyKm
// undefined - behave exactly as before, byte-for-byte).
export function enduranceSlotKmForWeek(
  slot: EnduranceSlot,
  siblingSlots: EnduranceSlot[],
  weekIndexWithinPhase: number,
  weekDisciplineTotalKm: number,
  protectedKeyKm?: number | null
): number {
  // Bounded linear ramp from startShareFraction*target up to the target
  // itself (never past it) - a previous compounding-%-per-interval model
  // could overshoot its own stored target share; this can't.
  const rampedFraction = (progression: SlotProgression) => {
    const progress = Math.min(1, weekIndexWithinPhase / Math.max(1, progression.rampWeeks))
    return progression.startShareFraction + (1 - progression.startShareFraction) * progress
  }

  if (protectedKeyKm != null && slot.role === 'key') {
    return slot.progression ? protectedKeyKm * rampedFraction(slot.progression) : protectedKeyKm
  }

  const rawShare = (s: EnduranceSlot) => (s.progression ? s.shareOfWeeklyTotal * rampedFraction(s.progression) : s.shareOfWeeklyTotal)

  const remainingKm = protectedKeyKm != null ? Math.max(0, weekDisciplineTotalKm - protectedKeyKm) : weekDisciplineTotalKm
  const nonKeySiblings = protectedKeyKm != null ? siblingSlots.filter((s) => s.role !== 'key') : siblingSlots
  const total = nonKeySiblings.reduce((sum, s) => sum + rawShare(s), 0)
  return total > 0 ? remainingKm * (rawShare(slot) / total) : 0
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

// intendedSessions: the discipline's REAL requested session count for
// this week (week.disciplines[d].sessions), which can exceed days.length
// when buildPhaseTemplate ran out of free days to place all of them (see
// its dayCapacityWarning detection). Defaults to days.length, so every
// normal (non-shortfall) call site is byte-for-byte unchanged. When they
// differ, KEY_SHARE is looked up against the INTENDED count (so the
// placed key slot still only gets its rightful share, e.g. 75% of 3
// intended sessions, never inflating to 100% just because 2 siblings
// didn't get a day) and the unplaced siblings' share is deliberately left
// off every specific day rather than silently reassigned to whichever
// slot did get placed - see buildPhaseTemplate/dayCapacityWarning.
function buildEnduranceSlots(
  type: EnduranceSlotType,
  days: number[],
  phase: TrainingPhase,
  progressionForKey: SlotProgression | null,
  approach: RaceApproach,
  intendedSessions: number = days.length
): EnduranceSlot[] {
  if (days.length === 0) return []

  // Swim in Base is technique-building, not volume-specific (published
  // triathlon swim-coaching guidance) - every slot stays flat regardless
  // of role, a concrete grounded example of "some session types
  // legitimately stay flat," not a blanket rule. Swim's non-key slots
  // in every other phase are technique/drill sessions alongside the key
  // one, also flat.
  const swimBaseTechnique = type === 'swim' && phase === 'base'
  const keyShare = keyShareForSessionCount(type, intendedSessions)
  const restShare = intendedSessions > 1 ? (1 - keyShare) / (intendedSessions - 1) : 0

  // At most one non-key slot per discipline gets promoted to threshold
  // intensity - never in Base (foundation first), never on the key slot
  // itself (key stays Zone 2 race pace by design), and only when a real
  // non-key slot exists to promote. Capped at exactly one per Seiler's
  // 80/20 rule (see ZONE_GUIDANCE.threshold above).
  //
  // Muscle-leaning/muscle-focused approaches route this toward swim/bike
  // over run: running carries measurably more injury-risk load AND a
  // documented hypertrophy-interference effect vs. cycling (eccentric
  // loading/inflammatory response) - real, sourced component facts, but
  // not a single named "muscle-preservation protocol," so this is worded
  // honestly in the UI as lower interference + lower injury risk, never
  // as an established technique.
  const muscleFocusedApproach = approach === 'muscle_leaning' || approach === 'muscle_focused'
  const skipThresholdForRun = type === 'run' && muscleFocusedApproach
  const thresholdDayIndex = phase !== 'base' && intendedSessions >= 2 && !skipThresholdForRun ? 1 : -1

  return days.map((day, i) => {
    const isKey = i === 0 && !swimBaseTechnique
    const isThreshold = i === thresholdDayIndex
    const role: SlotRole = swimBaseTechnique
      ? 'technique'
      : isKey
        ? 'key'
        : isThreshold
          ? 'threshold'
          : type === 'swim'
            ? 'technique'
            : 'easy'
    return {
      day,
      type,
      role,
      shareOfWeeklyTotal: intendedSessions === 1 ? 1 : isKey ? keyShare : restShare,
      progression: isKey ? progressionForKey : null,
    }
  })
}

// Round-robin day assignment, skipping days already in `blockedDays` -
// simple, even spacing, not an optimizer (same "not real sports
// science" honesty as periodization.ts's allocatePhases). Mutates
// `blockedDays` with the days it places, so repeated calls sharing the
// same set naturally avoid colliding with each other. Exported so
// PhaseTemplateDialog's "redistribute around unavailable days" action
// reuses this exact placement primitive instead of a second, parallel
// implementation.
export function assignDays(count: number, blockedDays: Set<number>, preferredStart = 0): number[] {
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

// Long/key endurance sessions default to a weekend day (assumes more
// available time then) rather than wherever assignDays' plain Monday-
// start round-robin happens to land - a thin wrapper around assignDays,
// not a separate mechanism: only the FIRST (key) day gets the weekend
// preference, the rest are placed by the exact same unmodified assignDays
// call as before. Falls back to assignDays' own round-robin (starting
// from day 0, same as the un-decomposed original call) when both
// weekend days are already taken - never fights or duplicates the
// existing hardDay/restrictedDay logic, since those are computed
// downstream from wherever slots end up, never fed back into placement.
function assignKeyDayThenRest(count: number, blockedDays: Set<number>, preferredKeyDays: number[] = [5, 6]): number[] {
  if (count === 0) return []

  let keyDay = preferredKeyDays.find((d) => !blockedDays.has(d))
  if (keyDay != null) {
    blockedDays.add(keyDay)
  } else {
    ;[keyDay] = assignDays(1, blockedDays, 0)
  }
  if (keyDay == null) return [] // fully booked week - same degradation the un-decomposed assignDays would already show here

  const rest = count > 1 ? assignDays(count - 1, blockedDays, (keyDay + 1) % 7) : []
  return [keyDay, ...rest]
}

// A key brick's bike leg exceeding this is a genuinely long ride
// (2x TYPICAL_SESSION_KM.bike, periodization.ts) - not realistic to
// follow with a run leg on a weekday given normal work/time constraints.
// Below this, a weekday brick is fine (matches this file's existing
// Wed/Sat default) - only large bricks need to move to the weekend.
const LARGE_BRICK_KEY_KM_THRESHOLD = 90

function buildPhaseTemplate(week: TrainingWeekSkeleton, phase: TrainingPhase, approach: RaceApproach): PhaseTemplate {
  const usedDays = new Set<number>()
  const brickDays: number[] = []

  if (week.disciplines && week.brickSessions) {
    // 1 brick -> Saturday. 2 bricks -> Wednesday + Saturday, ordered so
    // whichever day is FIRST in this array claims the key/larger brick
    // (buildEnduranceSlots always treats a discipline's first day as its
    // key slot) - Saturday leads when the key brick's bike leg is large
    // enough that a weekday pairing with a run leg isn't realistic;
    // otherwise Wednesday leading (the original default) is fine.
    const bikeSessions = week.disciplines.bike.sessions
    const bikeKeyKm =
      week.disciplines.bike.protectedKeyKm ?? (bikeSessions > 0 ? week.disciplines.bike.km * keyShareForSessionCount('bike', bikeSessions) : 0)
    const largeBrick = bikeKeyKm > LARGE_BRICK_KEY_KM_THRESHOLD
    const candidates = week.brickSessions >= 2 ? (largeBrick ? [5, 2] : [2, 5]) : [5]
    for (const d of candidates) {
      usedDays.add(d)
      brickDays.push(d)
    }
  }

  const enduranceSlots: EnduranceSlot[] = []
  const dayCapacityWarnings: DayCapacityWarning[] = []

  if (week.disciplines) {
    // Only ONE discipline per week gets true weekend-day priority for its
    // key session - coordinating across disciplines within a single
    // generation pass, rather than letting each discipline independently
    // grab a weekend day and risk clustering two key/hard sessions on
    // adjacent days. Bike first (longest, most time-demanding session,
    // most in need of a free weekend day), falling back to run when bike
    // has no sessions this week; swim never gets weekend priority (its
    // key session is shorter and its share is already the most evenly
    // split of the three - see KEY_SHARE). Every other discipline places
    // via plain assignDays (unchanged, pre-weekend-bias round-robin
    // starting from Monday), which naturally lands away from whichever
    // weekend day the priority discipline took.
    const priorityDiscipline: Discipline | null =
      week.disciplines.bike.sessions > 0 ? 'bike' : week.disciplines.run.sessions > 0 ? 'run' : null

    for (const discipline of DISCIPLINES) {
      const sessions = week.disciplines[discipline].sessions
      if (sessions === 0) continue

      // A brick day consumes one bike slot + one run slot on the same
      // day - not additive (resolves the overlap ambiguity flagged
      // during Phase 3 inspection). Capped at `sessions` so a discipline
      // never ends up with more days than it actually has sessions.
      const brickDaysForDiscipline = discipline === 'bike' || discipline === 'run' ? brickDays.slice(0, sessions) : []
      const remaining = sessions - brickDaysForDiscipline.length
      // A brick day already claims the key slot for free (brickDays
      // defaults to Saturday-leading - see above), so weekend-biasing
      // only needs to apply when there's no brick already doing that job
      // for this discipline this week, and only for the one priority
      // discipline this week (see priorityDiscipline above).
      const useWeekendBias = discipline === priorityDiscipline && brickDaysForDiscipline.length === 0
      const remainingDays = useWeekendBias ? assignKeyDayThenRest(remaining, usedDays) : assignDays(remaining, usedDays)
      const days = [...brickDaysForDiscipline, ...remainingDays]

      // The week ran out of free days to place every requested session -
      // flag it rather than letting buildEnduranceSlots silently treat
      // the truncated day count as the real plan (see its intendedSessions
      // param and shareOfWeeklyTotal comment above).
      if (days.length < sessions) {
        dayCapacityWarnings.push({ discipline, requestedSessions: sessions, placedDays: days.length })
      }

      enduranceSlots.push(...buildEnduranceSlots(discipline, days, phase, PROGRESSION_BY_PHASE[phase], approach, sessions))
    }
  } else if (week.targetCardioSessions > 0) {
    const days = assignDays(week.targetCardioSessions, usedDays)
    if (days.length < week.targetCardioSessions) {
      dayCapacityWarnings.push({ discipline: 'cardio', requestedSessions: week.targetCardioSessions, placedDays: days.length })
    }
    enduranceSlots.push(...buildEnduranceSlots('cardio', days, phase, PROGRESSION_BY_PHASE[phase], approach, week.targetCardioSessions))
  }

  // 'threshold' slots are hard days too - without this, the existing
  // strength-sequencing interference protection (computeRestrictedStrengthDays/
  // STRENGTH_SEQUENCING_NOTES) would silently not apply to them.
  // 'vo2max' is included defensively - today it's only ever assigned by
  // effectiveSlotRole at DISPLAY time (the stored role here is always
  // still 'threshold', already covered above), so this is currently a
  // no-op, but a VO2max effort is at least as demanding as threshold and
  // must never lose this protection if that representation ever changes.
  const hardDays = new Set<number>([
    ...enduranceSlots.filter((s) => s.role === 'key' || s.role === 'threshold' || s.role === 'vo2max').map((s) => s.day),
    ...brickDays,
  ])
  // Run-specific subset, for the muscle-group-aware day-after restriction
  // (see restrictedDaysForFocus) - brick days included, since a brick
  // always has a run leg carrying the same interference profile.
  const runHardDays = new Set<number>([
    ...enduranceSlots.filter((s) => s.type === 'run' && (s.role === 'key' || s.role === 'threshold' || s.role === 'vo2max')).map((s) => s.day),
    ...brickDays,
  ])

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
    //
    // Placed one focus at a time (not all at once via a single assignDays
    // call, unlike before) since each focus now carries its own
    // restricted-day set - upper gets none, lower/full_body get run's
    // day-after set specifically (see restrictedDaysForFocus). Same
    // last-resort degradation as before: relax the day-after restriction
    // first, never place strength directly on a key/brick day itself.
    const usedStrengthDays = new Set<number>()
    for (const focus of strengthFocusForSessionCount(week.targetStrengthSessions)) {
      const restricted = restrictedDaysForFocus(focus, runHardDays, hardDays)
      let [day] = assignDays(1, new Set([...hardDays, ...usedStrengthDays, ...restricted]))
      if (day == null) {
        day = assignDays(1, new Set([...hardDays, ...usedStrengthDays]))[0]
      }
      if (day == null) continue // fully booked week - same silent degradation the original code already tolerated
      usedStrengthDays.add(day)
      strengthSlots.push({ day, focus })
    }
  }

  return { enduranceSlots, strengthSlots, brickDays, dayCapacityWarning: dayCapacityWarnings.length > 0 ? dayCapacityWarnings : null }
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

// excludeDay: the literal race day's weekday index (0=Mon..6=Sun, see
// getLocalWeekdayIndex), passed only by the caller when `week` is the
// actual race week - the phase-level template is sized against a
// different (non-race) week within the same phase, so it can and
// commonly does place a session on that weekday. The athlete is racing
// that day, not training, so both slot types are filtered out here at
// the per-week reduction step rather than trying to keep race day out of
// the phase-level template in the first place.
export function slotsForWeek(template: PhaseTemplate, week: TrainingWeekSkeleton, excludeDay?: number | null): WeekSlots {
  const brickDays = (week.brickSessions ? template.brickDays.slice(0, week.brickSessions) : []).filter((d) => d !== excludeDay)
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
    const candidates = template.enduranceSlots.filter((s) => s.type === type && s.day !== excludeDay)
    const prioritized = [...candidates].sort((a, b) => slotPriority(a) - slotPriority(b))
    enduranceSlots.push(...prioritized.slice(0, Math.min(targetCount, candidates.length)))
  }

  const strengthSlots = template.strengthSlots.filter((s) => s.day !== excludeDay).slice(0, Math.min(week.targetStrengthSessions, template.strengthSlots.length))

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
export function computeDayByDayTemplates(skeleton: TrainingWeekSkeleton[], approach: RaceApproach): PhaseTemplates {
  const templates: PhaseTemplates = {}

  for (const phase of ALL_PHASES) {
    const weeksInPhase = skeleton.filter((w) => w.phase === phase)
    if (weeksInPhase.length === 0) continue

    const sizingWeek = weeksInPhase.reduce((best, w) => (totalSessionsInWeek(w) > totalSessionsInWeek(best) ? w : best))
    templates[phase] = buildPhaseTemplate(sizingWeek, phase, approach)
  }

  return templates
}

// Opportunistic threshold-pace proxy only - reuses the athlete's own
// already-captured recentTimeTrial (self-assessment.ts) ONLY when its
// duration falls in a real threshold-test-like window per discipline
// (CSS/FTP/10K-equivalent test durations - TrainingPeaks/dincalculator/
// Total Tri Training, already cited elsewhere in this feature's pace
// work), degrading to null (never a misapplied guess) otherwise. Never
// a substitute for real protocol-based capture (an actual CSS/FTP
// test) - that stays its own separate, bigger future phase. Returns
// sec/km, same convention as pace-units.ts.
const THRESHOLD_TEST_WINDOW_SECONDS: Record<Discipline, { min: number; max: number }> = {
  swim: { min: 10 * 60, max: 30 * 60 },
  bike: { min: 15 * 60, max: 25 * 60 },
  run: { min: 20 * 60, max: 45 * 60 },
}

export function thresholdPaceHint(discipline: Discipline, recentTimeTrial: { distanceKm: number; timeSeconds: number } | null): number | null {
  if (!recentTimeTrial || recentTimeTrial.distanceKm <= 0) return null
  const window = THRESHOLD_TEST_WINDOW_SECONDS[discipline]
  if (recentTimeTrial.timeSeconds < window.min || recentTimeTrial.timeSeconds > window.max) return null
  return recentTimeTrial.timeSeconds / recentTimeTrial.distanceKm
}

// ─── VO2max cadence (Part A extension) ─────────────────────────────────
// A genuine 5th slot role would need its own generated slot, but
// computeDayByDayTemplates builds exactly ONE static template per phase,
// reused for every week in it (see slotsForWeek) - there's no existing
// per-week variation mechanism to hang "every 2-3 weeks" off inside
// generation, and building one would be a far bigger change than this
// warrants. So this stays a DISPLAY-time relabeling: the underlying
// stored slot role is always still 'threshold' (same session, same
// hardDays protection, same 1-per-discipline-per-week cap via
// thresholdDayIndex above - this never adds a session, only relabels an
// existing one on qualifying weeks). Only ever called from the real
// per-week view (WeekDayList), never PhaseTemplateDialog - that dialog's
// own copy says "Repeats every week of this phase," and a week-varying
// label there would contradict it.
//
// Cadence: `% 3 === 2` gives exactly one qualifying week per 3-week
// block (weeks 2, 5, 8, ...) - safely within "at most every 2-3 weeks"
// (never more frequent), never the very first Peak week. A reasonable,
// clearly-labeled cadence choice, not independently sourced to a
// specific weekly modulus - same honesty precedent as this file's other
// synthesized constants (KEY_SHARE, PROGRESSION_BY_PHASE).
const VO2MAX_CADENCE_WEEKS = 3
const VO2MAX_CADENCE_OFFSET = 2

// Gated to race_focused/race_leaning/race_balanced-style approaches only
// (never muscle_leaning/muscle_focused, which already deliberately route
// intensity away from anything competing further with strength recovery
// capacity - see buildEnduranceSlots' own muscleFocusedApproach comment)
// and bike/swim only, never run (running full race distance in training,
// and high running intensity generally, are both universally advised
// against for injury-risk reasons - confirmed via research, no exception
// carved out here).
const VO2MAX_ELIGIBLE_APPROACHES: RaceApproach[] = ['race_focused', 'race_leaning', 'balanced']

export function effectiveSlotRole(slot: EnduranceSlot, phase: TrainingPhase, weekIndexWithinPhase: number, approach: RaceApproach): SlotRole {
  if (slot.role !== 'threshold') return slot.role
  if (phase !== 'peak' || slot.type === 'run' || slot.type === 'cardio') return slot.role
  if (!VO2MAX_ELIGIBLE_APPROACHES.includes(approach)) return slot.role
  return weekIndexWithinPhase % VO2MAX_CADENCE_WEEKS === VO2MAX_CADENCE_OFFSET ? 'vo2max' : slot.role
}
