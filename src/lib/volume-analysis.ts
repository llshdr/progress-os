import type { SupabaseClient } from '@supabase/supabase-js'

// Standard, widely-cited resistance-training volume range (working sets per
// muscle per week) - same "not invented" sourcing discipline already used
// for the bulk/cut kcal adjustments in lib/nutrition.ts.
export const MUSCLE_VOLUME_GUIDELINE = { minSetsPerWeek: 10, maxSetsPerWeek: 20 }

export type VolumeStatus = 'under' | 'within' | 'over'

export interface MuscleVolume {
  muscle: string
  sets: number
  status: VolumeStatus
}

export function classifyVolume(sets: number): VolumeStatus {
  if (sets < MUSCLE_VOLUME_GUIDELINE.minSetsPerWeek) return 'under'
  if (sets > MUSCLE_VOLUME_GUIDELINE.maxSetsPerWeek) return 'over'
  return 'within'
}

// Completed sets over a rolling window, counted per muscle target (granular
// when the exercise has it, falling back to the broad primary muscle group
// otherwise - same graceful-degradation as everywhere else this data is
// used). A compound movement hitting multiple targets counts toward each.
// `sets` has no user_id column of its own - RLS (via exercises/workouts)
// already scopes this to the current user, same as elsewhere in this app.
export async function computeMuscleVolume(supabase: SupabaseClient, days = 7): Promise<MuscleVolume[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data, error } = await supabase
    .from('sets')
    .select('completed, created_at, exercise:exercises(exercise_library(primary_muscle_group, muscle_targets))')
    .eq('completed', true)
    .gte('created_at', since.toISOString())

  if (error) {
    console.error('Error computing muscle volume:', error)
    return []
  }

  const counts = new Map<string, number>()

  for (const row of (data ?? []) as any[]) {
    const library = row.exercise?.exercise_library
    if (!library) continue

    const targets: string[] =
      library.muscle_targets && library.muscle_targets.length > 0
        ? library.muscle_targets
        : library.primary_muscle_group
          ? [library.primary_muscle_group]
          : []

    for (const target of targets) {
      counts.set(target, (counts.get(target) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .map(([muscle, sets]) => ({ muscle, sets, status: classifyVolume(sets) }))
    .sort((a, b) => a.sets - b.sets)
}
