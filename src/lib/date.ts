// Local-timezone-safe date-key helpers. Never use `date.toISOString().split('T')[0]`
// for "today"/date-key logic — it converts to UTC first, which can silently
// shift a workout logged in the evening onto the wrong calendar day for
// anyone west of UTC. These use the local calendar date components instead.

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// The Monday that starts the ISO-style calendar week containing `date` -
// the single shared definition of "week start" for every calendar-week
// boundary in the app (weekly workout counts/goals, streaks). Rolling
// windows (7-day moving averages for weight/nutrition trends, muscle-
// volume analysis) are unrelated - they measure "the last N days," not a
// fixed calendar-week boundary, so there's nothing to change for those.
export function getLocalWeekStart(date: Date = new Date()): Date {
  const start = new Date(date)
  const day = start.getDay()
  const diff = start.getDate() - day + (day === 0 ? -6 : 1)
  start.setDate(diff)
  start.setHours(0, 0, 0, 0)
  return start
}

export function getLocalWeekStartString(date: Date = new Date()): string {
  return getLocalDateString(getLocalWeekStart(date))
}

// Monday-indexed weekday (0=Monday...6=Sunday) - matches getLocalWeekStart()'s
// own Monday-start convention, single source of truth for both.
export function getLocalWeekdayIndex(date: Date = new Date()): number {
  return (date.getDay() + 6) % 7
}
