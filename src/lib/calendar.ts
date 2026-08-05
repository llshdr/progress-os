// First layer of a future Calendar/Schedule module - see migration
// 061_add_calendar_entries.sql for the schema and design rationale.
// Deliberately just events/commitments for now: no recurrence, no
// non-negotiable/type distinction, no link to Races' training_disruptions
// yet - all left as ordinary additive changes for whenever that layer
// actually gets built, not reserved here.

import { formatRelativeDateLabel, getLocalDateString } from '@/lib/date'
import { computeSlotForWeekday, slotDisplayName, type ScheduleSlot } from '@/lib/gym-schedule'
import type { ActionItem } from '@/lib/goals'
import type { WeekSlots } from '@/lib/race-plan/day-template'

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

// ─── Week grid aggregation ──────────────────────────────────────────────
// Pure, read-only aggregation of data already computed elsewhere - no new
// business logic. Callers (the /calendar page) fetch each source with its
// own already-established query/function, then hand the raw results here
// once per displayed week; this only groups/formats them per day.

export function entryOverlapsDate(entry: CalendarEntry, date: string): boolean {
  return entry.startDate <= date && date <= entry.endDate
}

// Terse per-discipline tags for a compact one-line summary - not the full
// zone/pace detail WeekDayList (Races) already shows elsewhere; this is a
// calendar-cell footprint, so only the roles worth calling out (key/
// threshold/vo2max) get a suffix, matching the "everything else is just
// easy/technique volume" framing ZONE_GUIDANCE itself already uses.
const RACE_DISCIPLINE_LABEL: Record<string, string> = { swim: 'Swim', bike: 'Bike', run: 'Run', cardio: 'Cardio' }
const RACE_ROLE_SUFFIX: Record<string, string> = { key: ' (Key)', threshold: ' (Threshold)', vo2max: ' (VO2max)' }

// One consolidated line for a day's Races training content (however many
// discipline slots land on it - e.g. a brick day has 2+), so this source
// never contributes more than one line to a day's item count/cap.
function summarizeRaceSessionsForDay(weekSlots: WeekSlots | null, weekdayIndex: number): string | null {
  if (!weekSlots) return null
  const parts: string[] = []
  for (const slot of weekSlots.enduranceSlots) {
    if (slot.day !== weekdayIndex) continue
    parts.push(`${RACE_DISCIPLINE_LABEL[slot.type] ?? slot.type}${RACE_ROLE_SUFFIX[slot.role] ?? ''}`)
  }
  if (weekSlots.strengthSlots.some((s) => s.day === weekdayIndex)) parts.push('Strength')
  if (weekSlots.brickDays.includes(weekdayIndex)) parts.push('Brick')
  return parts.length > 0 ? parts.join(', ') : null
}

export interface DayAggregate {
  date: string // YYYY-MM-DD
  weekdayIndex: number // 0=Monday...6=Sunday, matches gym-schedule.ts's own convention
  raceDayLabel: string | null
  goalItems: ActionItem[] // due today
  entries: CalendarEntry[] // manual entries overlapping today
  gymSlotLabel: string | null // only ever set in schedule_mode 'calendar' - see buildDayAggregates
  racesSummary: string | null
  itemCount: number // for a day-density indicator
}

// Assembles one week's worth of per-day content from already-fetched raw
// data - the caller does every real query/derivation (active race +
// its plan, schedule slots + mode, mesocycles, active goals, calendar
// entries) using the exact functions those features already ship with;
// this only groups the results by day and applies the display cap
// hierarchy's raw ingredients (callers still do the actual capping/
// rendering, since that's presentation, not aggregation).
export function buildDayAggregates(params: {
  weekStart: Date
  calendarEntries: CalendarEntry[]
  goalItems: ActionItem[]
  activeRace: { raceDate: string; raceTypeLabel: string } | null
  scheduleMode: 'rotation' | 'calendar'
  scheduleSlots: ScheduleSlot[]
  raceWeekSlots: WeekSlots | null
}): DayAggregate[] {
  const { weekStart, calendarEntries, goalItems, activeRace, scheduleMode, scheduleSlots, raceWeekSlots } = params

  const days: DayAggregate[] = []
  for (let weekdayIndex = 0; weekdayIndex < 7; weekdayIndex++) {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + weekdayIndex)
    const dateStr = getLocalDateString(date)

    const raceDayLabel = activeRace && activeRace.raceDate === dateStr ? `${activeRace.raceTypeLabel} race day` : null
    const goalItemsToday = goalItems.filter((item) => item.targetDate === dateStr)
    const entriesToday = sortUpcomingEntries(calendarEntries.filter((entry) => entryOverlapsDate(entry, dateStr)))

    // Gym slots only mean anything calendar-true in schedule_mode
    // 'calendar' - 'rotation' mode is deliberately not calendar-locked
    // (see workout_schedule_slots' own design comment), so there is no
    // real fact about what's scheduled on a future weekday to show.
    let gymSlotLabel: string | null = null
    if (scheduleMode === 'calendar') {
      const slot = computeSlotForWeekday(scheduleSlots, weekdayIndex)
      if (slot) gymSlotLabel = slotDisplayName(slot)
    }

    const racesSummary = summarizeRaceSessionsForDay(raceWeekSlots, weekdayIndex)

    const itemCount =
      (raceDayLabel ? 1 : 0) + goalItemsToday.length + entriesToday.length + (gymSlotLabel ? 1 : 0) + (racesSummary ? 1 : 0)

    days.push({
      date: dateStr,
      weekdayIndex,
      raceDayLabel,
      goalItems: goalItemsToday,
      entries: entriesToday,
      gymSlotLabel,
      racesSummary,
      itemCount,
    })
  }

  return days
}
