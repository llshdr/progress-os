import type { SupabaseClient } from '@supabase/supabase-js'
import { MUSCLE_TARGETS_BY_GROUP } from '@/lib/muscle-targets'
import { getLocalWeekStart } from '@/lib/date'

// Standard, widely-cited resistance-training volume range (working sets per
// muscle per week) - same "not invented" sourcing discipline already used
// for the bulk/cut kcal adjustments in lib/nutrition.ts.
export const MUSCLE_VOLUME_GUIDELINE = { minSetsPerWeek: 10, maxSetsPerWeek: 20 }

export type VolumeStatus = 'under' | 'within' | 'over'

export interface MuscleImbalance {
  highHead: string
  highSets: number
  lowHead: string
  lowSets: number
}

export interface MuscleVolume {
  muscle: string
  sets: number
  status: VolumeStatus
  imbalance?: MuscleImbalance
}

export function classifyVolume(sets: number): VolumeStatus {
  if (sets < MUSCLE_VOLUME_GUIDELINE.minSetsPerWeek) return 'under'
  if (sets > MUSCLE_VOLUME_GUIDELINE.maxSetsPerWeek) return 'over'
  return 'within'
}

// The 10-20 sets/week guideline is meant for the whole muscle, not one
// head - only these four muscles actually have multiple defined heads in
// MUSCLE_TARGETS_BY_GROUP. Everything else in that taxonomy (Quadriceps,
// Hamstrings, each Back/Core entry, etc.) is already 1:1 with its true
// muscle despite being nested under a broader category key there, so it's
// deliberately NOT included here - rolling up to MUSCLE_TARGETS_BY_GROUP's
// own top-level keys (e.g. "Legs") would incorrectly merge genuinely
// separate muscles (Quadriceps with Hamstrings, etc.), recreating the same
// problem this table exists to fix, one level up. Explicit table rather
// than stripping the "(...)" suffix generically - that trick would also
// incorrectly merge Back's/Core's distinct muscles.
const MUSCLE_HEAD_TO_PARENT: Record<string, string> = {
  'Chest (Upper)': 'Chest',
  'Chest (Mid)': 'Chest',
  'Chest (Lower)': 'Chest',
  'Shoulders (Front Delt)': 'Shoulders',
  'Shoulders (Side Delt)': 'Shoulders',
  'Shoulders (Rear Delt)': 'Shoulders',
  'Biceps (Long Head)': 'Biceps',
  'Biceps (Short Head)': 'Biceps',
  'Triceps (Long Head)': 'Triceps',
  'Triceps (Lateral Head)': 'Triceps',
  'Triceps (Medial Head)': 'Triceps',
}

function parentMuscle(target: string): string {
  return MUSCLE_HEAD_TO_PARENT[target] ?? target
}

// Derived once from MUSCLE_HEAD_TO_PARENT so the two views of the same
// data can't drift apart.
const HEADS_BY_PARENT: Record<string, string[]> = {}
for (const [head, parent] of Object.entries(MUSCLE_HEAD_TO_PARENT)) {
  ;(HEADS_BY_PARENT[parent] ??= []).push(head)
}

const IMBALANCE_RATIO = 3

// Simple, explainable rule (same plain-threshold discipline as
// classifyVolume): only muscles with multiple known heads are eligible;
// an untrained muscle (no sets on any head) is already flagged by its
// "under" status, not a separate imbalance note; otherwise flag when one
// head is completely untouched while another has sets, or the high/low
// ratio is at least 3x.
function detectImbalance(parent: string, rawCounts: Map<string, number>): MuscleImbalance | undefined {
  const heads = HEADS_BY_PARENT[parent]
  if (!heads || heads.length < 2) return undefined

  const headSets = heads.map((head) => ({ head, sets: rawCounts.get(head) ?? 0 }))
  const high = headSets.reduce((a, b) => (b.sets > a.sets ? b : a))
  const low = headSets.reduce((a, b) => (b.sets < a.sets ? b : a))

  if (high.sets === 0) return undefined
  if (low.sets === 0 || high.sets / low.sets >= IMBALANCE_RATIO) {
    return { highHead: high.head, highSets: high.sets, lowHead: low.head, lowSets: low.sets }
  }
  return undefined
}

// Shared by computeMuscleVolume and computeScheduledMuscleVolume so the
// rollup/imbalance rules can never drift apart between them - same
// reasoning as sharing classifyVolume/MUSCLE_VOLUME_GUIDELINE above.
function aggregateByParentMuscle(rawCounts: Map<string, number>): MuscleVolume[] {
  const parentSums = new Map<string, number>()
  for (const [target, sets] of rawCounts.entries()) {
    const parent = parentMuscle(target)
    parentSums.set(parent, (parentSums.get(parent) ?? 0) + sets)
  }

  return Array.from(parentSums.entries())
    .map(([muscle, sets]) => ({
      muscle,
      sets,
      status: classifyVolume(sets),
      imbalance: detectImbalance(muscle, rawCounts),
    }))
    .sort((a, b) => a.sets - b.sets)
}

// Completed sets since the start of the current calendar week (Monday,
// via getLocalWeekStart() - the same app-wide "this week" definition used
// everywhere else), counted per muscle target (granular when the exercise
// has it, falling back to the broad primary muscle group otherwise - same
// graceful-degradation as everywhere else this data is used). A compound
// movement hitting multiple targets counts toward each. `sets` has no
// user_id column of its own - RLS (via exercises/workouts) already scopes
// this to the current user, same as elsewhere in this app.
export async function computeMuscleVolume(supabase: SupabaseClient): Promise<MuscleVolume[]> {
  const since = getLocalWeekStart()

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

  return aggregateByParentMuscle(counts)
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

  return aggregateByParentMuscle(counts)
}
