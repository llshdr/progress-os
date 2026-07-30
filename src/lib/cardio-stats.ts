import type { SupabaseClient } from '@supabase/supabase-js'
import { getLocalWeekStart } from '@/lib/date'

export interface CardioActivity {
  date: string
  exerciseLibraryId: string
  exerciseName: string
  distanceKm: number
  durationSeconds: number
}

export interface WeeklyCardioBucket {
  start: Date
  totalKm: number
}

// Generalizes gym/exercises/[id]/page.tsx's fetchCardioData to every cardio
// exercise at once, instead of one at a time - same "one flat pair of
// queries reduced client-side" shape gym/records/page.tsx already uses for
// its own cross-exercise aggregation. RLS already scopes exercises/
// cardio_logs to the current user via their owning workout, so no explicit
// user_id filter is needed on either.
export async function fetchCardioActivity(supabase: SupabaseClient): Promise<CardioActivity[]> {
  const { data: cardioLibrary, error: libraryError } = await supabase
    .from('exercise_library')
    .select('id, name')
    .eq('exercise_type', 'cardio')

  if (libraryError) {
    console.error('Error fetching cardio exercise library:', libraryError)
    return []
  }

  const libraryById = new Map((cardioLibrary ?? []).map((l) => [l.id as string, l.name as string]))
  const libraryIds = Array.from(libraryById.keys())
  if (libraryIds.length === 0) return []

  const { data: instances, error: instancesError } = await supabase
    .from('exercises')
    .select('id, exercise_library_id, workout:workouts!inner(date)')
    .in('exercise_library_id', libraryIds)

  if (instancesError) {
    console.error('Error fetching cardio exercise instances:', instancesError)
    return []
  }

  const instanceMeta = new Map(
    (instances ?? []).map((i: any) => [i.id as string, { date: i.workout.date as string, libraryId: i.exercise_library_id as string }])
  )

  const { data: logs, error: logsError } = await supabase
    .from('cardio_logs')
    .select('exercise_id, distance_km, duration_seconds')
    .in('exercise_id', Array.from(instanceMeta.keys()))

  if (logsError) {
    console.error('Error fetching cardio logs:', logsError)
    return []
  }

  return (logs ?? [])
    .map((log): CardioActivity | null => {
      const meta = instanceMeta.get(log.exercise_id)
      if (!meta) return null

      return {
        date: meta.date,
        exerciseLibraryId: meta.libraryId,
        exerciseName: libraryById.get(meta.libraryId) ?? 'Unknown',
        distanceKm: typeof log.distance_km === 'string' ? parseFloat(log.distance_km) : log.distance_km,
        durationSeconds: log.duration_seconds,
      }
    })
    .filter((e): e is CardioActivity => e !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

// Shared by /gym/records (Weekly Distance section) and the race training
// plan's fitness snapshot - one Monday-start bucketing so both stay in sync.
export function bucketWeeklyCardioDistance(activities: CardioActivity[], weeksShown = 8): WeeklyCardioBucket[] {
  const currentWeekStart = getLocalWeekStart()
  const weeks: WeeklyCardioBucket[] = []
  for (let i = weeksShown - 1; i >= 0; i--) {
    const start = new Date(currentWeekStart)
    start.setDate(start.getDate() - i * 7)
    weeks.push({ start, totalKm: 0 })
  }

  for (const activity of activities) {
    const activityWeekStart = getLocalWeekStart(new Date(activity.date))
    const bucket = weeks.find((w) => w.start.getTime() === activityWeekStart.getTime())
    if (bucket) bucket.totalKm += activity.distanceKm
  }

  return weeks
}
