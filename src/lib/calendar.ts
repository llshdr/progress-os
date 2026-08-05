// First layer of a future Calendar/Schedule module - see migration
// 061_add_calendar_entries.sql for the schema and design rationale.
// Deliberately just events/commitments for now: no recurrence, no
// non-negotiable/type distinction, no link to Races' training_disruptions
// yet - all left as ordinary additive changes for whenever that layer
// actually gets built, not reserved here.

import { formatRelativeDateLabel } from '@/lib/date'

export interface CalendarEntry {
  id: string
  title: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD, always >= startDate (= startDate for a single-day entry)
  startTime: string | null // HH:MM:SS, null = all-day/untimed
  note: string | null
}

// Soonest start first. Same-day entries with a time sort ahead of
// untimed (all-day) ones on that day - a time is more specific,
// actionable information than "sometime today."
export function sortUpcomingEntries(entries: CalendarEntry[]): CalendarEntry[] {
  return [...entries].sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1
    if (a.startTime && b.startTime) return a.startTime < b.startTime ? -1 : 1
    if (a.startTime) return -1
    if (b.startTime) return 1
    return 0
  })
}

// A short, human date/time label for one entry - "Today", "Today at
// 14:00", "Jan 5 – Jan 8". Reuses formatRelativeDateLabel for the actual
// date labeling rather than a second date-formatting scheme.
export function formatEntryWhen(entry: CalendarEntry): string {
  const startLabel = formatRelativeDateLabel(entry.startDate)
  const timeLabel = entry.startTime ? ` at ${entry.startTime.slice(0, 5)}` : ''
  if (entry.endDate === entry.startDate) return `${startLabel}${timeLabel}`
  return `${startLabel} – ${formatRelativeDateLabel(entry.endDate)}${timeLabel}`
}
