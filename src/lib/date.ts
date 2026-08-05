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

// "Today"/"Tomorrow"/short date - the same relative-date labeling
// dashboard-client.tsx's own local formatDate already does, extracted
// here as the canonical version so new code (the calendar module) has
// one to import rather than writing a third local copy. Parses
// dateString as local midnight (not UTC) - the same discipline as every
// other helper in this file.
export function formatRelativeDateLabel(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.getTime() === today.getTime()) return 'Today'
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
