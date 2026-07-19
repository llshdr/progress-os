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

export function getLocalWeekStartString(date: Date = new Date()): string {
  const start = new Date(date)
  start.setDate(start.getDate() - start.getDay())
  return getLocalDateString(start)
}
