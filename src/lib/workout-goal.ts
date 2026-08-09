import type { SupabaseClient } from '@supabase/supabase-js'

// Whether a completed workout counts toward the weekly workout target
// depends on user_settings.count_cardio_toward_workout_goal (migration
// 074) - shared by every consumer of that count (Dashboard progress,
// the Today-suggestion sentence, and the streak badge - see
// gym-streak.ts/gymSuggestions.ts/dashboard-client.tsx) so they can
// never quietly disagree with each other. Defaults to true (counts) -
// matches how every one of those consumers has always behaved (see the
// investigation this migration came out of: cardio_logs has existed
// since migration 026, long before this toggle, and none of the
// consuming queries ever distinguished exercise_type), so existing
// users see no silent change until they explicitly opt out.

// Narrows a list of completed workout IDs down to the ones that count,
// given the setting above. When cardio counts (the default), every
// workout counts - no extra query needed, same as the pre-toggle
// behavior. When it doesn't, a workout only counts if it has at least
// one exercise that ISN'T confirmed cardio: exercise_library_id IS NULL
// (ad-hoc, pre-exercise-library entries have no exercise_type to check -
// treated as counting, same "never silently reinterpret old data"
// precedent used elsewhere in this app) or exercise_library.exercise_type
// is 'strength'. A workout that's entirely cardio exercises is the only
// case excluded - a mixed strength+cardio session still counts.
export async function filterWorkoutsCountingTowardGoal(
  supabase: SupabaseClient,
  workoutIds: string[],
  countCardio: boolean
): Promise<Set<string>> {
  if (countCardio || workoutIds.length === 0) return new Set(workoutIds)

  const { data } = await supabase
    .from('exercises')
    .select('workout_id, exercise_library_id, exercise_library(exercise_type)')
    .in('workout_id', workoutIds)

  const counting = new Set<string>()
  for (const row of (data ?? []) as any[]) {
    if (counting.has(row.workout_id)) continue
    const isConfirmedCardio = row.exercise_library_id != null && row.exercise_library?.exercise_type === 'cardio'
    if (!isConfirmedCardio) counting.add(row.workout_id)
  }

  return counting
}
