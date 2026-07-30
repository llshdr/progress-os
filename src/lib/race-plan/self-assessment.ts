import type { RaceType } from '@/lib/race-constants'

// One flat shape, fields simply unused/null outside their race category -
// matches this app's existing preference for flat data shapes (e.g.
// CardioActivity, ManualCardio) over discriminated unions.
export interface SelfAssessment {
  perceivedFitness: 1 | 2 | 3 | 4 | 5 | null
  longestRecentDistanceKm: number | null
  recentTimeTrial: { distanceKm: number; timeSeconds: number } | null
  limiters: string[]
  swimComfort: 1 | 2 | 3 | 4 | 5 | null
  longestRecentBikeKm: number | null
  perceivedStrength: 1 | 2 | 3 | 4 | 5 | null
  pastMultisportExperience: 'none' | 'sprint' | 'olympic' | 'half_iron' | 'full_iron' | 'other' | null
  notes: string | null
}

export const EMPTY_SELF_ASSESSMENT: SelfAssessment = {
  perceivedFitness: null,
  longestRecentDistanceKm: null,
  recentTimeTrial: null,
  limiters: [],
  swimComfort: null,
  longestRecentBikeKm: null,
  perceivedStrength: null,
  pastMultisportExperience: null,
  notes: null,
}

export type RaceCategory = 'run' | 'multisport' | 'other'

const MULTISPORT_TYPES: RaceType[] = ['ironman', 'xtri']
const RUN_TYPES: RaceType[] = ['marathon', 'half_marathon', '10k', '5k', 'ultra_run']

export function raceCategoryFor(raceType: RaceType): RaceCategory {
  if (MULTISPORT_TYPES.includes(raceType)) return 'multisport'
  if (RUN_TYPES.includes(raceType)) return 'run'
  return 'other'
}

export interface AssessmentQuestion {
  id: keyof SelfAssessment
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

const MULTISPORT_QUESTIONS: AssessmentQuestion[] = [
  ...RUN_QUESTIONS,
  {
    id: 'swimComfort',
    label: 'How comfortable are you in open water?',
    type: 'scale',
    helpText: 'Not sure? "Not confident" is a totally normal answer — it just shapes how the swim leg gets treated.',
    options: [
      { value: '1', label: 'Not confident in open water' },
      { value: '2', label: 'Can manage short distances' },
      { value: '3', label: 'Comfortable at moderate distance' },
      { value: '4', label: 'Confident, trained regularly' },
      { value: '5', label: 'Could do the full swim distance today' },
    ],
  },
  {
    id: 'longestRecentBikeKm',
    label: 'Longest bike ride in the last month (km)',
    type: 'distance',
    helpText: 'A rough guess is fine — even "around 40km" helps.',
  },
  {
    id: 'perceivedStrength',
    label: 'How would you rate your current strength training?',
    type: 'scale',
    helpText: 'We already track your logged lifts, so this is mostly a sanity check — answer however feels right.',
    options: FITNESS_SCALE_OPTIONS,
  },
  {
    id: 'pastMultisportExperience',
    label: 'Past multi-sport race experience',
    type: 'chips',
    helpText: 'Pick the closest match.',
    options: [
      { value: 'none', label: 'None yet' },
      { value: 'sprint', label: 'Sprint triathlon' },
      { value: 'olympic', label: 'Olympic triathlon' },
      { value: 'half_iron', label: 'Half-iron distance' },
      { value: 'full_iron', label: 'Full-iron distance' },
      { value: 'other', label: 'Other' },
    ],
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

export function questionsForCategory(category: RaceCategory): AssessmentQuestion[] {
  if (category === 'multisport') return MULTISPORT_QUESTIONS
  if (category === 'run') return RUN_QUESTIONS
  return OTHER_QUESTIONS
}
