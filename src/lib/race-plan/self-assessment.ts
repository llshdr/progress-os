import type { RaceType } from '@/lib/race-constants'

export type RaceCategory = 'run' | 'multisport' | 'other'

const MULTISPORT_TYPES: RaceType[] = ['ironman', 'xtri']
const RUN_TYPES: RaceType[] = ['marathon', 'half_marathon', '10k', '5k', 'ultra_run']

export function raceCategoryFor(raceType: RaceType): RaceCategory {
  if (MULTISPORT_TYPES.includes(raceType)) return 'multisport'
  if (RUN_TYPES.includes(raceType)) return 'run'
  return 'other'
}

export type Discipline = 'swim' | 'bike' | 'run'

export interface DisciplineAssessment {
  comfortLevel: 1 | 2 | 3 | 4 | 5 | null
  // A comfortable, talk-test-sustainable pace + how long it can currently
  // be held - a real Zone 2 signal, distinct from recentTimeTrial (a
  // near-max effort) and longestRecentSessionKm (distance only, no
  // pace). Stored normalized as sec/km regardless of discipline (see
  // pace-units.ts) so it compares directly against logged-activity pace.
  comfortableEffort: { paceSecPerKm: number; sustainedMinutes: number } | null
  longestRecentSessionKm: number | null
  recentTimeTrial: { distanceKm: number; timeSeconds: number } | null
  limiters: string[]
}

export const EMPTY_DISCIPLINE_ASSESSMENT: DisciplineAssessment = {
  comfortLevel: null,
  comfortableEffort: null,
  longestRecentSessionKm: null,
  recentTimeTrial: null,
  limiters: [],
}

// Mandatory, discipline-grouped - Ironman/Xtri only. comfortLevel is the
// one required field per discipline (always answerable, even "1, not
// confident"); everything else stays optional.
export interface MultisportSelfAssessment {
  kind: 'multisport'
  swim: DisciplineAssessment
  bike: DisciplineAssessment
  run: DisciplineAssessment
  perceivedStrength: 1 | 2 | 3 | 4 | 5 | null
  pastMultisportExperience: 'none' | 'sprint' | 'olympic' | 'half_iron' | 'full_iron' | 'other' | null
  notes: string | null
}

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'

// Maps self-reported past multi-sport race experience to a training
// level, driving the researched peak-volume targets in periodization.ts.
// Conservative by design: unanswered/no past experience defaults to
// beginner rather than assuming more capability than demonstrated.
const EXPERIENCE_LEVEL_BY_PAST_EXPERIENCE: Record<NonNullable<MultisportSelfAssessment['pastMultisportExperience']>, ExperienceLevel> = {
  none: 'beginner',
  sprint: 'beginner',
  olympic: 'intermediate',
  half_iron: 'intermediate',
  full_iron: 'advanced',
  other: 'intermediate',
}

export function experienceLevelFor(pastMultisportExperience: MultisportSelfAssessment['pastMultisportExperience']): ExperienceLevel {
  return pastMultisportExperience ? EXPERIENCE_LEVEL_BY_PAST_EXPERIENCE[pastMultisportExperience] : 'beginner'
}

// Light, fully-optional single-discipline form - unchanged shape/behavior
// from before this phase, still drives self-assessment-form.tsx for
// 'run'/'other' races.
export interface SimpleSelfAssessment {
  kind: 'simple'
  perceivedFitness: 1 | 2 | 3 | 4 | 5 | null
  longestRecentDistanceKm: number | null
  recentTimeTrial: { distanceKm: number; timeSeconds: number } | null
  limiters: string[]
  notes: string | null
}

export type SelfAssessment = SimpleSelfAssessment | MultisportSelfAssessment

export const EMPTY_SIMPLE_SELF_ASSESSMENT: SimpleSelfAssessment = {
  kind: 'simple',
  perceivedFitness: null,
  longestRecentDistanceKm: null,
  recentTimeTrial: null,
  limiters: [],
  notes: null,
}

export const EMPTY_MULTISPORT_SELF_ASSESSMENT: MultisportSelfAssessment = {
  kind: 'multisport',
  swim: { ...EMPTY_DISCIPLINE_ASSESSMENT },
  bike: { ...EMPTY_DISCIPLINE_ASSESSMENT },
  run: { ...EMPTY_DISCIPLINE_ASSESSMENT },
  perceivedStrength: null,
  pastMultisportExperience: null,
  notes: null,
}

export function emptySelfAssessmentFor(category: RaceCategory): SelfAssessment {
  return category === 'multisport' ? { ...EMPTY_MULTISPORT_SELF_ASSESSMENT } : { ...EMPTY_SIMPLE_SELF_ASSESSMENT }
}

// Defensive normalization for old-shape (pre-phase-1) or malformed stored
// JSON - falls back to an empty assessment of the right shape rather than
// crashing on an unrecognized `kind`. Personal-app scale: no data
// migration, just a safe read.
export function normalizeSelfAssessment(value: unknown, category: RaceCategory): SelfAssessment {
  if (value && typeof value === 'object' && (value as any).kind === 'simple' && category !== 'multisport') {
    return { ...EMPTY_SIMPLE_SELF_ASSESSMENT, ...(value as object) }
  }
  if (value && typeof value === 'object' && (value as any).kind === 'multisport' && category === 'multisport') {
    const v = value as any
    return {
      ...EMPTY_MULTISPORT_SELF_ASSESSMENT,
      ...v,
      swim: { ...EMPTY_DISCIPLINE_ASSESSMENT, ...(v.swim ?? {}) },
      bike: { ...EMPTY_DISCIPLINE_ASSESSMENT, ...(v.bike ?? {}) },
      run: { ...EMPTY_DISCIPLINE_ASSESSMENT, ...(v.run ?? {}) },
    }
  }
  return emptySelfAssessmentFor(category)
}

export interface AssessmentQuestion {
  id: keyof SimpleSelfAssessment
  label: string
  type: 'scale' | 'chips' | 'distance' | 'time' | 'text'
  helpText: string
  options?: { value: string; label: string }[]
}

const FITNESS_SCALE_OPTIONS = [
  { value: '1', label: 'Just starting out' },
  { value: '2', label: 'Building a base' },
  { value: '3', label: 'Comfortably active' },
  { value: '4', label: 'Solidly trained' },
  { value: '5', label: 'Could race tomorrow' },
]

const LIMITER_OPTIONS = [
  { value: 'knee_joint', label: 'Old knee/joint issue' },
  { value: 'breathing_pacing', label: 'Breathing/pacing control' },
  { value: 'long_session_endurance', label: 'Long-session endurance' },
  { value: 'strength_weak_point', label: 'Strength is my weak point' },
  { value: 'none', label: 'None that I know of' },
]

const RUN_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 'perceivedFitness',
    label: 'How would you describe your current running fitness?',
    type: 'scale',
    helpText: 'Not sure? Check Records → Cardio for your recent runs, or skip this — we\'ll use your logged activity instead.',
    options: FITNESS_SCALE_OPTIONS,
  },
  {
    id: 'longestRecentDistanceKm',
    label: 'Longest comfortable run in the last month (km)',
    type: 'distance',
    helpText: 'Example: if you can currently run 5km without stopping and feel okay after, put 5. A rough guess is fine.',
  },
  {
    id: 'recentTimeTrial',
    label: 'A recent race or time-trial result, if you have one',
    type: 'time',
    helpText: 'Optional — a distance and time from any run you pushed the pace on recently.',
  },
  {
    id: 'limiters',
    label: 'Anything currently holding you back?',
    type: 'chips',
    helpText: 'Pick any that apply — this just helps the plan avoid pushing into a known weak spot.',
    options: LIMITER_OPTIONS,
  },
]

const OTHER_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 'perceivedFitness',
    label: 'How would you describe your current overall fitness?',
    type: 'scale',
    helpText: 'Not sure? Skip this — we\'ll lean on your logged activity instead.',
    options: FITNESS_SCALE_OPTIONS,
  },
  {
    id: 'notes',
    label: 'Anything else the plan should account for?',
    type: 'text',
    helpText: 'Optional — free text, whatever seems relevant for this race.',
  },
]

// Only meaningful for 'run'/'other' now - multisport races use
// questionsForDiscipline below instead, via multisport-self-assessment-form.tsx.
export function questionsForCategory(category: RaceCategory): AssessmentQuestion[] {
  if (category === 'run') return RUN_QUESTIONS
  return OTHER_QUESTIONS
}

export interface DisciplineQuestion {
  id: keyof DisciplineAssessment
  label: string
  type: 'scale' | 'chips' | 'distance' | 'time' | 'pace_duration'
  helpText: string
  required?: boolean
  options?: { value: string; label: string }[]
}

const DISCIPLINE_LABEL: Record<Discipline, string> = { swim: 'swim', bike: 'bike', run: 'run' }

const DISCIPLINE_LIMITER_OPTIONS: Record<Discipline, { value: string; label: string }[]> = {
  swim: [
    { value: 'open_water_confidence', label: 'Not confident in open water' },
    { value: 'breathing_technique', label: 'Breathing/technique' },
    { value: 'long_session_endurance', label: 'Long-session endurance' },
    { value: 'none', label: 'None that I know of' },
  ],
  bike: [
    { value: 'traffic_hills_comfort', label: 'Comfort with traffic/hills' },
    { value: 'saddle_comfort', label: 'Saddle/position comfort' },
    { value: 'long_session_endurance', label: 'Long-session endurance' },
    { value: 'none', label: 'None that I know of' },
  ],
  run: LIMITER_OPTIONS,
}

// Same four question types (comfort/longest-session/time-trial/limiters)
// for every discipline, just relabeled - one generator instead of three
// near-identical hardcoded lists.
export function questionsForDiscipline(discipline: Discipline): DisciplineQuestion[] {
  const label = DISCIPLINE_LABEL[discipline]
  return [
    {
      id: 'comfortLevel',
      label: `How comfortable are you with the ${label}?`,
      type: 'scale',
      required: true,
      helpText: 'Not sure? An honest low rating is a normal, useful answer — it just shapes how this discipline gets treated.',
      options: FITNESS_SCALE_OPTIONS,
    },
    {
      id: 'comfortableEffort',
      label: `A pace you can comfortably hold for 30-60 minutes in the ${label}`,
      type: 'pace_duration',
      helpText:
        "Comfortable = you could hold a full conversation, breathing controlled, not gasping — not your fastest recent effort (that's the time trial question below).",
    },
    {
      id: 'longestRecentSessionKm',
      label: `Longest recent ${label} session (km)`,
      type: 'distance',
      helpText: 'A rough guess is fine — even an approximate distance helps.',
    },
    {
      id: 'recentTimeTrial',
      label: `A recent ${label} time trial, if you have one`,
      type: 'time',
      helpText: 'Optional — a distance and time from any session you pushed the pace on recently.',
    },
    {
      id: 'limiters',
      label: `Anything holding back your ${label}?`,
      type: 'chips',
      helpText: 'Pick any that apply — this just helps the plan avoid pushing into a known weak spot.',
      options: DISCIPLINE_LIMITER_OPTIONS[discipline],
    },
  ]
}
