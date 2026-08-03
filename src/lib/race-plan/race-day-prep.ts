import type { TrainingPhase } from '@/lib/race-plan/periodization'
import type { RaceCategory } from '@/lib/race-plan/self-assessment'

// ─── Packing lists (Phase A) ──────────────────────────────────────────
// Static, race-category-aware checklists, not personalized/dynamic - gear
// needed for T1/T2/T3 is overwhelmingly a function of race category, and
// any weather-based personalization would need forecast data this app
// doesn't have for a race that can be up to a year away.

export interface PackingList {
  t1?: string[]
  t2?: string[]
  t3?: string[]
  bag?: string[]
}

export const PACKING_LISTS: Record<'multisport' | 'run_or_other', PackingList> = {
  multisport: {
    t1: [
      'Wetsuit strippers/lube',
      'Goggles + a spare pair',
      'Swim cap (if not race-provided)',
      'Helmet - clip it before you touch the bike, not after',
      'Bike shoes',
      'Sunglasses',
      'Race belt with number',
    ],
    t2: ['Run shoes', 'Run hat/visor', 'Socks (if not already worn on the bike)', 'Extra gels/nutrition', 'Handheld bottle, if you use one'],
    t3: [
      'Salt tabs / extra electrolytes',
      'Spare nutrition top-up',
      'Dry socks',
      'Blister kit',
      'Any special-needs items specific to this course',
    ],
  },
  run_or_other: {
    bag: [
      'Race bib + safety pins (if not a race belt)',
      'Shoes - broken in, never new for race day',
      'Gels/nutrition for the distance',
      'Watch, charged',
      'A throwaway layer for a cold start you can discard early',
    ],
  },
}

// ─── Transition guidance (Phase A) ────────────────────────────────────
// NOT full brick workouts (those are the endurance-slot brick sessions
// themselves) - this is the gear-change/mechanical-fix layer attached to
// the same brick days that already exist, phase-aware the same way
// ZONE_GUIDANCE already is.
export const TRANSITION_GUIDANCE: Record<TrainingPhase, { short: string; full: string }> = {
  base: {
    short: 'Get familiar with your gear',
    full: 'No need for speed yet - use these brick sessions to get comfortable with your actual race-day gear (wetsuit, helmet clip, bike shoes) so it feels routine well before it needs to be fast.',
  },
  build: {
    short: 'Start timing your transitions',
    full: 'Start practicing the real sequence at real speed: helmet on before you touch the bike, a clean wetsuit strip, shoes already clipped in (or a flying mount, if you use one). Time it - transitions are free speed.',
  },
  peak: {
    short: 'Full-speed transition + mechanical practice',
    full: 'Practice a full-speed transition at least once, and deliberately practice fixing a mechanical on the bike (a dropped chain or flat) under some fatigue, not just fresh - race day will not wait for you to figure it out calmly.',
  },
  taper: {
    short: 'Light run-through only',
    full: "A light, unhurried run-through of your transition sequence is enough here - the goal is confidence and muscle memory, not one more hard effort this close to race day.",
  },
}

// ─── Fueling guidance (Phase B) ───────────────────────────────────────
// Standard, widely-cited sports-nutrition carbs/hour bands - static text,
// same "cite a real range, don't personalize what we can't know"
// discipline as this feature's other guidance tables. Attached to
// 'key'-role and brick sessions specifically - reuses the already-
// existing role/brick concept as the "this session is long enough to
// need fueling" signal, rather than modeling session duration from
// scratch.
export const FUELING_GUIDANCE =
  'For efforts over ~60-75 minutes: roughly 30-60g carbs/hour. Beyond ~2.5 hours - your longest key/brick sessions - that commonly rises to 60-90g/hour with a mixed glucose-fructose source. Log what you actually take in as an "Intra-Workout" entry in Nutrition so you can see what you tolerate well before race day.'

// ─── Open-water seasonality (Phase C) ─────────────────────────────────
// Deliberately sourced from the athlete's own stated season, never an
// app-maintained regional table - this app has no real data on any
// specific user's local conditions, and guessing by region would be
// exactly the kind of invented precision this feature avoids elsewhere.

export interface SeasonCheckWeek {
  weekStartDate: string
  disciplines: { swim: { sessions: number } } | null
}

function monthOf(dateString: string): number {
  return new Date(dateString + 'T00:00:00').getMonth() + 1
}

// Handles a season that wraps across the year boundary (e.g. a Southern-
// Hemisphere Nov-Mar season).
export function isMonthWithinSeason(month: number, startMonth: number, endMonth: number): boolean {
  if (startMonth <= endMonth) return month >= startMonth && month <= endMonth
  return month >= startMonth || month <= endMonth
}

// Returns null when the athlete hasn't stated a season, or when every
// scheduled swim week already overlaps with it - only speaks up when
// there's a real mismatch to flag.
export function summarizeSeasonMismatch(weeks: SeasonCheckWeek[], startMonth: number | null, endMonth: number | null): string | null {
  if (startMonth == null || endMonth == null) return null

  const swimWeeks = weeks.filter((w) => w.disciplines && w.disciplines.swim.sessions > 0)
  if (swimWeeks.length === 0) return null

  const outsideSeason = swimWeeks.filter((w) => !isMonthWithinSeason(monthOf(w.weekStartDate), startMonth, endMonth))
  if (outsideSeason.length === 0) return null

  if (outsideSeason.length === swimWeeks.length) {
    return 'Every swim session in this plan falls outside your stated open-water season - pool swimming is the realistic option throughout, unless your season changes.'
  }

  return `${outsideSeason.length} of ${swimWeeks.length} scheduled swim weeks fall outside your stated open-water season - pool swimming is fine there; the rest overlap with open water being realistic.`
}

// ─── Race-day checkpoints (Phase E) ───────────────────────────────────
// Static, race-day reference checkpoints - a consolidated place to pause
// and check nutrition/pacing/how you feel at natural milestones, not a
// new computation.
export const RACE_DAY_CHECKPOINTS: Record<RaceCategory, { label: string; notes: string[] }[]> = {
  multisport: [
    { label: 'Swim exit', notes: ['Start your nutrition clock now if you haven’t already', 'Note how you feel - not how fast you went'] },
    {
      label: 'Bike halfway',
      notes: ['Check you’re actually eating/drinking on schedule, not just when thirsty', 'Compare effort to your planned zone, not to other riders'],
    },
    { label: 'T2', notes: ['A calm, practiced transition beats a rushed one', 'One more real food/gel intake before you start running'] },
    { label: 'Run halfway', notes: ['Reassess pacing honestly against your plan', 'If nutrition has slipped, fix it now, not at the finish line'] },
  ],
  run: [
    { label: '25% mark', notes: ['Confirm your pace matches the plan, not race-day adrenaline'] },
    { label: 'Halfway', notes: ['Take stock of nutrition/hydration so far', 'Reassess effort honestly'] },
    { label: '75% mark', notes: ['This is where pacing discipline matters most - resist surging early'] },
  ],
  other: [{ label: 'Halfway', notes: ['Reassess pacing and nutrition honestly'] }],
}
