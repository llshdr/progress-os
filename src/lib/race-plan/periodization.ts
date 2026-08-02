import { getLocalWeekStart, getLocalDateString } from '@/lib/date'
import type { Discipline, ExperienceLevel } from '@/lib/race-plan/self-assessment'
import type { DisciplineActivityFacts } from '@/lib/race-plan/discipline-weakness'
import type { MuscleVolume } from '@/lib/volume-analysis'

// Ordered race-focused -> muscle-focused, so a slider can index directly
// into this array (0..4) rather than needing a separate mapping table.
export const RACE_APPROACHES = ['race_focused', 'race_leaning', 'balanced', 'muscle_leaning', 'muscle_focused'] as const
export type RaceApproach = (typeof RACE_APPROACHES)[number]

export const RACE_APPROACH_LABELS: Record<RaceApproach, string> = {
  race_focused: 'Race-Focused',
  race_leaning: 'Race-Leaning',
  balanced: 'Balanced',
  muscle_leaning: 'Muscle-Leaning',
  muscle_focused: 'Muscle-Focused',
}

export type TrainingPhase = 'base' | 'build' | 'peak' | 'taper'

export interface DisciplineTarget {
  km: number
  sessions: number
}

export interface TrainingWeekSkeleton {
  weekStartDate: string
  phase: TrainingPhase
  // Populated only for multisport races; null for single-discipline races
  // - zero behavior change for those.
  disciplines: { swim: DisciplineTarget; bike: DisciplineTarget; run: DisciplineTarget } | null
  // Multi-discipline (typically bike-to-run) sessions for the week - null
  // for single-discipline races, where a brick has no meaning.
  brickSessions: number | null
  targetCardioKm: number
  targetCardioSessions: number
  targetStrengthSessions: number
}

const DISCIPLINES: Discipline[] = ['swim', 'bike', 'run']

// ─── Multisport (Ironman/Xtri) discipline volume model ──────────────────
// Grounded in commonly-published Ironman training plan guidance, not
// arbitrary multipliers - see each constant below for what's sourced vs.
// synthesized to fit the sourced envelope.

// Peak weekly volume (km) per discipline, by athlete level. Sourced from
// commonly-published Ironman training plans (Beginner Triathlete's
// Intermediate/Advanced full-distance plans, MyMottiv's beginner/
// intermediate/advanced plans, Dan's Swim / MyMottiv swim-specific
// guidance):
//  - Total peak hours: beginner ~8-13h, intermediate ~12-14h, advanced
//    ~15-18h (some advanced plans reach 16-17.5h).
//  - Peak bike: commonly 6-7.5+ hours/week (~150-200+km) for serious
//    first-timer plans.
//  - Peak swim: builds to a ~3,500-4,000m long swim for beginners, up to
//    ~5,000-7,500m total weekly volume for more experienced athletes.
//  - A typical week: three swims, three rides, three-to-four runs, plus
//    one SEPARATE ~45-minute strength session (see STRENGTH_SESSION_CAPS
//    below - strength is intentionally not scaled the same way).
// Run peak km is synthesized to fit the overall sourced hour envelope
// (bike still dominates total training time, since it's the longest race
// leg) rather than independently sourced to the exact km.
const LEVEL_PEAK_KM: Record<ExperienceLevel, Record<Discipline, number>> = {
  beginner: { swim: 3.75, bike: 140, run: 30 },
  intermediate: { swim: 5.5, bike: 175, run: 45 },
  advanced: { swim: 7.25, bike: 210, run: 60 },
}

// Base phase builds aerobic foundation, not peak fitness - starts well
// below peak and ramps up through Base/Build (same shared rampValue shape
// used everywhere else in this file), consistent with published base-
// phase guidance (an 8-12 week foundational block before volume ramps).
const BASE_START_FRACTION_OF_PEAK = 0.3

// Roughly how far a typical single session covers per discipline - used
// to derive a session COUNT directly from the km target (see
// buildDisciplineWeek below) so the two numbers can never disagree, tuned
// so the resulting progression lands in the commonly-cited weekly
// frequency (swim 3-4x/week, ~three bike rides, three-to-four runs).
const TYPICAL_SESSION_KM: Record<Discipline, number> = {
  swim: 1.8,
  bike: 45,
  run: 9,
}

// Matches this file's own already-cited source ("three swims, three
// rides, three-to-four runs") - the old 4/4/4 caps never actually lined
// up with that citation. Also the primary lever (alongside letting
// strength share an easy endurance day - see buildPhaseTemplate in
// day-template.ts) for keeping a week's total sessions representable
// within 7 calendar days.
const DISCIPLINE_MAX_SESSIONS: Record<Discipline, number> = {
  swim: 3,
  bike: 3,
  run: 3,
}

// Cardio peak multiplier for the multisport discipline model (separate
// from PEAK_MULTIPLIER below, which still drives the single-discipline
// aggregate ramp unchanged). LEVEL_PEAK_KM above already IS the
// "safe to finish" researched target, so this never goes below 1.0x:
// race-focused athletes push meaningfully above it for a faster time;
// muscle-focused/leaning approaches sit exactly AT it - never below,
// since race completion is non-negotiable for every approach - and put
// their extra recovery capacity toward more strength sessions instead
// (see STRENGTH_SESSION_CAPS).
const DISCIPLINE_PEAK_MULTIPLIER: Record<RaceApproach, number> = {
  race_focused: 1.25,
  race_leaning: 1.15,
  balanced: 1.05,
  muscle_leaning: 1.0,
  muscle_focused: 1.0,
}

// Applied on top of DISCIPLINE_PEAK_MULTIPLIER for the weakest/strongest
// discipline specifically - a real, visible bias toward the weak
// discipline (matches "weak swimmer + strong runner -> plan emphasizes
// swim more"), deliberately modest so the strongest discipline never
// drops far below its own safe researched target.
const RANK_ADJUSTMENT = [1.15, 1.0, 0.95] // weakest, middle, strongest

// Brick (multi-discipline, typically bike-to-run) sessions per week by
// phase - none in Base (no foundation yet), most commonly introduced at
// 1x/week in Build, up to 2x/week at Peak, easing back to 1x/week during
// Taper (TrainingPeaks/Triathlete guidance: bricks introduced ~8-16 weeks
// before race day, 1-3x/week closer to race, tapering off in the final
// weeks). The literal race week itself gets 0 regardless of phase - see
// computeTrainingWeeks.
const BRICK_SESSIONS_BY_PHASE: Record<TrainingPhase, number> = {
  base: 0,
  build: 1,
  peak: 2,
  taper: 1,
}

export interface DisciplineRampInputs {
  activityFacts: Record<Discipline, DisciplineActivityFacts>
  order: Discipline[] // weakest first
  level: ExperienceLevel
}

function disciplinePeakKm(discipline: Discipline, level: ExperienceLevel, approach: RaceApproach, order: Discipline[]): number {
  const rank = order.indexOf(discipline)
  const rankMultiplier = rank >= 0 ? RANK_ADJUSTMENT[rank] : 1.0
  return LEVEL_PEAK_KM[level][discipline] * DISCIPLINE_PEAK_MULTIPLIER[approach] * rankMultiplier
}

function disciplineBaselineKm(discipline: Discipline, level: ExperienceLevel, activityFacts: DisciplineActivityFacts): number {
  // The Base-phase starting point is level-appropriate (not rank-
  // adjusted - Base is general foundation-building, not yet weakness-
  // targeted), but never understates a real, already-established habit.
  const levelFloor = LEVEL_PEAK_KM[level][discipline] * BASE_START_FRACTION_OF_PEAK
  return Math.max(activityFacts.recentAvgWeeklyKm, levelFloor)
}

interface PhaseAllocation {
  base: number
  build: number
  peak: number
  taper: number
}

// Simple, explicitly-not-real-sports-science phase split. Always sums to
// totalWeeks exactly and never goes negative, including very short
// runways (a 1-2 week "plan" is basically all taper/rest).
function allocatePhases(totalWeeks: number): PhaseAllocation {
  if (totalWeeks <= 2) {
    return { base: 0, build: 0, peak: 0, taper: totalWeeks }
  }
  if (totalWeeks <= 4) {
    const taper = 1
    const peak = 1
    const build = totalWeeks - taper - peak
    return { base: 0, build, peak, taper }
  }

  const taper = totalWeeks <= 8 ? 1 : 2
  const afterTaper = totalWeeks - taper
  const peak = Math.max(1, Math.round(afterTaper * 0.2))
  const afterPeak = afterTaper - peak
  const build = Math.max(1, Math.round(afterPeak * 0.4))
  const base = Math.max(0, afterPeak - build)

  return { base, build, peak, taper }
}

// The race week itself is always the last taper week - always meaningfully
// cut back from peak (best-supported published guidance: >=1 week taper,
// 40-60% volume reduction, with the final race week itself reduced
// further still - last long run 18-22 days out, last long bike 14-21 days
// out, last long swim 9-10 days out, race week down to a short shakeout
// swim and a ~30-45min easy ride with a few pickups), never a fresh
// volume push right before the race.
const TAPER_FRACTIONS: Record<number, number[]> = {
  1: [0.4],
  2: [0.6, 0.35],
}

// Race week itself is NOT a taper-formula fraction of peak - published
// guidance (and this file's own long-standing comment on TAPER_FRACTIONS
// above) describes it as a genuine token shakeout: a short easy swim, a
// ~30-45min easy spin with a few pickups, a couple of short shakeout
// jogs. Absolute, not level-scaled - "a token shakeout" doesn't
// meaningfully change with fitness level the way peak volume does.
const RACE_WEEK_TOKEN_KM: { swim: number; bike: number; run: number; cardio: number } = {
  swim: 1,
  bike: 15,
  run: 4,
  cardio: 3,
}

function taperFraction(taperWeeks: number, indexWithinTaper: number): number {
  const fractions = TAPER_FRACTIONS[taperWeeks]
  if (fractions) return fractions[indexWithinTaper] ?? fractions[fractions.length - 1]
  // Fallback for an unexpectedly long taper (shouldn't happen given
  // allocatePhases above, but keep this safe rather than throwing).
  const t = taperWeeks <= 1 ? 0 : indexWithinTaper / (taperWeeks - 1)
  return 0.7 - t * 0.4
}

// Every 4th week within the Base/Build ramp is a lighter recovery week
// (~25% cut from that week's ramped value) instead of a continued climb -
// the "3:1" build-then-recover cycle is standard practice, and NOT
// something block periodization (the main legitimate alternative model)
// dispenses with either - USA Triathlon states plainly that a plan which
// "just builds volume week after week" leads to accumulated fatigue and
// eventual performance decline, not just diminishing returns
// (https://www.usatriathlon.org/articles/training-tips/the-importance-of-recovery-weeks-and-rest-days,
// https://process3.com.au/triathlon-periodization/). Peak is
// deliberately excluded - its week-level total is already flat (not
// climbing), so the "absorb increasing load" rationale doesn't apply the
// same way; Taper already has its own reduction via taperFraction.
const RECOVERY_WEEK_FRACTION = 0.75 // ~25% cut, within the commonly-cited 20-30%/20-40% range

function isRecoveryWeek(phase: TrainingPhase, weekIndex: number): boolean {
  return (phase === 'base' || phase === 'build') && (weekIndex + 1) % 4 === 0
}

// One shared ramp shape (base/build ramp linearly to peak with a
// periodic recovery dip, hold at peak, cut back for taper) reused for
// both the aggregate cardio number (single-discipline races) and each
// discipline's own number (multisport races) - same curve, different
// baseline/peak per call.
function rampValue(
  baseline: number,
  peak: number,
  phase: TrainingPhase,
  weekIndex: number,
  rampWeeks: number,
  allocation: PhaseAllocation,
  taperIndex: number
): number {
  if (phase === 'base' || phase === 'build') {
    const ramped = baseline + (peak - baseline) * ((weekIndex + 1) / Math.max(rampWeeks, 1))
    return isRecoveryWeek(phase, weekIndex) ? ramped * RECOVERY_WEEK_FRACTION : ramped
  }
  if (phase === 'peak') return peak
  return peak * taperFraction(allocation.taper, taperIndex)
}

// Cardio peak multiplier for the single-discipline AGGREGATE ramp only
// (marathon/half/10k/5k/ultra_run races) - unrelated to and unaffected by
// the multisport discipline model above. race_focused ramps hardest,
// muscle_focused still ramps (just modestly): "maximize muscle while
// still finishing the race safely" means real endurance preparation, not
// none.
const PEAK_MULTIPLIER: Record<RaceApproach, number> = {
  race_focused: 1.9,
  race_leaning: 1.55,
  balanced: 1.25,
  muscle_leaning: 1.15,
  muscle_focused: 1.08,
}

// Strength-session frequency ceilings per approach x phase (never a
// floor - always capped by the user's own logged baseline, so this never
// invents a habit they don't already have). Grounded in concurrent-
// training/interference-effect research: endurance training volume and
// frequency are the primary drivers of interference with strength
// adaptation, so high-frequency strength work is only sustainable while
// concurrent endurance volume is still low, i.e. early Base; as endurance
// volume ramps toward Peak/Taper, recovery capacity increasingly has to
// go to the endurance side, so strength frequency must come down for
// every approach - what actually distinguishes the five approaches is HOW
// FAST it comes down, not whether it does. race_focused's 1-2x/week
// matches the standard single-focus triathlete baseline cited in
// published plans; muscle_leaning/muscle_focused deliberately go higher
// as a genuine choice within safe concurrent-training limits, and are
// never eliminated to zero even at Peak/Taper.
const STRENGTH_SESSION_CAPS: Record<RaceApproach, Record<TrainingPhase, number>> = {
  race_focused: { base: 2, build: 2, peak: 1, taper: 1 },
  race_leaning: { base: 3, build: 2, peak: 1, taper: 1 },
  balanced: { base: 4, build: 3, peak: 2, taper: 1 },
  muscle_leaning: { base: 4, build: 4, peak: 2, taper: 2 },
  muscle_focused: { base: 5, build: 4, peak: 3, taper: 2 },
}

// Concurrent-training sequencing guidance, phase-specific because
// interference risk scales with how much endurance volume that phase
// carries (same logic STRENGTH_SESSION_CAPS above applies to session
// frequency). Static, cited text - not model-generated, since this is a
// factual claim, not a per-athlete judgment call:
//  - sequence-within-a-session has small/negligible effect on most
//    adaptations; the real risk factor is pairing hard+hard same day,
//    not which one comes first (Frontiers 2025 semi-systematic review,
//    https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2025.1692399/full)
//  - pair strength with a low-intensity endurance day rather than a
//    hard one when both must land same day (PMC 2024,
//    https://pmc.ncbi.nlm.nih.gov/articles/PMC11359207/)
//  - >=6 hours of separation between a hard endurance session and
//    strength meaningfully reduces acute interference (TrainingPeaks,
//    https://www.trainingpeaks.com/blog/risks-of-concurrent-training/)
export const STRENGTH_SEQUENCING_NOTES: Record<TrainingPhase, string> = {
  base: 'Cardio volume is still low here, so same-day strength + cardio carries the least interference risk of any phase.',
  build: "Cardio volume is ramping - avoid stacking strength right after your longest/hardest session of the week; pair it with an easy day instead, or separate the two by several hours.",
  peak: 'Cardio volume is at its highest this cycle - same-day pairing carries the most interference risk. Keep strength on easy days only, clear of brick/long sessions.',
  taper: "Strength frequency is already capped low here - keep any remaining sessions on easy days, away from the taper's remaining key efforts.",
}

function strengthSessionsForWeek(phase: TrainingPhase, approach: RaceApproach, currentStrengthSessionsPerWeek: number): number {
  // Never invent a strength habit the user doesn't already have.
  if (currentStrengthSessionsPerWeek <= 0) return 0

  const baseline = Math.max(1, Math.round(currentStrengthSessionsPerWeek))
  const cap = STRENGTH_SESSION_CAPS[approach][phase]
  return Math.min(cap, baseline)
}

// Cheap, pure preview for the client's live spectrum slider - no race date
// needed, just today's baseline numbers. Mirrors the "build phase" shape
// of computeTrainingWeeks below without needing a full skeleton.
export function previewApproachEffect(
  approach: RaceApproach,
  currentWeeklyCardioKm: number,
  currentStrengthSessionsPerWeek: number,
  disciplineInputs?: DisciplineRampInputs
): { previewPeakCardioKm: number; previewSteadyStrengthSessions: number; previewDisciplineKm?: Record<Discipline, number> } {
  const cardioBaseline = Math.max(currentWeeklyCardioKm, 5)
  const previewPeakCardioKm = Math.round(cardioBaseline * PEAK_MULTIPLIER[approach] * 10) / 10

  const result: ReturnType<typeof previewApproachEffect> = {
    previewPeakCardioKm,
    previewSteadyStrengthSessions: strengthSessionsForWeek('build', approach, currentStrengthSessionsPerWeek),
  }

  if (disciplineInputs) {
    const previewDisciplineKm = {} as Record<Discipline, number>
    for (const d of DISCIPLINES) {
      previewDisciplineKm[d] = Math.round(disciplinePeakKm(d, disciplineInputs.level, approach, disciplineInputs.order) * 10) / 10
    }
    result.previewDisciplineKm = previewDisciplineKm
  }

  return result
}

// Shared by the live spectrum slider (approach-spectrum.tsx) and the review
// step's static summary (the race detail page) - same wording either way,
// can't drift between "choosing" and "already generated" views of the
// same approach.
export function describeStrengthEmphasis(approach: RaceApproach, currentStrengthSessionsPerWeek: number): string {
  if (currentStrengthSessionsPerWeek <= 0) {
    return 'No recent strength training logged, so this spectrum only shapes cardio volume.'
  }

  const { previewSteadyStrengthSessions } = previewApproachEffect(approach, 0, currentStrengthSessionsPerWeek)
  const baseline = Math.round(currentStrengthSessionsPerWeek)

  if (previewSteadyStrengthSessions === baseline) {
    return `${previewSteadyStrengthSessions} strength session(s)/week — matches your current training.`
  }
  if (previewSteadyStrengthSessions < baseline) {
    return `${previewSteadyStrengthSessions} strength session(s)/week — a cut from your current ${baseline}/week to prioritize race prep.`
  }
  return `${previewSteadyStrengthSessions} strength session(s)/week — holding above your current ${baseline}/week.`
}

export interface MuscleImpactLine {
  muscle: string
  currentSetsPerWeek: number
  projectedTag: 'maintain' | 'reduced' | 'growth_room'
  shortLabel: string // compact delta for a pill display, e.g. "-2/wk", "room to grow", "at cap"
  description: string // full sentence - detail/tooltip only, not the primary display anymore
}

// Most-actionable-first: what you're giving up, then room still
// available, then what's already maxed out. Ties broken alphabetically
// for a stable render order.
const PROJECTED_TAG_PRIORITY: Record<MuscleImpactLine['projectedTag'], number> = { reduced: 0, growth_room: 1, maintain: 2 }
export function sortMuscleImpact(lines: MuscleImpactLine[]): MuscleImpactLine[] {
  return [...lines].sort((a, b) => PROJECTED_TAG_PRIORITY[a.projectedTag] - PROJECTED_TAG_PRIORITY[b.projectedTag] || a.muscle.localeCompare(b.muscle))
}

// Compares the CHOSEN approach against muscle_focused (the spectrum's
// strength-frequency ceiling), not against the user's own current
// real-world baseline - the useful question when picking a spectrum
// position is "what am I giving up by not going further toward muscle-
// focused," not "does this differ from what I already do today." Reuses
// the exact same strengthSessionsForWeek computation describeStrengthEmphasis
// already relies on - no new numbers, just a different comparison point.
export function describeMuscleImpact(
  approach: RaceApproach,
  currentStrengthSessionsPerWeek: number,
  muscleVolume: MuscleVolume[]
): MuscleImpactLine[] {
  if (currentStrengthSessionsPerWeek <= 0 || muscleVolume.length === 0) return []

  const sessionsAtApproach = strengthSessionsForWeek('build', approach, currentStrengthSessionsPerWeek)
  const sessionsAtMuscleFocused = strengthSessionsForWeek('build', 'muscle_focused', currentStrengthSessionsPerWeek)
  const sessionGap = sessionsAtMuscleFocused - sessionsAtApproach

  return muscleVolume.map((mv) => {
    const guidelineNote =
      mv.status === 'under'
        ? `still under the ~10-20 sets/week guideline (${mv.sets} sets/week) — room to keep growing`
        : mv.status === 'over'
          ? `already above the ~10-20 sets/week guideline (${mv.sets} sets/week)`
          : `within the ~10-20 sets/week guideline (${mv.sets} sets/week)`

    if (sessionGap > 0) {
      return {
        muscle: mv.muscle,
        currentSetsPerWeek: mv.sets,
        projectedTag: 'reduced' as const,
        shortLabel: `-${sessionGap}/wk`,
        description: `${sessionsAtApproach} strength session(s)/week — ${sessionGap} fewer than a muscle-focused approach would give you (${sessionsAtMuscleFocused}/week); ${guidelineNote}.`,
      }
    }

    return {
      muscle: mv.muscle,
      currentSetsPerWeek: mv.sets,
      projectedTag: mv.status === 'under' ? ('growth_room' as const) : ('maintain' as const),
      shortLabel: mv.status === 'under' ? 'room to grow' : 'at cap',
      description: `${sessionsAtApproach} strength session(s)/week — already matches what a muscle-focused approach would give you here; ${guidelineNote}.`,
    }
  })
}

// All date/phase/number arithmetic lives here, never in the AI prompt -
// the model only ever writes the per-week focus_note and overview text on
// top of these already-decided numbers (see race-plan/route.ts).
export function computeTrainingWeeks(
  raceDate: string,
  approach: RaceApproach,
  currentWeeklyCardioKm: number,
  currentCardioSessionsPerWeek: number,
  currentStrengthSessionsPerWeek: number,
  disciplineInputs?: DisciplineRampInputs,
  startDate?: string | null
): TrainingWeekSkeleton[] {
  // null/undefined means "start now" - preserves existing behavior for
  // every race with no explicit chosen training start.
  const startMonday = startDate ? getLocalWeekStart(new Date(startDate + 'T00:00:00')) : getLocalWeekStart()
  const raceMonday = getLocalWeekStart(new Date(raceDate + 'T00:00:00'))
  const diffWeeks = Math.round((raceMonday.getTime() - startMonday.getTime()) / (7 * 86400000))
  const totalWeeks = Math.max(1, diffWeeks + 1)

  const allocation = allocatePhases(totalWeeks)
  const phases: TrainingPhase[] = [
    ...Array(allocation.base).fill('base' as const),
    ...Array(allocation.build).fill('build' as const),
    ...Array(allocation.peak).fill('peak' as const),
    ...Array(allocation.taper).fill('taper' as const),
  ]

  // Floors avoid multiplying a zero baseline into a permanently-zero ramp
  // for someone with little/no logged cardio history yet.
  const cardioBaseline = Math.max(currentWeeklyCardioKm, 5)
  const peakTargetKm = cardioBaseline * PEAK_MULTIPLIER[approach]
  const rampWeeks = allocation.base + allocation.build
  const sessionsBaseline = Math.max(currentCardioSessionsPerWeek, 2)

  // Per-discipline baselines/peaks, computed once - each ramps from its
  // own level-appropriate, researched starting point and peak (see
  // LEVEL_PEAK_KM above), with the weakness ranking adjusting how far
  // above the safe peak each discipline sits.
  let disciplineBaselines: Record<Discipline, number> | null = null
  let disciplinePeaks: Record<Discipline, number> | null = null
  if (disciplineInputs) {
    disciplineBaselines = {} as Record<Discipline, number>
    disciplinePeaks = {} as Record<Discipline, number>
    for (const d of DISCIPLINES) {
      disciplineBaselines[d] = disciplineBaselineKm(d, disciplineInputs.level, disciplineInputs.activityFacts[d])
      disciplinePeaks[d] = disciplinePeakKm(d, disciplineInputs.level, approach, disciplineInputs.order)
    }
  }

  let taperIndex = 0

  return phases.map((phase, i) => {
    const weekStart = new Date(startMonday)
    weekStart.setDate(weekStart.getDate() + i * 7)
    const weekStartDate = getLocalDateString(weekStart)
    const isRaceWeek = i === phases.length - 1

    const targetCardioKm = isRaceWeek
      ? RACE_WEEK_TOKEN_KM.cardio
      : Math.round(rampValue(cardioBaseline, peakTargetKm, phase, i, rampWeeks, allocation, taperIndex) * 10) / 10
    // The Math.max(2, ...) floor exists to avoid an under-scheduled early
    // plan, but it would also force 2 sessions onto race week's tiny token
    // km - override directly to a single shakeout session there instead.
    const targetCardioSessions = isRaceWeek ? 1 : Math.min(7, Math.max(2, Math.round(sessionsBaseline * (targetCardioKm / cardioBaseline))))
    const targetStrengthSessions = strengthSessionsForWeek(phase, approach, currentStrengthSessionsPerWeek)

    let disciplines: TrainingWeekSkeleton['disciplines'] = null
    let brickSessions: number | null = null
    if (disciplineBaselines && disciplinePeaks) {
      const built = {} as { swim: DisciplineTarget; bike: DisciplineTarget; run: DisciplineTarget }
      for (const d of DISCIPLINES) {
        const km = isRaceWeek
          ? RACE_WEEK_TOKEN_KM[d]
          : Math.round(rampValue(disciplineBaselines[d], disciplinePeaks[d], phase, i, rampWeeks, allocation, taperIndex) * 10) / 10
        // Sessions derived FROM km (not rounded independently) - a
        // non-zero km target always implies at least one session, and
        // vice versa, so the two numbers can never disagree.
        const sessions = km > 0 ? Math.max(1, Math.min(DISCIPLINE_MAX_SESSIONS[d], Math.round(km / TYPICAL_SESSION_KM[d]))) : 0
        built[d] = { km, sessions }
      }
      disciplines = built
      // Race week itself never includes a training brick, regardless of
      // phase - by then it's taper/rest, not a fresh simulated-fatigue
      // session.
      brickSessions = isRaceWeek ? 0 : BRICK_SESSIONS_BY_PHASE[phase]
    }

    if (phase === 'taper') taperIndex += 1

    return { weekStartDate, phase, disciplines, brickSessions, targetCardioKm, targetCardioSessions, targetStrengthSessions }
  })
}
