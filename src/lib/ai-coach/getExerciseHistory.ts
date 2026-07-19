import type { SupabaseClient } from '@supabase/supabase-js'

export interface HistoricalSet {
  weight: number
  reps: number
  rpe: number | null
  workoutDate: string
  // The equipment variant used for this exercise-instance, if any was picked
  // (e.g. "Hammer Strength", "1:1") — null when the exercise has no variants
  // defined, or none was selected for that session.
  variantLabel: string | null
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

  // Two separate, properly-parameterized queries instead of a single .or()
  // built via string interpolation — an exercise name containing a comma or
  // other PostgREST-significant character would otherwise break or misbehave.
  const select =
    'id, variant:exercise_variants(label), workout:workouts!inner(date), sets(weight, reps, rpe, completed)'
  const queries: PromiseLike<any>[] = []

  if (exerciseLibraryId) {
    queries.push(
      supabase
        .from('exercises')
        .select(select)
        .eq('exercise_library_id', exerciseLibraryId)
        .order('date', { referencedTable: 'workouts', ascending: false })
        .limit(MAX_WORKOUTS)
    )
  }
  if (exerciseName) {
    queries.push(
      supabase
        .from('exercises')
        .select(select)
        .ilike('exercise_name', exerciseName)
        .order('date', { referencedTable: 'workouts', ascending: false })
        .limit(MAX_WORKOUTS)
    )
  }

  const results = await Promise.all(queries)
  if (results.some((r) => r.error)) return []

  // A row could in principle match both conditions — dedupe by exercises.id.
  const seen = new Set<string>()
  const rows: any[] = []
  for (const result of results) {
    for (const row of (result.data || []) as any[]) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      rows.push(row)
    }
  }

  const history: HistoricalSet[] = []
  for (const row of rows) {
    const workoutDate: string | undefined = row.workout?.date
    if (!workoutDate) continue

    const variantLabel: string | null = row.variant?.label ?? null

    for (const set of row.sets ?? []) {
      if (!set.completed) continue
      history.push({
        weight: typeof set.weight === 'string' ? parseFloat(set.weight) : set.weight,
        reps: typeof set.reps === 'string' ? parseInt(set.reps) : set.reps,
        rpe: set.rpe ?? null,
        workoutDate,
        variantLabel,
      })
    }
  }

  history.sort((a, b) => new Date(b.workoutDate).getTime() - new Date(a.workoutDate).getTime())
  return history
}
