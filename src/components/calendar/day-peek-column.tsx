'use client'

import { useMemo } from 'react'
import {
  buildTimedItemsForDate,
  SOURCE_DOT_COLOR,
  type CalendarEntry,
} from '@/lib/calendar'
import type { ScheduleSlot } from '@/lib/gym-schedule'
import type { ActionItem } from '@/lib/goals'
import type { WeekSlots } from '@/lib/race-plan/day-template'
import type { Habit, HabitLog } from '@/lib/habits'

interface DayPeekColumnProps {
  date: string
  today: string
  calendarEntries: CalendarEntry[]
  goalItems: ActionItem[]
  activeRace: { raceDate: string; raceTypeLabel: string } | null
  scheduleMode: 'rotation' | 'calendar'
  scheduleSlots: ScheduleSlot[]
  raceWeekSlots: WeekSlots | null
  habits: Habit[]
  habitLogs: HabitLog[]
  onSelect: (date: string) => void
}

// A thin, read-only "what does this day look like" strip flanking the
// real (fully interactive) day view on mobile - see calendar/page.tsx
// for why the interactive column itself isn't rebuilt here. Genuinely
// minimal on purpose: no titles, no text at all, just a compressed
// column of dots colored by source at each timed item's rough position
// in the day, plus a small marker if there's anything untimed. A peek
// column's only job is "does tomorrow look busy or empty" at a glance -
// counting or reading precisely is what tapping through to day view is
// for, so there's no overlap-column/"+N" handling here the way the
// desktop week grid needs; a few dots close together is still legible
// at this size without it.
//
// raceWeekSlots is passed down as computed by the parent for the
// CENTER day's training week. If a peek date happens to fall in a
// different week (only possible right at a Sun/Mon boundary), a
// races-sourced dot here could reflect the wrong week's plan. Accepted
// as a known, narrow limitation for a non-authoritative glance column,
// not worth the complexity of computing a second week's slots for one
// boundary day.
export default function DayPeekColumn({
  date,
  today,
  calendarEntries,
  goalItems,
  activeRace,
  scheduleMode,
  scheduleSlots,
  raceWeekSlots,
  habits,
  habitLogs,
  onSelect,
}: DayPeekColumnProps) {
  const items = useMemo(
    () =>
      buildTimedItemsForDate({
        date,
        calendarEntries,
        goalItems,
        activeRace,
        scheduleMode,
        scheduleSlots,
        raceWeekSlots,
        habits,
        habitLogs,
      }),
    [date, calendarEntries, goalItems, activeRace, scheduleMode, scheduleSlots, raceWeekSlots, habits, habitLogs]
  )

  const timed = items.filter((i) => i.startMinutes != null)
  const hasAllDay = items.some((i) => i.startMinutes == null)
  const isToday = date === today
  const dayNumber = new Date(date + 'T00:00:00').getDate()

  return (
    <button
      onClick={() => onSelect(date)}
      className={`w-9 shrink-0 flex flex-col items-center rounded-lapis-sm border transition-colors ${
        isToday ? 'border-lapis-accent-500/40 bg-lapis-accent-500/[0.06]' : 'border-lapis-border-subtle bg-lapis-surface-1/50 hover:bg-lapis-surface-2'
      }`}
    >
      <span className={`font-data text-xs pt-1.5 pb-1 ${isToday ? 'text-lapis-accent-400 font-medium' : 'text-lapis-text-tertiary'}`}>{dayNumber}</span>
      {hasAllDay && <span className="w-1 h-1 rounded-full bg-lapis-text-tertiary mb-1" />}
      <div className="relative w-full flex-1 min-h-[200px]" style={{ height: '65vh' }}>
        {timed.map((item) => (
          <span
            key={item.id}
            className={`absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${SOURCE_DOT_COLOR[item.source]}`}
            style={{ top: `${((item.startMinutes! / 1440) * 100).toFixed(2)}%` }}
          />
        ))}
      </div>
    </button>
  )
}
