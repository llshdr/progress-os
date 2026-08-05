// Pure derivation logic for planned strength-training blocks
// (mesocycles) - zero DB access, same separation as current-form.ts/
// pace-targets.ts in the Races feature. See migration
// 058_add_training_mesocycles.sql for the schema and design rationale.

export interface Mesocycle {
  id: string
  startDate: string // YYYY-MM-DD
  lengthWeeks: number
  deloadWeekNumber: number | null
  label: string | null
}

export interface CurrentMesocycleStatus {
  mesocycle: Mesocycle
  currentWeek: number // 1-based
  isDeloadWeek: boolean
  weeksUntilDeload: number | null // null when no deload is planned, or it's this week/already past
}

// currentWeek is derived purely from startDate vs. today, never a
// separately-stored counter - same self-healing precedent as
// workout_schedule_slots' own rotation-position derivation. Returns null
// once the block hasn't started yet, or has already run its full
// lengthWeeks (ended) - "does it need a new block" is left entirely to
// the UI, never auto-started.
export function deriveMesocycleStatus(mesocycle: Mesocycle, today: string): CurrentMesocycleStatus | null {
  const start = new Date(mesocycle.startDate + 'T00:00:00')
  const now = new Date(today + 'T00:00:00')
  const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / 86400000)
  if (daysSinceStart < 0) return null

  const currentWeek = Math.floor(daysSinceStart / 7) + 1
  if (currentWeek > mesocycle.lengthWeeks) return null

  const isDeloadWeek = mesocycle.deloadWeekNumber === currentWeek
  const weeksUntilDeload =
    mesocycle.deloadWeekNumber != null && mesocycle.deloadWeekNumber > currentWeek ? mesocycle.deloadWeekNumber - currentWeek : null

  return { mesocycle, currentWeek, isDeloadWeek, weeksUntilDeload }
}

// Picks whichever mesocycle is "active" today when more than one
// resolves as in-range (e.g. the user starts a new block before an
// older one's lengthWeeks has elapsed) - the LATEST startDate wins. This
// is deliberate, not a bug to guard against: it's what lets "Start New
// Block" supersede an old one with no separate "end this block early"
// action or stored "active" flag needed (see the migration's own
// comment on this).
export function selectActiveMesocycle(mesocycles: Mesocycle[], today: string): CurrentMesocycleStatus | null {
  const candidates = mesocycles.map((m) => deriveMesocycleStatus(m, today)).filter((s): s is CurrentMesocycleStatus => s !== null)
  if (candidates.length === 0) return null
  return candidates.reduce((latest, c) => (c.mesocycle.startDate > latest.mesocycle.startDate ? c : latest))
}

// The context sentence spliced into the AI Coach recommend route's
// prompt, same tone/shape as that route's own raceContext. Deliberately
// qualitative, never a numeric formula ("-10% this week") - the route is
// already model-driven for weight/reps (unlike Races' periodization),
// so this hands the model framing to reason with, the same way
// phaseContext/volumeContext already do there.
export function describeMesocycleContext(status: CurrentMesocycleStatus): string {
  const { mesocycle, currentWeek, isDeloadWeek, weeksUntilDeload } = status
  const label = mesocycle.label ? `"${mesocycle.label}"` : 'their current training block'

  if (isDeloadWeek) {
    return `This lifter is in week ${currentWeek} of ${mesocycle.lengthWeeks} of ${label} - a planned deload week. Favor recovery: hold or reduce load/volume rather than chasing a new heavy top set, even if recent sets looked strong.`
  }

  const deloadNote = weeksUntilDeload != null ? ` (deload planned in ${weeksUntilDeload} week${weeksUntilDeload === 1 ? '' : 's'})` : ''
  const fatigueNote =
    weeksUntilDeload != null && weeksUntilDeload <= 1
      ? " - expect some accumulated fatigue this close to the deload, so don't be afraid to hold rather than force a new PR"
      : ''
  return `This lifter is in week ${currentWeek} of ${mesocycle.lengthWeeks} of ${label}${deloadNote}. Normal progression applies${fatigueNote}.`
}
