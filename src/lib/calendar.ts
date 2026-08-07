// Time-block calendar - see migration 062_add_calendar_time_blocks.sql
// for the schema and design rationale. Every item shown (manual entries,
// gym schedule slots, Races training sessions) renders as a real,
// positioned/sized time-block when it has a time, and as an all-day
// banner item when it doesn't - never a fabricated time.

import { getLocalWeekdayIndex } from '@/lib/date'
import { computeSlotForWeekday, slotDisplayName, type ScheduleSlot } from '@/lib/gym-schedule'
import type { ActionItem } from '@/lib/goals'
import type { WeekSlots } from '@/lib/race-plan/day-template'
import { habitAppliesToDate, isHabitLoggedOnDate, type Habit, type HabitLog } from '@/lib/habits'

export interface CalendarEntry {
  id: string
  title: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD, always >= startDate (= startDate for a single-day entry)
  startTime: string | null // HH:MM:SS, null = all-day/untimed
  endTime: string | null // HH:MM:SS, paired with startTime - both set or both null
  note: string | null
  // The smallest possible recurrence model: a single row, expanded at
  // READ time (see entryAppliesToDate below), never materialized into
  // multiple rows and never editable per-occurrence. null = a normal
  // one-off entry. When set, startDate is the date recurrence BEGINS
  // (not "the one day"), and recurrenceEndDate (if set) is when it stops.
  recurrenceWeekdays: number[] | null // 0=Mon..6=Sun
  recurrenceEndDate: string | null
}

export function entryOverlapsDate(entry: CalendarEntry, date: string): boolean {
  return entry.startDate <= date && date <= entry.endDate
}

// The membership test for "does this entry show up on this date" -
// handles both the plain overlap case and the recurring case. Pure
// boolean, no synthesized per-occurrence object: a single day can only
// ever contain at most one instance of a given recurring entry, so
// there's nothing to construct beyond "yes/no."
export function entryAppliesToDate(entry: CalendarEntry, date: string): boolean {
  if (entry.recurrenceWeekdays && entry.recurrenceWeekdays.length > 0) {
    const weekday = getLocalWeekdayIndex(new Date(date + 'T00:00:00'))
    if (!entry.recurrenceWeekdays.includes(weekday)) return false
    if (date < entry.startDate) return false
    if (entry.recurrenceEndDate && date > entry.recurrenceEndDate) return false
    return true
  }
  return entryOverlapsDate(entry, date)
}

// Soonest start first. Same-day entries with a time sort ahead of
// untimed (all-day) ones - a time is more specific, actionable
// information than "sometime today."
export function sortUpcomingEntries(entries: CalendarEntry[]): CalendarEntry[] {
  return [...entries].sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1
    if (a.startTime && b.startTime) return a.startTime < b.startTime ? -1 : 1
    if (a.startTime) return -1
    if (b.startTime) return 1
    return 0
  })
}

export function timeStringToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ─── Per-day timed-item aggregation ─────────────────────────────────────
// Pure, read-only aggregation of data already computed elsewhere - no new
// business logic. Callers (the /calendar page) fetch each source with
// its own already-established query/function, then hand the raw results
// here for exactly one displayed date.

export type TimedItemSource = 'entry' | 'gym' | 'races' | 'race_day' | 'goal' | 'habit'

export interface TimedItem {
  id: string
  source: TimedItemSource
  title: string
  startMinutes: number | null // null = all-day/untimed
  endMinutes: number | null
  href?: string // 'goal' source only
  entry?: CalendarEntry // 'entry' source only - for edit/delete
  habit?: Habit // 'habit' source only - clicking toggles today's log directly
  habitDoneToday?: boolean // 'habit' source only
}

// Shared rendering constants - both the day view and the week view
// (components/calendar/week-view.tsx) style/size blocks identically, so
// these live here once rather than being defined (and risking drifting)
// in each renderer separately.

export const PIXELS_PER_MINUTE = 1 // 60px per hour
// Tall enough for a block's own two lines (title + time range) without
// clipping - 28px only fit ~20px of content after padding, cutting off
// the time line on any block 28 minutes or shorter.
export const MIN_BLOCK_HEIGHT = 36
export const DAY_HEIGHT = 24 * 60 * PIXELS_PER_MINUTE

// Categorical, not semantic - each source keeps a fixed, distinct hue
// from the Lapis palette so they stay visually distinguishable, reusing
// (not inventing) the existing accent/citrine/jade tokens: gym was
// already blue, so it keeps the primary lapis accent; races keeps its
// warm distinction via citrine; habits keep their green via jade.
export const SOURCE_STYLE: Record<TimedItemSource, string> = {
  entry: 'bg-lapis-surface-2 border-lapis-border-strong text-lapis-text-primary',
  gym: 'bg-lapis-accent-500/10 border-lapis-accent-400/30 text-lapis-accent-400',
  races: 'bg-lapis-citrine/10 border-lapis-citrine/30 text-lapis-citrine',
  race_day: 'bg-lapis-surface-2 border-lapis-border-strong text-lapis-text-primary',
  goal: 'bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-secondary',
  habit: 'bg-lapis-jade/10 border-lapis-jade/30 text-lapis-jade',
}
// Brighter variant once a habit is logged for the displayed day - the
// only source with a done/not-done state, so it's the only one that
// needs a second style.
export const HABIT_DONE_STYLE = 'bg-lapis-jade/40 border-lapis-jade/70 text-lapis-text-primary'

// Terse per-discipline tags, matching the style ZONE_GUIDANCE's own
// "everything else is just easy/technique volume" framing already uses -
// only the roles worth calling out get a suffix.
const RACE_DISCIPLINE_LABEL: Record<string, string> = { swim: 'Swim', bike: 'Bike', run: 'Run', cardio: 'Cardio' }
const RACE_ROLE_SUFFIX: Record<string, string> = { key: ' (Key)', threshold: ' (Threshold)', vo2max: ' (VO2max)' }

// Gym/Races slots only ever carry a single usual-time (a start), never a
// separate duration - unlike calendar_entries, which has a real,
// user-set end_time. These fixed durations are a reasonable DISPLAY
// estimate for sizing the block, not a claim about real session length -
// flagged here explicitly rather than silently assumed.
const DEFAULT_GYM_BLOCK_MINUTES = 60
const DEFAULT_RACES_BLOCK_MINUTES = 75
// Habits are quick, not session-length - a much smaller display estimate
// than a workout/race block, same "estimate for sizing, not a claim"
// caveat as the constants above.
const DEFAULT_HABIT_BLOCK_MINUTES = 15

export function buildTimedItemsForDate(params: {
  date: string
  calendarEntries: CalendarEntry[]
  goalItems: ActionItem[]
  activeRace: { raceDate: string; raceTypeLabel: string } | null
  scheduleMode: 'rotation' | 'calendar'
  scheduleSlots: ScheduleSlot[]
  raceWeekSlots: WeekSlots | null
  habits: Habit[]
  habitLogs: HabitLog[]
}): TimedItem[] {
  const { date, calendarEntries, goalItems, activeRace, scheduleMode, scheduleSlots, raceWeekSlots, habits, habitLogs } = params
  const items: TimedItem[] = []

  for (const habit of habits) {
    if (!habitAppliesToDate(habit, date)) continue
    const startMinutes = habit.usualTime ? timeStringToMinutes(habit.usualTime) : null
    items.push({
      id: `habit-${habit.id}`,
      source: 'habit',
      title: habit.name,
      startMinutes,
      endMinutes: startMinutes != null ? startMinutes + DEFAULT_HABIT_BLOCK_MINUTES : null,
      habit,
      habitDoneToday: isHabitLoggedOnDate(habitLogs, habit.id, date),
    })
  }

  if (activeRace && activeRace.raceDate === date) {
    items.push({ id: 'race-day', source: 'race_day', title: `${activeRace.raceTypeLabel} race day`, startMinutes: null, endMinutes: null })
  }

  for (const item of goalItems) {
    if (item.targetDate === date) {
      items.push({ id: `goal-${item.id}`, source: 'goal', title: item.title, startMinutes: null, endMinutes: null, href: item.editHref })
    }
  }

  for (const entry of calendarEntries) {
    if (!entryAppliesToDate(entry, date)) continue
    const isRecurringOccurrence = entry.recurrenceWeekdays != null && entry.recurrenceWeekdays.length > 0
    // A multi-day (non-recurring) entry only renders as a real timed
    // block on its actual start_date - every other day it spans shows
    // as an all-day "still ongoing" item, since the time only really
    // means something on the day it begins. Recurring occurrences are
    // never a multi-day span, so they're always eligible to be timed.
    const showAsTimed = entry.startTime != null && entry.endTime != null && (isRecurringOccurrence || entry.startDate === date)
    items.push({
      id: `entry-${entry.id}`,
      source: 'entry',
      title: entry.title,
      startMinutes: showAsTimed ? timeStringToMinutes(entry.startTime!) : null,
      endMinutes: showAsTimed ? timeStringToMinutes(entry.endTime!) : null,
      entry,
    })
  }

  // Gym slots only mean anything calendar-true in schedule_mode
  // 'calendar' - 'rotation' mode is deliberately not calendar-locked
  // (see workout_schedule_slots' own design comment), so there is no
  // real fact about what's scheduled on a future weekday to show.
  if (scheduleMode === 'calendar') {
    const weekdayIndex = getLocalWeekdayIndex(new Date(date + 'T00:00:00'))
    const slot = computeSlotForWeekday(scheduleSlots, weekdayIndex)
    if (slot) {
      const startMinutes = slot.usualTime ? timeStringToMinutes(slot.usualTime) : null
      items.push({
        id: `gym-${slot.id}`,
        source: 'gym',
        title: slotDisplayName(slot),
        startMinutes,
        endMinutes: startMinutes != null ? startMinutes + DEFAULT_GYM_BLOCK_MINUTES : null,
      })
    }
  }

  if (raceWeekSlots) {
    const weekdayIndex = getLocalWeekdayIndex(new Date(date + 'T00:00:00'))
    const isBrickDay = raceWeekSlots.brickDays.includes(weekdayIndex)

    for (const slot of raceWeekSlots.enduranceSlots) {
      if (slot.day !== weekdayIndex) continue
      const label = `${RACE_DISCIPLINE_LABEL[slot.type] ?? slot.type}${RACE_ROLE_SUFFIX[slot.role] ?? ''}${isBrickDay ? ' · Brick' : ''}`
      const startMinutes = slot.time ? timeStringToMinutes(slot.time) : null
      items.push({
        id: `races-${slot.type}-${weekdayIndex}`,
        source: 'races',
        title: label,
        startMinutes,
        endMinutes: startMinutes != null ? startMinutes + DEFAULT_RACES_BLOCK_MINUTES : null,
      })
    }

    for (const slot of raceWeekSlots.strengthSlots) {
      if (slot.day !== weekdayIndex) continue
      const startMinutes = slot.time ? timeStringToMinutes(slot.time) : null
      items.push({
        id: `races-strength-${weekdayIndex}`,
        source: 'races',
        title: 'Strength',
        startMinutes,
        endMinutes: startMinutes != null ? startMinutes + DEFAULT_RACES_BLOCK_MINUTES : null,
      })
    }
  }

  return items
}

// ─── Overlap layout ──────────────────────────────────────────────────────
// The standard calendar-app approach: cluster transitively-overlapping
// items, then greedily assign each a column within its cluster so
// overlapping items render side-by-side instead of stacked on top of
// each other. Only ever called with items that already have both
// startMinutes/endMinutes set - all-day items are a separate rendering
// concern (the banner row), never passed through here.

// Overrides startMinutes/endMinutes to non-nullable - every PositionedItem
// came from the already-filtered TimedOnly set below, so callers never
// need a null-check on them the way a plain TimedItem would require.
export interface PositionedItem extends Omit<TimedItem, 'startMinutes' | 'endMinutes'> {
  startMinutes: number
  endMinutes: number
  column: number
  columnsInCluster: number
}

type TimedOnly = TimedItem & { startMinutes: number; endMinutes: number }

// Connected-component clustering via a running "cluster end" watermark:
// as long as the next item (in start-time order) starts before the
// cluster's max end-time so far, it joins the same cluster - this
// correctly chains A-overlaps-B-overlaps-C even when A and C don't
// directly overlap each other. Extracted out of layoutTimedItems so the
// week view can reuse the exact same grouping (e.g. to decide which
// overlapping items fold into a "+N" chip at narrower column widths)
// without re-deriving it - layoutTimedItems's own behavior is unchanged,
// this is a pure extraction.
export function clusterOverlappingTimedItems<T extends { startMinutes: number; endMinutes: number }>(items: T[]): T[][] {
  const sorted = [...items].sort((a, b) => a.startMinutes - b.startMinutes)
  const clusters: T[][] = []
  let currentCluster: T[] = []
  let clusterEnd = -Infinity

  for (const item of sorted) {
    if (currentCluster.length > 0 && item.startMinutes >= clusterEnd) {
      clusters.push(currentCluster)
      currentCluster = []
      clusterEnd = -Infinity
    }
    currentCluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.endMinutes)
  }
  if (currentCluster.length > 0) clusters.push(currentCluster)
  return clusters
}

export function layoutTimedItems(items: TimedItem[]): PositionedItem[] {
  const timed = items.filter((i): i is TimedOnly => i.startMinutes != null && i.endMinutes != null)
  const clusters = clusterOverlappingTimedItems(timed)

  const positioned: PositionedItem[] = []
  for (const cluster of clusters) {
    // Greedy column assignment: place each item (in start-time order) in
    // the leftmost column whose last-placed item already ended by this
    // item's start time; open a new column only when none qualifies.
    const columnEnds: number[] = []
    const columnOf = new Map<TimedOnly, number>()

    for (const item of cluster) {
      let placedColumn = -1
      for (let c = 0; c < columnEnds.length; c++) {
        if (columnEnds[c] <= item.startMinutes) {
          placedColumn = c
          break
        }
      }
      if (placedColumn === -1) {
        placedColumn = columnEnds.length
        columnEnds.push(item.endMinutes)
      } else {
        columnEnds[placedColumn] = item.endMinutes
      }
      columnOf.set(item, placedColumn)
    }

    const columnsInCluster = columnEnds.length
    for (const item of cluster) {
      positioned.push({ ...item, column: columnOf.get(item)!, columnsInCluster })
    }
  }

  return positioned
}
