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

// Optional tag for the small, fixed set of lifts the public strength
// leaderboard tracks (migration 080/081) - same additive, nullable-by-
// default shape as CARDIO_TYPES above, just for strength exercises. Most
// users never need to touch this: copying one of the four matching
// exercise_catalog rows (or an exact-name match backfilled by migration
// 080) already tags it automatically - this picker only matters for a
// freehand-named exercise.
export const PRIMARY_LIFTS = ['bench_press', 'back_squat', 'deadlift', 'overhead_press'] as const
export type PrimaryLift = (typeof PRIMARY_LIFTS)[number]

export const PRIMARY_LIFT_LABELS: Record<PrimaryLift, string> = {
  bench_press: 'Bench Press',
  back_squat: 'Back Squat',
  deadlift: 'Deadlift',
  overhead_press: 'Overhead Press',
}
