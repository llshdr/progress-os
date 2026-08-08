import { getLocalWeekdayIndex } from '@/lib/date'

export interface Habit {
  id: string
  name: string
  // NULL = no fixed schedule, eligible every day. Otherwise a set of
  // weekday indices (0=Monday..6=Sunday) - same shape as calendar_entries'
  // own recurrence_weekdays (see migration 062).
  recurrenceWeekdays: number[] | null
  // Display/positioning only for the Calendar day view - never a real
  // reminder (this app has no notification infra). NULL = shows in the
  // day's all-day banner instead of a positioned block.
  usualTime: string | null
}

export interface HabitLog {
  id: string
  habitId: string
  date: string // YYYY-MM-DD
}

// Same membership test as entryAppliesToDate (calendar.ts), simplified -
// a habit has no start/end range, just an optional weekday set.
export function habitAppliesToDate(habit: Habit, date: string): boolean {
  if (!habit.recurrenceWeekdays || habit.recurrenceWeekdays.length === 0) return true
  return habit.recurrenceWeekdays.includes(getLocalWeekdayIndex(new Date(date + 'T00:00:00')))
}

export function isHabitLoggedOnDate(logs: HabitLog[], habitId: string, date: string): boolean {
  return logs.some((l) => l.habitId === habitId && l.date === date)
}

// Purely informational, gentle re-engagement signal - never a streak or
// "you're behind" framing (habits are deliberately excluded from
// streak-style mechanics, see migration 063's own note on habit_logs).
// Null when there's no log yet at all, since "no data yet" and "logged
// today" are different states and shouldn't render the same way.
export function daysSinceLastLog(logs: HabitLog[], habitId: string, today: string): number | null {
  const habitLogDates = logs.filter((l) => l.habitId === habitId).map((l) => l.date)
  if (habitLogDates.length === 0) return null
  const mostRecent = habitLogDates.reduce((latest, date) => (date > latest ? date : latest))
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((new Date(today).getTime() - new Date(mostRecent).getTime()) / msPerDay)
}
