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

// ─── Race Prep Checklist defaults (Part C) ────────────────────────────
// Real, trackable checklist items, seeded once per race from this static
// content into race_checklist_items (see migration 065) - the user can
// then check items off, delete any, and add their own custom ones. Two
// categories: 'gear' (buy/pack) sourced directly from PACKING_LISTS
// above, and 'test' (rehearse before race day), which has no existing
// itemized equivalent - TRANSITION_GUIDANCE/FUELING_GUIDANCE below are
// prose, not checklist items, so this is new content, kept small and
// concrete rather than restating that prose.
export const TEST_CHECKLIST_ITEMS: Record<RaceCategory, string[]> = {
  multisport: [
    'Race-day nutrition, tried in a real long session - not for the first time on race day',
    'At least one session at your goal race pace',
    'Every piece of race gear (wetsuit, shoes, on-bike nutrition) tested in training',
    'A full-speed transition run-through',
  ],
  run: [
    'Race-day nutrition, tried in a real long run - not for the first time on race day',
    'At least one run at your goal race pace',
    'Race-day shoes and gear, broken in and tested in training',
  ],
  other: [
    'Race-day nutrition, tried in a real long session - not for the first time on race day',
    'At least one session at your goal race pace',
    'Race-day gear tested in training, not brand new on the day',
  ],
}

// One-time seed set for a race with no checklist items yet - flattens
// PACKING_LISTS' T1/T2/T3/bag grouping into plain 'gear' items (the
// transition grouping matters for packing bags, not for a done/not-done
// checklist) and pairs it with TEST_CHECKLIST_ITEMS above. Order is
// preserved so the seeded list reads in the same sequence as the existing
// Packing List card did.
export function defaultChecklistItems(category: RaceCategory): { category: 'gear' | 'test'; title: string }[] {
  const packingList = category === 'multisport' ? PACKING_LISTS.multisport : PACKING_LISTS.run_or_other
  const gearTitles = [...(packingList.t1 ?? []), ...(packingList.t2 ?? []), ...(packingList.t3 ?? []), ...(packingList.bag ?? [])]

  return [
    ...gearTitles.map((title) => ({ category: 'gear' as const, title })),
    ...TEST_CHECKLIST_ITEMS[category].map((title) => ({ category: 'test' as const, title })),
  ]
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
  'For efforts over ~60-75 minutes: roughly 30-60g carbs/hour. Beyond ~2.5 hours - your longest key/brick sessions - that commonly rises to 60-90g/hour with a mixed glucose-fructose source. Log what you actually take in as an "Intra-Workout" entry in Nutrition so you can see what you tolerate well before race day. If you use caffeine regularly, tapering it down in the 3-4 days before race day is a commonly-cited way to restore its performance boost for race day itself - a reduction, not necessarily a full cutout. In the 2-3 days before race day, commonly-cited carb-loading guidance means shifting your diet toward more carbohydrate than usual (without necessarily eating more overall) to fill glycogen stores - separate from the per-hour fueling above, which is about during the race itself.'

// A separate block from FUELING_GUIDANCE (carbs) rather than folded into
// it - a fourth distinct topic in the same paragraph stops being
// skimmable. Same "cite a real, widely-established reference point,
// don't personalize what we can't know" discipline as the rest of this
// feature. Shown in the same spots FUELING_GUIDANCE already is.
export const HYDRATION_GUIDANCE =
  "Sweat loss above ~2% of body mass is a commonly-cited point where endurance performance measurably declines - worth knowing your rough sweat rate from a long session (weigh before/after, account for fluid intake) rather than guessing. Drink to thirst, not on a fixed schedule 'as much as possible' - real, documented cases of exercise-associated hyponatremia (dangerously low blood sodium from overdrinking) exist at the far end of that advice, and thirst-based hydration is the safer, commonly-cited approach for most athletes. For sodium, roughly 300-600mg/hour during long sessions is a commonly-cited starting range (more if you're a heavy/salty sweater) - same as fueling, test what you tolerate in training as an Intra-Workout entry, never for the first time on race day."

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

// DISRUPTION_GUIDANCE moved to '@/lib/disruptions' - training_disruptions
// is user-level, not race-specific, and is now also surfaced from the
// Calendar page, not just here.

// ─── Acclimation guidance (Part B) ─────────────────────────────────────
// Shown once per acclimation block, not per week - these weeks are
// still phase: 'base' underneath (see TrainingWeekSkeleton.isAcclimation
// in periodization.ts), so ZONE_GUIDANCE/STRENGTH_SEQUENCING_NOTES for
// 'base' already apply accurately; this is the one extra sentence
// explaining why this block is being shown before "Base Phase" at all.
export const ACCLIMATION_GUIDANCE =
  "This block isn't about building fitness yet - it's about getting your body and schedule used to training across three disciplines plus strength. Keep everything easy; the real ramp starts once this block ends."

// ─── Race simulation guidance ──────────────────────────────────────────
// Shown once, on the single week flagged isSimulationWeek (see
// periodization.ts) - a full dress rehearsal a few weeks before Taper
// begins, distinct from the routine weekly brick (bike-to-run
// transition practice) this feature already has. Deliberately does NOT
// claim a precise "70-80% effort" pace number - that's not a linear
// conversion from race pace and this feature doesn't fabricate that kind
// of precision elsewhere; instead it points at the already-displayed
// easy/race pace targets as the honest reference points.
export const RACE_SIMULATION_GUIDANCE =
  "This week's key session and brick are your race simulation - shorten them and aim for a pace between your easy and race-pace targets above, not full race effort, while treating everything else exactly like race day: your real race-day gear, and the nutrition you've been logging as Intra-Workout entries. Bricks here are bike-to-run only, so a full three-discipline rehearsal means fitting in a shortened swim nearby on your own."

// ─── Mental prep / pacing strategy ─────────────────────────────────────
// Text-only, alongside the existing pacing numbers on the Race Day Plan
// card - not a new computation, just naming a known hard point and one
// concrete cue, same "cite a real, honest practice" discipline as this
// file's other guidance.
export const MENTAL_PREP_GUIDANCE: Record<RaceCategory, string> = {
  multisport: 'The run leg is where most Ironman days are won or lost - fatigue and mental fade typically hit hardest in the back half of the marathon, not the swim or bike. Decide on one simple cue now, not mid-race: breaking the remaining distance into small chunks, a short mantra, or focusing on form and the next aid station rather than the finish line.',
  run: "The hardest mental stretch is typically the back third of the race, once early adrenaline fades and the finish still feels far off. Decide on one simple cue now: breaking the remaining distance into small chunks, a short mantra, or focusing on your next landmark rather than the finish line.",
  other: 'Know your hardest stretch before race day and have one simple cue ready for it - breaking the remaining effort into small chunks, a short mantra, or focusing on the next checkpoint rather than the finish.',
}

// ─── Running injury-prevention / mobility guidance ─────────────────────
// Running carries the highest injury risk of the three disciplines - the
// same real, sourced fact day-template.ts already cites internally to
// justify scheduling decisions (routing threshold work away from run for
// muscle-focused approaches), finally surfaced to the athlete directly
// instead of only ever used behind the scenes. Phase-keyed, same
// rendering slot as STRENGTH_SEQUENCING_NOTES/PHASE_NUTRITION_GUIDANCE
// (periodization.ts / nutrition-phase.ts) - one more line in an existing
// per-phase block, not a new card. Applies to Acclimation weeks too
// (still phase: 'base' underneath) - if anything, building the habit
// before real volume starts is the ideal time to start it.
export const RUN_INJURY_PREVENTION_GUIDANCE: Record<TrainingPhase, string> = {
  base: 'Running carries the highest injury risk of the three disciplines - build a simple mobility/prehab habit now (hips, calves, ankles) while volume is still low, before it has to compete for time with harder training later.',
  build: "Run volume and intensity are both climbing here, which is exactly when running injuries tend to show up - keep the mobility work from Base going rather than dropping it for extra volume.",
  peak: 'This is peak run load for the cycle - any nagging tightness or pain is worth addressing now, not pushing through, since there is limited time left to recover before race day.',
  taper: "Back off intensity, not just volume, on any lingering niggle here - there's no fitness left to gain this close to race day that's worth risking a DNS over.",
}

// ─── Post-race recovery ────────────────────────────────────────────────
// Shown once race day has passed (race.race_date < today) - the app
// previously only ever looked forward to race day, never past it. Scaled
// by category since a blanket "4-6 weeks" would be dishonestly long for
// a 5k and dishonestly short for a full-distance race; the "day per mile
// raced" heuristic below is specifically a running-recovery citation, not
// stretched to cover triathlon's mixed-discipline mileage.
export const POST_RACE_RECOVERY_GUIDANCE: Record<RaceCategory, string> = {
  multisport: "Give yourself real recovery time before jumping back into structured training - commonly-cited guidance suggests at least 1-2 weeks of easy movement only, with a full return to hard training taking 4-6 weeks after a full-distance race. It's normal for motivation and energy to dip for a while after a goal this big; that's part of recovering, not a setback.",
  run: "Give yourself real recovery time before jumping back into structured training - a commonly-cited rule of thumb is roughly a day of easy recovery per mile raced (a few days for a 5k/10k, longer for a marathon or beyond). It's normal for motivation to dip for a while after a big goal race; that's part of recovering, not a setback.",
  other: "Give yourself real recovery time before jumping back into structured training, scaled to how hard this effort was - a few easy days at minimum, longer after a bigger effort. It's normal for motivation to dip for a while after a big goal; that's part of recovering, not a setback.",
}
