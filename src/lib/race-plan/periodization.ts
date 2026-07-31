import { getLocalWeekStart, getLocalDateString } from '@/lib/date'
import type { Discipline } from '@/lib/race-plan/self-assessment'
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
  targetCardioKm: number
  targetCardioSessions: number
  targetStrengthSessions: number
}

const DISCIPLINES: Discipline[] = ['swim', 'bike', 'run']

// Real per-discipline weekly ramp inputs: each discipline's own recent
// activity (from computeDisciplineActivityFacts) plus the weakness
// ranking (weakest first). Deliberately NOT a shared "cardio pool" split
// into percentage shares - swim/bike/run sit on wildly different natural
// km scales (a single bike ride covers far more distance than a swim or
// run session), so treating them as fractions of one number produced
// nonsensical targets (a bike target of ~2km/week). Each discipline ramps
// from its own realistic floor instead.
export interface DisciplineRampInputs {
  activityFacts: Record<Discipline, DisciplineActivityFacts>
  order: Discipline[]
}

// Realistic per-discipline weekly floors (km), used when a user has
// ~zero logged history for that discipline - starting points for full-
// distance triathlon training (a single ride already covers this much
// bike distance; swim/run floors are correspondingly smaller since those
// disciplines sit on a different natural scale). These ramp upward as
// real logged activity comes in on future regenerations, same as the
// existing aggregate cardio floor already does for single-discipline
// races.
const DISCIPLINE_BASELINE_FLOOR_KM: Record<Discipline, number> = {
  swim: 2,
  bike: 30,
  run: 10,
}

// Roughly how far a typical single session covers per discipline - used
// to derive a session COUNT directly from a discipline's km target so
// the two numbers can never disagree (a non-zero km target always
// implies at least one session, and vice versa), instead of rounding km
// and session counts independently.
const TYPICAL_SESSION_KM: Record<Discipline, number> = {
  swim: 2,
  bike: 25,
  run: 6,
}

const DISCIPLINE_MAX_SESSIONS: Record<Discipline, number> = {
  swim: 4,
  bike: 4,
  run: 5,
}

// Applied to each discipline's OWN peak ramp (not a percentage of a
// shared pool) - the weakest discipline ramps further above its own
// baseline, the strongest slightly less, but every discipline still
// ramps from its own realistic starting point.
const RANK_ADJUSTMENT = [1.3, 1.0, 0.85] // weakest, middle, strongest

function disciplineRankAdjustment(discipline: Discipline, order: Discipline[]): number {
  const rank = order.indexOf(discipline)
  return rank >= 0 ? RANK_ADJUSTMENT[rank] : 1.0
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
// cut back from peak, never a fresh volume push right before the race.
const TAPER_FRACTIONS: Record<number, number[]> = {
  1: [0.4],
  2: [0.6, 0.35],
}

function taperFraction(taperWeeks: number, indexWithinTaper: number): number {
  const fractions = TAPER_FRACTIONS[taperWeeks]
  if (fractions) return fractions[indexWithinTaper] ?? fractions[fractions.length - 1]
  // Fallback for an unexpectedly long taper (shouldn't happen given
  // allocatePhases above, but keep this safe rather than throwing).
  const t = taperWeeks <= 1 ? 0 : indexWithinTaper / (taperWeeks - 1)
  return 0.7 - t * 0.4
}

// One shared ramp shape (base/build ramp linearly to peak, hold at peak,
// cut back for taper) reused for both the aggregate cardio number
// (single-discipline races) and each discipline's own number (multisport
// races) - same curve, different baseline/peak per call.
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
    return baseline + (peak - baseline) * ((weekIndex + 1) / Math.max(rampWeeks, 1))
  }
  if (phase === 'peak') return peak
  return peak * taperFraction(allocation.taper, taperIndex)
}

// Cardio peak multiplier per approach - race_focused ramps hardest,
// muscle_focused still ramps (just modestly): "maximize muscle while
// still finishing the race safely" means real endurance preparation, not
// none. A flat 1.0x (no increase over current baseline at all) would mean
// zero race-specific endurance build-up regardless of how far out the
// race is - not a genuine floor, just no training. 1.08x keeps
// muscle_focused's ramp clearly the smallest of the five while still
// being real.
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
// training/interference-effect guidance: high-frequency strength work
// (up to 4-5x/week) is only sustainable while concurrent endurance volume
// is still low, i.e. early Base; as endurance volume ramps toward
// Peak/Taper, recovery capacity increasingly has to go to the endurance
// side, so strength frequency must come down for every approach - what
// actually distinguishes the five approaches is HOW FAST it comes down,
// not whether it does. race_focused drops hardest and earliest;
// muscle_focused preserves the most for the longest, but still tapers
// into Peak/Taper rather than staying flat, since "can still finish the
// race safely" requires some recovery capacity to shift toward the
// endurance side as race day approaches.
const STRENGTH_SESSION_CAPS: Record<RaceApproach, Record<TrainingPhase, number>> = {
  race_focused: { base: 2, build: 2, peak: 1, taper: 1 },
  race_leaning: { base: 3, build: 2, peak: 1, taper: 1 },
  balanced: { base: 4, build: 3, peak: 2, taper: 1 },
  muscle_leaning: { base: 4, build: 4, peak: 2, taper: 2 },
  muscle_focused: { base: 5, build: 4, peak: 3, taper: 2 },
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
  const peakMultiplier = PEAK_MULTIPLIER[approach]
  const previewPeakCardioKm = Math.round(cardioBaseline * peakMultiplier * 10) / 10

  const result: ReturnType<typeof previewApproachEffect> = {
    previewPeakCardioKm,
    previewSteadyStrengthSessions: strengthSessionsForWeek('build', approach, currentStrengthSessionsPerWeek),
  }

  if (disciplineInputs) {
    const previewDisciplineKm = {} as Record<Discipline, number>
    for (const d of DISCIPLINES) {
      const baseline = Math.max(disciplineInputs.activityFacts[d].recentAvgWeeklyKm, DISCIPLINE_BASELINE_FLOOR_KM[d])
      const peak = baseline * peakMultiplier * disciplineRankAdjustment(d, disciplineInputs.order)
      previewDisciplineKm[d] = Math.round(peak * 10) / 10
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
  description: string
}

// Extends describeStrengthEmphasis's exact reasoning (steady-state session
// count vs. current baseline) to one line per muscle group already tracked
// by computeMuscleVolume - no percentage, no new fabricated number, same
// honest qualitative framing already chosen for Strength Emphasis.
export function describeMuscleImpact(
  approach: RaceApproach,
  currentStrengthSessionsPerWeek: number,
  muscleVolume: MuscleVolume[]
): MuscleImpactLine[] {
  if (currentStrengthSessionsPerWeek <= 0 || muscleVolume.length === 0) return []

  const { previewSteadyStrengthSessions } = previewApproachEffect(approach, 0, currentStrengthSessionsPerWeek)
  const baseline = Math.round(currentStrengthSessionsPerWeek)
  const reduced = previewSteadyStrengthSessions < baseline

  return muscleVolume.map((mv) => {
    if (reduced) {
      return {
        muscle: mv.muscle,
        currentSetsPerWeek: mv.sets,
        projectedTag: 'reduced' as const,
        description: `Strength sessions dropping from ${baseline}/week to ${previewSteadyStrengthSessions}/week — some reduction likely here (currently ${mv.sets} sets/week).`,
      }
    }
    if (mv.status === 'under') {
      return {
        muscle: mv.muscle,
        currentSetsPerWeek: mv.sets,
        projectedTag: 'growth_room' as const,
        description: `Still under the ~10-20 sets/week guideline (${mv.sets} sets/week) — room to keep growing here.`,
      }
    }
    return {
      muscle: mv.muscle,
      currentSetsPerWeek: mv.sets,
      projectedTag: 'maintain' as const,
      description: `Sessions held steady — likely to maintain (currently ${mv.sets} sets/week).`,
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
  disciplineInputs?: DisciplineRampInputs
): TrainingWeekSkeleton[] {
  const startMonday = getLocalWeekStart()
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
  const peakMultiplier = PEAK_MULTIPLIER[approach]
  const peakTargetKm = cardioBaseline * peakMultiplier
  const rampWeeks = allocation.base + allocation.build
  const sessionsBaseline = Math.max(currentCardioSessionsPerWeek, 2)

  // Per-discipline baselines/peaks, computed once - each ramps from its
  // own realistic starting point (see DisciplineRampInputs above), with
  // the weakness ranking adjusting how far above that baseline each
  // discipline's own peak sits.
  let disciplineBaselines: Record<Discipline, number> | null = null
  let disciplinePeaks: Record<Discipline, number> | null = null
  if (disciplineInputs) {
    disciplineBaselines = {} as Record<Discipline, number>
    disciplinePeaks = {} as Record<Discipline, number>
    for (const d of DISCIPLINES) {
      const baseline = Math.max(disciplineInputs.activityFacts[d].recentAvgWeeklyKm, DISCIPLINE_BASELINE_FLOOR_KM[d])
      disciplineBaselines[d] = baseline
      disciplinePeaks[d] = baseline * peakMultiplier * disciplineRankAdjustment(d, disciplineInputs.order)
    }
  }

  let taperIndex = 0

  return phases.map((phase, i) => {
    const weekStart = new Date(startMonday)
    weekStart.setDate(weekStart.getDate() + i * 7)
    const weekStartDate = getLocalDateString(weekStart)

    const targetCardioKm = Math.round(rampValue(cardioBaseline, peakTargetKm, phase, i, rampWeeks, allocation, taperIndex) * 10) / 10
    const targetCardioSessions = Math.min(7, Math.max(2, Math.round(sessionsBaseline * (targetCardioKm / cardioBaseline))))
    const targetStrengthSessions = strengthSessionsForWeek(phase, approach, currentStrengthSessionsPerWeek)

    let disciplines: TrainingWeekSkeleton['disciplines'] = null
    if (disciplineBaselines && disciplinePeaks) {
      const built = {} as { swim: DisciplineTarget; bike: DisciplineTarget; run: DisciplineTarget }
      for (const d of DISCIPLINES) {
        const km = Math.round(rampValue(disciplineBaselines[d], disciplinePeaks[d], phase, i, rampWeeks, allocation, taperIndex) * 10) / 10
        // Sessions derived FROM km (not rounded independently) - a
        // non-zero km target always implies at least one session, and
        // vice versa, so the two numbers can never disagree.
        const sessions = km > 0 ? Math.max(1, Math.min(DISCIPLINE_MAX_SESSIONS[d], Math.round(km / TYPICAL_SESSION_KM[d]))) : 0
        built[d] = { km, sessions }
      }
      disciplines = built
    }

    if (phase === 'taper') taperIndex += 1

    return { weekStartDate, phase, disciplines, targetCardioKm, targetCardioSessions, targetStrengthSessions }
  })
}
