export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Arms',
  'Core',
  'Full Body',
]

export const EQUIPMENT_TYPES = [
  'Barbell',
  'Dumbbell',
  'Machine',
  'Cable',
  'Bodyweight',
  'Kettlebell',
  'Resistance Band',
  'Other',
]

export const CATEGORIES = [
  'Compound',
  'Isolation',
  'Cardio',
  'Mobility',
  'Stretching',
]

// Determines the logging shape for this exercise: strength sets
// (weight/reps) vs a cardio log (distance/duration) - separate from
// `category` above, which is just descriptive classification.
export const EXERCISE_TYPES = ['strength', 'cardio'] as const
export type ExerciseType = (typeof EXERCISE_TYPES)[number]

// Replaces the muscle-group picker for cardio exercises - a muscle group
// never made sense for "Running" or "Swimming" the way it does for a lift.
// Deliberately does not replace primary_muscle_group in the schema (see
// migration 073's own comment) - this is a new, additive field shown
// instead of the muscle-group picker in the UI only.
export const CARDIO_TYPES = [
  'running',
  'cycling',
  'swimming',
  'rowing',
  'elliptical',
  'stair_climber',
  'jump_rope',
  'hiking',
  'walking',
  'other',
] as const
export type CardioType = (typeof CARDIO_TYPES)[number]

export const CARDIO_TYPE_LABELS: Record<CardioType, string> = {
  running: 'Running',
  cycling: 'Cycling',
  swimming: 'Swimming',
  rowing: 'Rowing',
  elliptical: 'Elliptical',
  stair_climber: 'Stair Climber',
  jump_rope: 'Jump Rope',
  hiking: 'Hiking',
  walking: 'Walking',
  other: 'Other',
}
