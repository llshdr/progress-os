import type { SupabaseClient } from '@supabase/supabase-js'
import { getLocalDateString, getLocalWeekStart } from '@/lib/date'
import { filterWorkoutsCountingTowardGoal } from '@/lib/workout-goal'

// Extracted out of gymSuggestions.ts so a real UI badge (Dashboard) and the
// AI Today-suggestion sentence read the exact same number, computed once,
// rather than two independent implementations that could quietly drift.
// Counts consecutive weeks (walking backward from the current week) where
// completed-workout count met weeklyGoal - breaks on the first week that
// falls short, including the current week if it hasn't hit the goal yet.
export async function computeGymStreakWeeks(
  supabase: SupabaseClient,
  userId: string,
  weeklyGoal: number,
  countCardio: boolean = true
): Promise<number> {
  const { data } = await supabase
    .from('workouts')
    .select('id, date')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('date', { ascending: false })
    .limit(200)

  if (!data || data.length === 0) return 0

  const countingIds = await filterWorkoutsCountingTowardGoal(
    supabase,
    data.map((row) => row.id),
    countCardio
  )

  const counts = new Map<string, number>()
  for (const row of data as { id: string; date: string }[]) {
    if (!countingIds.has(row.id)) continue
    const key = getLocalDateString(getLocalWeekStart(new Date(row.date)))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  let streak = 0
  const cursor = getLocalWeekStart(new Date())

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
