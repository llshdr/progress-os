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
