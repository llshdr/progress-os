import type { SupabaseClient } from '@supabase/supabase-js'
import { getLocalWeekStart } from '@/lib/date'

export interface CardioActivity {
  date: string
  exerciseLibraryId: string
  exerciseName: string
  distanceKm: number
  durationSeconds: number
  // Real discipline signal when set (see exercise-constants.ts's
  // CardioType) - classifyDiscipline prefers this over guessing from
  // exerciseName. Null for exercises created before this field existed.
  cardioType: string | null
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
    .select('id, name, cardio_type')
    .eq('exercise_type', 'cardio')

  if (libraryError) {
    console.error('Error fetching cardio exercise library:', libraryError)
    return []
  }

  const libraryById = new Map(
    (cardioLibrary ?? []).map((l) => [l.id as string, { name: l.name as string, cardioType: (l.cardio_type as string | null) ?? null }])
  )
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

      const library = libraryById.get(meta.libraryId)

      return {
        date: meta.date,
        exerciseLibraryId: meta.libraryId,
        exerciseName: library?.name ?? 'Unknown',
        distanceKm: typeof log.distance_km === 'string' ? parseFloat(log.distance_km) : log.distance_km,
        durationSeconds: log.duration_seconds,
        cardioType: library?.cardioType ?? null,
      }
    })
    .filter((e): e is CardioActivity => e !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

// Shared distance/duration -> pace math, discipline-agnostic - callers
// decide which activities to pass in (e.g. filtered to one discipline)
// so this never assumes anything about what's being averaged.
export function averagePace(activities: { distanceKm: number; durationSeconds: number }[]): number | null {
  const totalDistance = activities.reduce((sum, a) => sum + a.distanceKm, 0)
  const totalDuration = activities.reduce((sum, a) => sum + a.durationSeconds, 0)
  return totalDistance > 0 ? totalDuration / totalDistance : null
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
