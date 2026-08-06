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
