import type { SupabaseClient } from '@supabase/supabase-js'

export interface HistoricalSet {
  id: string
  weight: number
  reps: number
  rpe: number | null
  // Reps in reserve (0 = failure, 10 = very easy) - per-set (migration
  // 075), distinct from rpe above: rpe is already selected/read here but
  // nothing has ever written to it, and the two scales run in opposite
  // directions (lower rpe = easier, lower rir = harder), so they're kept
  // as separate fields rather than one conflated "effort" number.
  rir: number | null
  workoutDate: string
  createdAt: string
  // The equipment variant used for this exercise-instance, if any was picked
  // (e.g. "Hammer Strength", "1:1") — null when the exercise has no variants
  // defined, or none was selected for that session.
  variantLabel: string | null
  // Drop-set/myo-rep annotation, if the athlete tagged it at logging time -
  // null for a normal top set. Follow-on/burnout volume at a lighter
  // number, not a real top-set strength signal - see the recommend
  // route's own handling of this.
  technique: 'drop' | 'myo' | null
  // Workout-level (not per-set) post-session rating, migration 087 - the
  // whole workout's own session_feedback, same value repeated across
  // every set that belongs to it. A genuinely different signal from
  // rpe/rir: those ask "how hard was this specific set," this asks "was
  // the session as prescribed calibrated right" - see the recommend
  // route's own handling of this.
  sessionFeedback: 'too_easy' | 'just_right' | 'could_not_complete' | null
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
    'id, variant:exercise_variants(label), workout:workouts!inner(date, session_feedback), sets(id, weight, reps, rpe, rir, completed, created_at, set_type, is_deload_week)'
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
    const sessionFeedback: HistoricalSet['sessionFeedback'] = row.workout?.session_feedback ?? null

    for (const set of row.sets ?? []) {
      if (!set.completed) continue
      // A deload-week set is intentionally lighter by design (see
      // deload.ts) - not a real progression data point, so it's
      // excluded here rather than tagged the way drop/myo sets are
      // below. This shared function feeds both the AI Coach recommend
      // route's history/prefill reasoning and gymSuggestions.ts's
      // stall/regression detection (pure JS weight comparisons, no
      // model in the loop to interpret a soft tag) - a real deload
      // weight drop would otherwise misread as a stall or a regression
      // in the latter.
      if (set.is_deload_week) continue
      history.push({
        id: set.id,
        weight: typeof set.weight === 'string' ? parseFloat(set.weight) : set.weight,
        reps: typeof set.reps === 'string' ? parseInt(set.reps) : set.reps,
        rpe: set.rpe ?? null,
        rir: set.rir ?? null,
        workoutDate,
        createdAt: set.created_at,
        variantLabel,
        technique: set.set_type ?? null,
        sessionFeedback,
      })
    }
  }

  // createdAt as a tiebreaker so same-day sets sort precisely — needed to
  // determine the single most-recent set for cache invalidation.
  history.sort((a, b) => {
    const dateDiff = new Date(b.workoutDate).getTime() - new Date(a.workoutDate).getTime()
    if (dateDiff !== 0) return dateDiff
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
  return history
}
