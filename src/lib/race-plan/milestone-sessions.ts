import type { RaceType } from '@/lib/race-constants'
import type { RaceCategory, Discipline } from '@/lib/race-plan/self-assessment'
import type { TrainingPhase } from '@/lib/race-plan/periodization'

export interface MilestoneWeek {
  weekStartDate: string
  phase: TrainingPhase
}

export interface MilestoneSuggestion {
  discipline: Discipline
  km: number
  weekStartDate: string
}

// Standard Ironman/Xtri leg distances, already shown to the athlete via
// RACE_TYPE_DISTANCE (race-constants.ts) - reused here rather than a
// second, possibly-drifting copy of the same numbers.
const RACE_LEG_DISTANCE_KM: Partial<Record<RaceType, Record<Discipline, number>>> = {
  ironman: { swim: 3.8, bike: 180.2, run: 42.2 },
  xtri: { swim: 3.8, bike: 180.2, run: 42.2 },
}

// A reasonable, adjustable starting fraction of race distance for an
// occasional confidence-building session - NOT a hard research number
// the way LEVEL_PEAK_KM is. Deliberately well below full race distance,
// consistent with this feature's existing "cap well below race distance,
// repeat it, don't escalate further" guidance (periodization.ts cites Hal
// Higdon's marathon plan peaking at 20mi and repeating it, not climbing
// to 26.2) - a milestone session is about confidence/logistics/nutrition
// rehearsal, not a fitness requirement, and this doesn't try to be more
// precise than that framing.
const MILESTONE_SHARE_OF_RACE_DISTANCE: Record<Discipline, number> = {
  swim: 0.6,
  bike: 0.75,
  run: 0.55,
}

// Only offered for a long enough runway that a one-off deviation doesn't
// disturb the ramp toward Peak/Taper - a starting heuristic, not an
// independently-sourced number.
export const MIN_WEEKS_FOR_MILESTONE = 24

const DISCIPLINES: Discipline[] = ['swim', 'bike', 'run']

// Purely informational - never mutates the generated plan's weeks/
// phase_templates, and only ever suggested when the athlete opts in to
// seeing it (see the Review step's collapsed card). Picks 3 different,
// evenly-spaced Build-phase weeks, one per discipline, so suggestions
// never collide on the same week.
export function suggestMilestoneSessions(raceType: RaceType, category: RaceCategory, weeks: MilestoneWeek[]): MilestoneSuggestion[] | null {
  if (category !== 'multisport') return null
  if (weeks.length < MIN_WEEKS_FOR_MILESTONE) return null

  const legDistances = RACE_LEG_DISTANCE_KM[raceType]
  if (!legDistances) return null

  const buildWeeks = weeks.filter((w) => w.phase === 'build')
  if (buildWeeks.length < DISCIPLINES.length) return null

  return DISCIPLINES.map((discipline, i) => {
    const index = Math.min(buildWeeks.length - 1, Math.round(((i + 1) / (DISCIPLINES.length + 1)) * buildWeeks.length))
    return {
      discipline,
      km: Math.round(legDistances[discipline] * MILESTONE_SHARE_OF_RACE_DISTANCE[discipline] * 10) / 10,
      weekStartDate: buildWeeks[index].weekStartDate,
    }
  })
}
