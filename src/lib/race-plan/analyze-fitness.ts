import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchCardioActivity, bucketWeeklyCardioDistance } from '@/lib/cardio-stats'
import { computeMuscleVolume, type MuscleVolume } from '@/lib/volume-analysis'
import { estimateOneRepMax } from '@/lib/estimate1rm'
import { getLocalWeekStart, getLocalDateString } from '@/lib/date'
import { fetchActiveActionItems } from '@/lib/goals'
import type { RaceType } from '@/lib/race-constants'
import type { TrainingPhase as NutritionPhase, TrainingIntensity as NutritionIntensity } from '@/lib/nutrition'

export interface MuscleGroupTrend {
  muscleGroup: string
  currentBestEst1RM: number
  trend: 'up' | 'flat' | 'down'
}

export interface PastRaceResult {
  raceType: RaceType
  courseId: string | null
  courseOrLocation: string | null
  raceDate: string
  resultSeconds: number
}

export interface WeightTrend {
  currentWeightKg: number
  changeKgLast90Days: number | null
  currentBodyFatPct: number | null
  changeBodyFatPctLast90Days: number | null
}

export interface FitnessSnapshot {
  cardio: {
    weeklyDistanceKm: number[] // last 8 weeks, oldest first
    weeksActive: number // out of 8
    avgPaceSecPerKmRecent: number | null // last 4 weeks
    avgPaceSecPerKmPrior: number | null // the 4 weeks before that
    longestSessionKm: number
    recentAvgWeeklyKm: number // last 4 weeks - the periodization ramp's baseline
    recentAvgSessionsPerWeek: number // last 4 weeks
  }
  strength: {
    muscleGroupTrends: MuscleGroupTrend[]
    recentSessionsPerWeek: number // distinct days with a completed set, last 4 weeks
  }
  muscleVolume: MuscleVolume[]
  gymConsistencyWeeks: number // distinct weeks with a completed workout, last 90 days
  nutritionConsistencyWeeks: number // distinct weeks with a nutrition entry, last 90 days
  trainingPhase: NutritionPhase | null
  trainingIntensity: NutritionIntensity | null
  maintenanceCalories: number | null
  competingGoalsCount: number
  pastRaceResults: PastRaceResult[] // the user's other completed races with a logged result, most recent first
  weightTrend: WeightTrend | null // null if no weight_entries logged at all
}

const DAY_MS = 24 * 60 * 60 * 1000

function averagePace(activities: { distanceKm: number; durationSeconds: number }[]): number | null {
  const totalDistance = activities.reduce((sum, a) => sum + a.distanceKm, 0)
  const totalDuration = activities.reduce((sum, a) => sum + a.durationSeconds, 0)
  return totalDistance > 0 ? totalDuration / totalDistance : null
}

async function computeConsistencyWeeks(
  supabase: SupabaseClient,
  table: 'workouts' | 'nutrition_entries',
  dateColumn: string,
  userId: string
): Promise<number> {
  const since = new Date(Date.now() - 90 * DAY_MS)
  let query = supabase.from(table).select(dateColumn).eq('user_id', userId).gte(dateColumn, since.toISOString())
  if (table === 'workouts') query = query.not(dateColumn, 'is', null)

  const { data, error } = await query
  if (error) {
    console.error(`Error computing consistency weeks for ${table}:`, error)
    return 0
  }

  const weeks = new Set(
    (data ?? [])
      .map((row: any) => row[dateColumn])
      .filter((value: string | null): value is string => Boolean(value))
      .map((value) => getLocalDateString(getLocalWeekStart(new Date(value))))
  )
  return weeks.size
}

async function computeStrengthFacts(
  supabase: SupabaseClient
): Promise<{ muscleGroupTrends: MuscleGroupTrend[]; recentSessionsPerWeek: number }> {
  const twelveWeeksAgo = new Date(Date.now() - 84 * DAY_MS)
  const sixWeeksAgo = new Date(Date.now() - 42 * DAY_MS)
  const fourWeeksAgo = new Date(Date.now() - 28 * DAY_MS)

  const { data, error } = await supabase
    .from('sets')
    .select('weight, reps, created_at, exercise:exercises(exercise_library(primary_muscle_group))')
    .eq('completed', true)
    .gte('created_at', twelveWeeksAgo.toISOString())

  if (error) {
    console.error('Error fetching sets for strength trend:', error)
    return { muscleGroupTrends: [], recentSessionsPerWeek: 0 }
  }

  const recentBest = new Map<string, number>()
  const priorBest = new Map<string, number>()
  // Keyed by calendar date, not by session - a deliberate choice, not a
  // silent one: two sessions on the same day (e.g. an AM/PM split)
  // still count as one trained day here, matching "sessions/week" as
  // used elsewhere in this app (cardio's weeksActive/recentAvgSessionsPerWeek
  // are also day-based, not session-count-based).
  const recentDays = new Set<string>()

  for (const row of (data ?? []) as any[]) {
    const createdAt = new Date(row.created_at)
    // A day counts as "trained" from ANY completed set, whether or not
    // its exercise resolves to a muscle group - a day shouldn't vanish
    // from the frequency count just because one exercise in the library
    // is missing that tag. Muscle-group data below is only for
    // muscleGroupTrends, never for gating whether the day counts.
    if (createdAt >= fourWeeksAgo) recentDays.add(getLocalDateString(createdAt))

    const muscleGroup: string | undefined = row.exercise?.exercise_library?.primary_muscle_group
    if (!muscleGroup) continue

    const weight = typeof row.weight === 'string' ? parseFloat(row.weight) : row.weight
    const reps = typeof row.reps === 'string' ? parseInt(row.reps) : row.reps
    const est1RM = estimateOneRepMax(weight, reps)

    if (createdAt >= sixWeeksAgo) {
      recentBest.set(muscleGroup, Math.max(recentBest.get(muscleGroup) ?? 0, est1RM))
    } else {
      priorBest.set(muscleGroup, Math.max(priorBest.get(muscleGroup) ?? 0, est1RM))
    }
  }

  const muscleGroupTrends: MuscleGroupTrend[] = Array.from(recentBest.entries()).map(([muscleGroup, currentBestEst1RM]) => {
    const prior = priorBest.get(muscleGroup)
    let trend: MuscleGroupTrend['trend'] = 'flat'
    if (prior) {
      const ratio = currentBestEst1RM / prior
      trend = ratio > 1.05 ? 'up' : ratio < 0.95 ? 'down' : 'flat'
    }
    return { muscleGroup, currentBestEst1RM: Math.round(currentBestEst1RM * 10) / 10, trend }
  })

  return { muscleGroupTrends, recentSessionsPerWeek: recentDays.size / 4 }
}

async function fetchPastRaceResults(supabase: SupabaseClient, userId: string, excludeRaceId?: string): Promise<PastRaceResult[]> {
  let query = supabase
    .from('races')
    .select('race_type, course_id, location, race_date, result_duration_seconds')
    .eq('user_id', userId)
    .not('result_duration_seconds', 'is', null)
    .order('race_date', { ascending: false })

  if (excludeRaceId) query = query.neq('id', excludeRaceId)

  const { data, error } = await query
  if (error) {
    console.error('Error fetching past race results:', error)
    return []
  }

  const rows = (data ?? []) as any[]
  const courseIds = rows.map((r) => r.course_id).filter((id): id is string => Boolean(id))
  let courseNameById = new Map<string, string>()
  if (courseIds.length > 0) {
    const { data: courses } = await supabase.from('race_courses').select('id, name').in('id', courseIds)
    courseNameById = new Map((courses ?? []).map((c: any) => [c.id as string, c.name as string]))
  }

  return rows.map((r) => ({
    raceType: r.race_type as RaceType,
    courseId: r.course_id ?? null,
    courseOrLocation: (r.course_id ? courseNameById.get(r.course_id) : null) ?? r.location ?? null,
    raceDate: r.race_date as string,
    resultSeconds: r.result_duration_seconds as number,
  }))
}

async function computeWeightTrend(supabase: SupabaseClient, userId: string): Promise<WeightTrend | null> {
  const { data, error } = await supabase
    .from('weight_entries')
    .select('weight, body_fat_percentage, recorded_at')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: true })

  if (error) {
    console.error('Error fetching weight entries for trend:', error)
    return null
  }
  if (!data || data.length === 0) return null

  const ninetyDaysAgo = new Date(Date.now() - 90 * DAY_MS)
  const withinWindow = data.filter((e: any) => new Date(e.recorded_at) >= ninetyDaysAgo)
  const earliest = withinWindow[0] ?? null
  const latest = data[data.length - 1] as any

  return {
    currentWeightKg: latest.weight,
    changeKgLast90Days: earliest ? latest.weight - earliest.weight : null,
    currentBodyFatPct: latest.body_fat_percentage ?? null,
    changeBodyFatPctLast90Days:
      earliest && earliest.body_fat_percentage != null && latest.body_fat_percentage != null
        ? latest.body_fat_percentage - earliest.body_fat_percentage
        : null,
  }
}

// Pure facts, zero model calls - cheap enough to recompute on every page
// load (same "no cache table, cheap client-side recompute" precedent as
// ScheduledVolumeCard). Callable directly from a client component, same as
// fetchCardioActivity/computeMuscleVolume already are.
export async function analyzeCurrentFitness(supabase: SupabaseClient, userId: string, excludeRaceId?: string): Promise<FitnessSnapshot> {
  const activities = await fetchCardioActivity(supabase)
  const weeklyBuckets = bucketWeeklyCardioDistance(activities, 8)
  const weeklyDistanceKm = weeklyBuckets.map((w) => Math.round(w.totalKm * 10) / 10)
  const weeksActive = weeklyBuckets.filter((w) => w.totalKm > 0).length

  const fourWeeksAgo = new Date(Date.now() - 28 * DAY_MS)
  const eightWeeksAgo = new Date(Date.now() - 56 * DAY_MS)
  const recentActivities = activities.filter((a) => new Date(a.date) >= fourWeeksAgo)
  const priorActivities = activities.filter((a) => new Date(a.date) >= eightWeeksAgo && new Date(a.date) < fourWeeksAgo)
  const windowActivities = activities.filter((a) => new Date(a.date) >= eightWeeksAgo)

  const recentAvgWeeklyKm = recentActivities.reduce((sum, a) => sum + a.distanceKm, 0) / 4
  const recentAvgSessionsPerWeek = recentActivities.length / 4
  const longestSessionKm = windowActivities.reduce((max, a) => Math.max(max, a.distanceKm), 0)

  const [strengthFacts, muscleVolume, gymConsistencyWeeks, nutritionConsistencyWeeks, settingsResult, actionItems, pastRaceResults, weightTrend] =
    await Promise.all([
      computeStrengthFacts(supabase),
      computeMuscleVolume(supabase),
      computeConsistencyWeeks(supabase, 'workouts', 'completed_at', userId),
      computeConsistencyWeeks(supabase, 'nutrition_entries', 'date', userId),
      supabase.from('user_settings').select('training_phase, training_intensity, maintenance_calories').eq('user_id', userId).maybeSingle(),
      fetchActiveActionItems(supabase, userId),
      fetchPastRaceResults(supabase, userId, excludeRaceId),
      computeWeightTrend(supabase, userId),
    ])

  return {
    cardio: {
      weeklyDistanceKm,
      weeksActive,
      avgPaceSecPerKmRecent: averagePace(recentActivities),
      avgPaceSecPerKmPrior: averagePace(priorActivities),
      longestSessionKm,
      recentAvgWeeklyKm,
      recentAvgSessionsPerWeek,
    },
    strength: strengthFacts,
    muscleVolume,
    gymConsistencyWeeks,
    nutritionConsistencyWeeks,
    trainingPhase: (settingsResult.data?.training_phase as NutritionPhase | undefined) ?? null,
    trainingIntensity: (settingsResult.data?.training_intensity as NutritionIntensity | undefined) ?? null,
    maintenanceCalories: settingsResult.data?.maintenance_calories ?? null,
    competingGoalsCount: actionItems.filter((item) => item.kind === 'goal').length,
    pastRaceResults,
    weightTrend,
  }
}
