import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchCardioActivity, bucketWeeklyCardioDistance } from '@/lib/cardio-stats'
import { computeMuscleVolume, type MuscleVolume } from '@/lib/volume-analysis'
import { estimateOneRepMax } from '@/lib/estimate1rm'
import { getLocalWeekStart, getLocalDateString } from '@/lib/date'
import { fetchActiveActionItems } from '@/lib/goals'

export interface MuscleGroupTrend {
  muscleGroup: string
  currentBestEst1RM: number
  trend: 'up' | 'flat' | 'down'
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
  trainingPhase: string | null
  trainingIntensity: string | null
  competingGoalsCount: number
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
  const recentDays = new Set<string>()

  for (const row of (data ?? []) as any[]) {
    const muscleGroup: string | undefined = row.exercise?.exercise_library?.primary_muscle_group
    if (!muscleGroup) continue

    const weight = typeof row.weight === 'string' ? parseFloat(row.weight) : row.weight
    const reps = typeof row.reps === 'string' ? parseInt(row.reps) : row.reps
    const est1RM = estimateOneRepMax(weight, reps)
    const createdAt = new Date(row.created_at)

    if (createdAt >= sixWeeksAgo) {
      recentBest.set(muscleGroup, Math.max(recentBest.get(muscleGroup) ?? 0, est1RM))
      if (createdAt >= fourWeeksAgo) recentDays.add(getLocalDateString(createdAt))
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

// Pure facts, zero model calls - cheap enough to recompute on every page
// load (same "no cache table, cheap client-side recompute" precedent as
// ScheduledVolumeCard). Callable directly from a client component, same as
// fetchCardioActivity/computeMuscleVolume already are.
export async function analyzeCurrentFitness(supabase: SupabaseClient, userId: string): Promise<FitnessSnapshot> {
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

  const [strengthFacts, muscleVolume, gymConsistencyWeeks, nutritionConsistencyWeeks, settingsResult, actionItems] = await Promise.all([
    computeStrengthFacts(supabase),
    computeMuscleVolume(supabase),
    computeConsistencyWeeks(supabase, 'workouts', 'completed_at', userId),
    computeConsistencyWeeks(supabase, 'nutrition_entries', 'date', userId),
    supabase.from('user_settings').select('training_phase, training_intensity').eq('user_id', userId).maybeSingle(),
    fetchActiveActionItems(supabase, userId),
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
    trainingPhase: settingsResult.data?.training_phase ?? null,
    trainingIntensity: settingsResult.data?.training_intensity ?? null,
    competingGoalsCount: actionItems.filter((item) => item.kind === 'goal').length,
  }
}
