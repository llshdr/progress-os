import { getLocalWeekdayIndex, getLocalWeekStart, getLocalDateString } from '@/lib/date'

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

// Walks backward from `today` the same way computeHabitStreak does,
// returning the set of missed-but-forgiven dates - at most one per
// Monday-start week (getLocalWeekStart), and only ever a date the habit
// actually applies to (a day it doesn't apply to was never a miss to
// begin with). Shared by computeHabitStreak (to know which misses not to
// break the streak on) and buildHabitHeatmapWeeks (to mark the exact
// same days as "grace" cells) - one shared computation rather than two
// independently-written rules that could quietly disagree about which
// day was forgiven.
function computeGraceDates(logs: HabitLog[], habit: Habit, today: string): Set<string> {
  const habitLogDates = new Set(logs.filter((l) => l.habitId === habit.id).map((l) => l.date))
  const grace = new Set<string>()
  if (habitLogDates.size === 0) return grace

  const earliest = Array.from(habitLogDates).reduce((min, d) => (d < min ? d : min))
  const cursor = new Date(today + 'T00:00:00')
  const earliestDate = new Date(earliest + 'T00:00:00')
  const graceUsedByWeek = new Set<string>()

  while (cursor >= earliestDate) {
    const dateStr = getLocalDateString(cursor)
    if (habitAppliesToDate(habit, dateStr) && !habitLogDates.has(dateStr)) {
      const weekKey = getLocalDateString(getLocalWeekStart(cursor))
      if (!graceUsedByWeek.has(weekKey)) {
        graceUsedByWeek.add(weekKey)
        grace.add(dateStr)
      }
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return grace
}

// A later, explicitly-opted-into reversal of daysSinceLastLog's own
// "no streak mechanics" precedent - the owner asked for a real
// consistency view. Framed as a personal-best number, never a
// guilt/warning mechanic: no color, no "you broke it" language anywhere
// this is rendered.
//
// Walks backward day by day from `today`. Days the habit doesn't apply
// to (per habitAppliesToDate) are skipped entirely - they neither extend
// nor break the streak, so a habit scheduled Mon/Wed/Fri counts
// consecutive SCHEDULED occurrences, not consecutive calendar days.
//
// One missed scheduled day per week is forgiven (computeGraceDates) - a
// common, well-liked streak-protection mechanic: it doesn't extend the
// streak count (nothing was actually logged that day), but it also
// doesn't reset it. A second miss in the same week still breaks it -
// grace is capped at one, not unlimited.
export function computeHabitStreak(
  logs: HabitLog[],
  habit: Habit,
  today: string
): { current: number; longest: number } {
  const habitLogDates = new Set(logs.filter((l) => l.habitId === habit.id).map((l) => l.date))
  if (habitLogDates.size === 0) return { current: 0, longest: 0 }

  const graceDates = computeGraceDates(logs, habit, today)
  const earliest = Array.from(habitLogDates).reduce((min, d) => (d < min ? d : min))
  const cursor = new Date(today + 'T00:00:00')
  const earliestDate = new Date(earliest + 'T00:00:00')

  let current = 0
  let longest = 0
  let running = 0
  let stillCounting = true

  while (cursor >= earliestDate) {
    const dateStr = getLocalDateString(cursor)
    if (habitAppliesToDate(habit, dateStr)) {
      if (habitLogDates.has(dateStr)) {
        running += 1
        if (stillCounting) current = running
      } else if (graceDates.has(dateStr)) {
        // Forgiven - the streak passes through this day unbroken.
      } else {
        longest = Math.max(longest, running)
        running = 0
        stillCounting = false // the walk-back-from-today streak just ended
      }
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  longest = Math.max(longest, running)

  return { current, longest }
}

export interface HabitHeatmapCell {
  date: string
  applicable: boolean
  logged: boolean
  // Same dates computeHabitStreak treats as forgiven (computeGraceDates) -
  // lets the grid show WHY a gap didn't break the streak number next to
  // it, instead of the two looking like they disagree.
  grace: boolean
}

// weeksBack rows (oldest first), 7 columns (Mon-Sun) each - the same
// grid shape as any other week-bucketed view in this app
// (getLocalWeekStart already the single shared "week start" definition).
// Pure display data; the card decides how to color each cell.
export function buildHabitHeatmapWeeks(logs: HabitLog[], habit: Habit, today: string, weeksBack = 8): HabitHeatmapCell[][] {
  const habitLogDates = new Set(logs.filter((l) => l.habitId === habit.id).map((l) => l.date))
  const graceDates = computeGraceDates(logs, habit, today)
  const currentWeekStart = getLocalWeekStart(new Date(today + 'T00:00:00'))

  const weeks: HabitHeatmapCell[][] = []
  for (let w = weeksBack - 1; w >= 0; w--) {
    const weekStart = new Date(currentWeekStart)
    weekStart.setDate(weekStart.getDate() - w * 7)

    const row: HabitHeatmapCell[] = []
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(weekStart)
      cellDate.setDate(cellDate.getDate() + d)
      const dateStr = getLocalDateString(cellDate)
      row.push({
        date: dateStr,
        applicable: dateStr <= today && habitAppliesToDate(habit, dateStr),
        logged: habitLogDates.has(dateStr),
        grace: graceDates.has(dateStr),
      })
    }
    weeks.push(row)
  }
  return weeks
}
