import type { SupabaseClient } from '@supabase/supabase-js'
import { MUSCLE_TARGETS_BY_GROUP } from '@/lib/muscle-targets'

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

// Planned (not actual) weekly volume across the whole schedule rotation -
// target_sets per template exercise, multiplied by how many times that
// template appears among the user's schedule slots. A different question
// from computeMuscleVolume() above (which is real completed sets from the
// last N days) - this is "what would following the plan produce," so it
// reads from workout_template_exercises/workout_schedule_slots, never
// `sets`. Template exercises with no target_sets set contribute nothing -
// under-filled templates will under-count, which is correct/honest
// behavior, not a bug to work around.
//
// Every known granular target (MUSCLE_TARGETS_BY_GROUP) is zero-filled
// before counting, so a muscle the plan never touches at all shows up
// explicitly as "under" (0 sets) instead of being silently absent the way
// computeMuscleVolume's retrospective view leaves untrained muscles out -
// fine there ("nothing this week" isn't a plan gap), but the whole point
// here.
export async function computeScheduledMuscleVolume(
  supabase: SupabaseClient,
  userId: string
): Promise<MuscleVolume[]> {
  const { data: slots, error: slotsError } = await supabase
    .from('workout_schedule_slots')
    .select('template_id')
    .eq('user_id', userId)
    .not('template_id', 'is', null)

  if (slotsError) {
    console.error('Error fetching schedule slots for volume analysis:', slotsError)
    return []
  }

  const occurrences = new Map<string, number>()
  for (const row of (slots ?? []) as { template_id: string }[]) {
    occurrences.set(row.template_id, (occurrences.get(row.template_id) ?? 0) + 1)
  }

  const counts = new Map<string, number>()
  for (const target of Object.values(MUSCLE_TARGETS_BY_GROUP).flat()) {
    counts.set(target, 0)
  }

  const templateIds = Array.from(occurrences.keys())
  if (templateIds.length > 0) {
    const { data, error } = await supabase
      .from('workout_template_exercises')
      .select('template_id, target_sets, exercise_library(primary_muscle_group, muscle_targets)')
      .in('template_id', templateIds)

    if (error) {
      console.error('Error fetching template exercises for volume analysis:', error)
      return []
    }

    for (const row of (data ?? []) as any[]) {
      const library = row.exercise_library
      if (!library || !row.target_sets) continue

      const targets: string[] =
        library.muscle_targets && library.muscle_targets.length > 0
          ? library.muscle_targets
          : library.primary_muscle_group
            ? [library.primary_muscle_group]
            : []

      const multiplier = occurrences.get(row.template_id) ?? 0
      for (const target of targets) {
        counts.set(target, (counts.get(target) ?? 0) + row.target_sets * multiplier)
      }
    }
  }

  return Array.from(counts.entries())
    .map(([muscle, sets]) => ({ muscle, sets, status: classifyVolume(sets) }))
    .sort((a, b) => a.sets - b.sets)
}
