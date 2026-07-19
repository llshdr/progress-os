import type { SupabaseClient } from '@supabase/supabase-js'

export interface HistoricalSet {
  weight: number
  reps: number
  rpe: number | null
  workoutDate: string
}

const MAX_WORKOUTS = 6

// Mirrors the exercise_library_id / exercise_name.ilike matching already used
// in the exercise detail page, so history lines up with what's shown there.
export async function getExerciseHistory(
  supabase: SupabaseClient,
  exerciseLibraryId: string | null,
  exerciseName: string | null
): Promise<HistoricalSet[]> {
  if (!exerciseLibraryId && !exerciseName) return []

  const filters = [
    exerciseLibraryId ? `exercise_library_id.eq.${exerciseLibraryId}` : null,
    exerciseName ? `exercise_name.ilike.${exerciseName}` : null,
  ].filter(Boolean) as string[]

  const { data, error } = await supabase
    .from('exercises')
    .select('workout:workouts!inner(date), sets(weight, reps, rpe, completed)')
    .or(filters.join(','))
    .order('date', { referencedTable: 'workouts', ascending: false })
    .limit(MAX_WORKOUTS)

  if (error || !data) return []

  const history: HistoricalSet[] = []
  for (const row of data as any[]) {
    const workoutDate: string | undefined = row.workout?.date
    if (!workoutDate) continue

    for (const set of row.sets ?? []) {
      if (!set.completed) continue
      history.push({
        weight: typeof set.weight === 'string' ? parseFloat(set.weight) : set.weight,
        reps: typeof set.reps === 'string' ? parseInt(set.reps) : set.reps,
        rpe: set.rpe ?? null,
        workoutDate,
      })
    }
  }

  history.sort((a, b) => new Date(b.workoutDate).getTime() - new Date(a.workoutDate).getTime())
  return history
}
