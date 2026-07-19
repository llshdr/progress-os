import type { SupabaseClient } from '@supabase/supabase-js'
import { getExerciseHistory } from './getExerciseHistory'
import type { SuggestionCandidate } from './types'
import { getLocalDateString } from '@/lib/date'

const RECENT_EXERCISE_LIMIT = 3
const STALL_SESSION_WINDOW = 3
const STREAK_MIN_WEEKS = 2

function startOfWeek(date: Date): Date {
  const start = new Date(date)
  start.setDate(start.getDate() - start.getDay())
  start.setHours(0, 0, 0, 0)
  return start
}

async function getStreakWeeks(
  supabase: SupabaseClient,
  userId: string,
  weeklyGoal: number
): Promise<number> {
  const { data } = await supabase
    .from('workouts')
    .select('date')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('date', { ascending: false })
    .limit(200)

  if (!data || data.length === 0) return 0

  const counts = new Map<string, number>()
  for (const row of data as { date: string }[]) {
    const key = getLocalDateString(startOfWeek(new Date(row.date)))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  let streak = 0
  const cursor = startOfWeek(new Date())

  while (true) {
    const key = getLocalDateString(cursor)
    const count = counts.get(key) ?? 0
    if (count >= weeklyGoal) {
      streak++
      cursor.setDate(cursor.getDate() - 7)
    } else {
      break
    }
  }

  return streak
}

interface RecentExerciseRef {
  exerciseLibraryId: string | null
  exerciseName: string | null
}

async function getRecentlyTrainedExercises(supabase: SupabaseClient): Promise<RecentExerciseRef[]> {
  const { data } = await supabase
    .from('exercises')
    .select('exercise_library_id, exercise_name, exercise_library(name), workout:workouts!inner(date)')
    .order('date', { referencedTable: 'workouts', ascending: false })
    .limit(20)

  const seen = new Set<string>()
  const result: RecentExerciseRef[] = []

  for (const row of (data ?? []) as any[]) {
    const exerciseLibraryId: string | null = row.exercise_library_id ?? null
    const exerciseName: string | null = row.exercise_library?.name ?? row.exercise_name ?? null
    const key = exerciseLibraryId || exerciseName
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push({ exerciseLibraryId, exerciseName })
    if (result.length >= RECENT_EXERCISE_LIMIT) break
  }

  return result
}

async function getExerciseTrendCandidates(supabase: SupabaseClient): Promise<SuggestionCandidate[]> {
  const recentExercises = await getRecentlyTrainedExercises(supabase)
  const candidates: SuggestionCandidate[] = []

  for (const ex of recentExercises) {
    const history = await getExerciseHistory(supabase, ex.exerciseLibraryId, ex.exerciseName)
    if (history.length === 0) continue

    const bestWeightBySession = new Map<string, number>()
    const variantBySession = new Map<string, string | null>()
    for (const set of history) {
      const best = bestWeightBySession.get(set.workoutDate) ?? 0
      bestWeightBySession.set(set.workoutDate, Math.max(best, set.weight))
      variantBySession.set(set.workoutDate, set.variantLabel)
    }

    const sessionsDesc = Array.from(bestWeightBySession.entries()).sort(
      (a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()
    )
    if (sessionsDesc.length < STALL_SESSION_WINDOW) continue

    const recentSessionDates = sessionsDesc.slice(0, STALL_SESSION_WINDOW).map(([date]) => date)

    // A stalled/progressing claim spanning two different machines or cable
    // ratios could easily be wrong, so skip it rather than risk asserting a
    // trend that isn't really there.
    const recentVariants = new Set(recentSessionDates.map((date) => variantBySession.get(date) ?? null))
    if (recentVariants.size > 1) continue

    const recentWeights = recentSessionDates.map((date) => bestWeightBySession.get(date)!)
    const label = ex.exerciseName || 'This exercise'
    const href = ex.exerciseLibraryId ? `/gym/exercises/${ex.exerciseLibraryId}` : null

    const allEqual = recentWeights.every((w) => w === recentWeights[0])
    const oldestToNewest = [...recentWeights].reverse()
    const strictlyIncreasing = oldestToNewest.every(
      (w, i) => i === 0 || w >= oldestToNewest[i - 1]
    ) && oldestToNewest[oldestToNewest.length - 1] > oldestToNewest[0]

    if (allEqual) {
      candidates.push({
        module: 'gym',
        text: `${label} has been steady at ${recentWeights[0]}kg for your last ${STALL_SESSION_WINDOW} sessions — might be time to add weight.`,
        action: href ? { label: 'View history', href } : null,
      })
    } else if (strictlyIncreasing) {
      candidates.push({
        module: 'gym',
        text: `${label} is trending up over your last ${STALL_SESSION_WINDOW} sessions — good progress.`,
        action: href ? { label: 'View history', href } : null,
      })
    }
  }

  return candidates
}

// Deterministic, real (non-hallucinated) candidate suggestions for the gym
// module. The daily generator may ask an LLM to pick/rephrase a subset of
// these, but every link and number here is computed directly from the DB.
export async function getGymSuggestionCandidates(
  supabase: SupabaseClient,
  userId: string,
  weeklyGoal: number
): Promise<SuggestionCandidate[]> {
  const candidates: SuggestionCandidate[] = []
  const today = getLocalDateString()

  const { data: weekWorkouts } = await supabase
    .from('workouts')
    .select('date')
    .eq('user_id', userId)
    .gte('date', getLocalDateString(startOfWeek(new Date())))
    .not('completed_at', 'is', null)

  const weeklyCount = weekWorkouts?.length ?? 0
  const loggedToday = (weekWorkouts ?? []).some((w: { date: string }) => w.date === today)

  if (!loggedToday) {
    candidates.push({
      module: 'gym',
      text: `No workout logged today yet — ${weeklyCount} of ${weeklyGoal} done this week.`,
      action: { label: 'Start a workout', href: '/gym/workouts/new' },
    })
  } else if (weeklyCount < weeklyGoal) {
    candidates.push({
      module: 'gym',
      text: `${weeklyCount} of ${weeklyGoal} workouts logged this week — keep it going.`,
      action: { label: 'View workouts', href: '/gym/workouts' },
    })
  }

  const streakWeeks = await getStreakWeeks(supabase, userId, weeklyGoal)
  if (streakWeeks >= STREAK_MIN_WEEKS) {
    candidates.push({
      module: 'gym',
      text: `You've hit your weekly target ${streakWeeks} weeks in a row — nice consistency.`,
      action: null,
    })
  }

  candidates.push(...(await getExerciseTrendCandidates(supabase)))

  return candidates
}
