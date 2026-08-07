'use client'

import { useMemo } from 'react'
import {
  buildTimedItemsForDate,
  layoutTimedItems,
  clusterOverlappingTimedItems,
  minutesToTimeString,
  PIXELS_PER_MINUTE,
  MIN_BLOCK_HEIGHT,
  DAY_HEIGHT,
  SOURCE_STYLE,
  HABIT_DONE_STYLE,
  timeStringToMinutes,
  type CalendarEntry,
  type TimedItem,
  type PositionedItem,
} from '@/lib/calendar'
import { getLocalDateString } from '@/lib/date'
import type { ScheduleSlot } from '@/lib/gym-schedule'
import type { ActionItem } from '@/lib/goals'
import type { WeekSlots } from '@/lib/race-plan/day-template'
import type { Habit, HabitLog } from '@/lib/habits'

interface WeekViewProps {
  weekStart: string // Monday, YYYY-MM-DD
  today: string
  calendarEntries: CalendarEntry[]
  goalItems: ActionItem[]
  activeRace: { raceDate: string; raceTypeLabel: string } | null
  scheduleMode: 'rotation' | 'calendar'
  scheduleSlots: ScheduleSlot[]
  raceWeekSlots: WeekSlots | null
  habits: Habit[]
  habitLogs: HabitLog[]
  wakeTime: string
  sleepTime: string
  onSelectDate: (date: string) => void
}

// At most this many side-by-side columns before folding the rest into a
// "+N" chip - a day view column has the full page width to work with,
// a week column doesn't, and letting layoutTimedItems' own column count
// shrink blocks indefinitely (like the day view briefly did on mobile)
// just produces unreadable slivers. No existing "+N" pattern to reuse
// here - checked, this app doesn't have one elsewhere - but it's the
// standard, well-understood way every mainstream calendar app handles
// this exact problem.
const MAX_VISIBLE_COLUMNS = 3

function shiftDate(date: string, deltaDays: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + deltaDays)
  return getLocalDateString(d)
}

function formatDayHeader(date: string): { weekday: string; day: number } {
  const d = new Date(date + 'T00:00:00')
  return { weekday: d.toLocaleDateString('en-US', { weekday: 'short' }), day: d.getDate() }
}

interface OverflowChip {
  id: string
  top: number
  count: number
}

function layoutDayColumn(items: TimedItem[]): { visible: PositionedItem[]; overflow: OverflowChip[] } {
  const positioned = layoutTimedItems(items)
  const visible: PositionedItem[] = []
  const hidden: PositionedItem[] = []

  for (const item of positioned) {
    const cap = Math.min(item.columnsInCluster, MAX_VISIBLE_COLUMNS)
    const effectiveCap = item.columnsInCluster > MAX_VISIBLE_COLUMNS ? MAX_VISIBLE_COLUMNS - 1 : cap
    if (item.column < effectiveCap) {
      visible.push({ ...item, columnsInCluster: cap })
    } else {
      hidden.push(item)
    }
  }

  const overflow = clusterOverlappingTimedItems(hidden).map((cluster, i) => ({
    id: `overflow-${i}-${cluster[0].id}`,
    top: Math.min(...cluster.map((c) => c.startMinutes)) * PIXELS_PER_MINUTE,
    count: cluster.length,
  }))

  return { visible, overflow }
}

// Week-at-a-glance: a real 7-column hourly grid on tablet/desktop (md+),
// where each column reuses the exact same buildTimedItemsForDate/
// layoutTimedItems the day view already uses - and a condensed agenda
// list on phone widths, where a 7-column hourly grid genuinely doesn't
// work at any font size (confirmed by measurement, not assumed - a
// 375px phone leaves ~43px per day column before any overlap, less
// than any block can render text in). Deliberately read-only at a
// glance: tapping any day header, block, or overflow chip switches to
// day view for that date rather than duplicating the day view's edit/
// habit-toggle/gym-start interactions a second time here.
export default function WeekView({
  weekStart,
  today,
  calendarEntries,
  goalItems,
  activeRace,
  scheduleMode,
  scheduleSlots,
  raceWeekSlots,
  habits,
  habitLogs,
  wakeTime,
  sleepTime,
  onSelectDate,
}: WeekViewProps) {
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i)), [weekStart])

  const itemsByDate = useMemo(() => {
    const map = new Map<string, TimedItem[]>()
    for (const date of weekDates) {
      map.set(
        date,
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
        })
      )
    }
    return map
  }, [weekDates, calendarEntries, goalItems, activeRace, scheduleMode, scheduleSlots, raceWeekSlots, habits, habitLogs])

  const wakeMinutes = timeStringToMinutes(wakeTime)
  const sleepMinutes = timeStringToMinutes(sleepTime)
  const gridTemplate = '44px repeat(7, minmax(0, 1fr))'

  return (
    <>
      {/* Desktop/tablet - real hourly grid */}
      <div className="hidden md:block border border-lapis-border-subtle rounded-lapis-lg overflow-hidden">
        <div className="grid" style={{ gridTemplateColumns: gridTemplate }}>
          <div />
          {weekDates.map((date) => {
            const { weekday, day } = formatDayHeader(date)
            const isToday = date === today
            return (
              <button
                key={date}
                onClick={() => onSelectDate(date)}
                className={`flex flex-col items-center py-2 border-l border-lapis-border-subtle hover:bg-lapis-surface-2 transition-colors ${
                  isToday ? 'bg-lapis-accent-500/15' : ''
                }`}
              >
                <span className="text-[10px] text-lapis-text-tertiary uppercase tracking-wide">{weekday}</span>
                <span className={`font-data text-sm ${isToday ? 'text-lapis-accent-400 font-medium' : 'text-lapis-text-primary'}`}>{day}</span>
              </button>
            )
          })}
        </div>

        <div className="grid border-t border-lapis-border-subtle" style={{ gridTemplateColumns: gridTemplate }}>
          <div />
          {weekDates.map((date) => {
            const allDay = (itemsByDate.get(date) ?? []).filter((i) => i.startMinutes == null)
            return (
              <div key={date} className="border-l border-lapis-border-subtle p-1 min-h-[28px] space-y-0.5">
                {allDay.map((item) => (
                  <div
                    key={item.id}
                    className={`px-1.5 py-0.5 rounded-lapis-sm text-[9px] truncate border ${SOURCE_STYLE[item.source]}`}
                  >
                    {item.title}
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        <div className="relative overflow-y-auto" style={{ maxHeight: '60vh' }}>
          <div className="grid border-t border-lapis-border-subtle" style={{ gridTemplateColumns: gridTemplate, height: DAY_HEIGHT }}>
            <div className="relative">
              {Array.from({ length: 24 }, (_, hour) => (
                <span
                  key={hour}
                  className="absolute -top-2 left-1 text-lapis-text-disabled text-[10px] bg-lapis-bg px-0.5"
                  style={{ top: hour * 60 * PIXELS_PER_MINUTE }}
                >
                  {String(hour).padStart(2, '0')}
                </span>
              ))}
            </div>

            {weekDates.map((date) => {
              const { visible, overflow } = layoutDayColumn(itemsByDate.get(date) ?? [])
              return (
                <div key={date} className="relative border-l border-lapis-border-subtle">
                  <div
                    className="absolute left-0 right-0 top-0 bg-lapis-bg/30 pointer-events-none"
                    style={{ height: wakeMinutes * PIXELS_PER_MINUTE }}
                  />
                  <div
                    className="absolute left-0 right-0 bottom-0 bg-lapis-bg/30 pointer-events-none"
                    style={{ height: (24 * 60 - sleepMinutes) * PIXELS_PER_MINUTE }}
                  />
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div key={hour} className="absolute left-0 right-0 border-t border-lapis-border-subtle" style={{ top: hour * 60 * PIXELS_PER_MINUTE }} />
                  ))}

                  {visible.map((item) => {
                    const top = item.startMinutes * PIXELS_PER_MINUTE
                    const height = Math.max(MIN_BLOCK_HEIGHT, (item.endMinutes - item.startMinutes) * PIXELS_PER_MINUTE)
                    const widthPct = 100 / item.columnsInCluster
                    const leftPct = item.column * widthPct
                    const isHabitDone = item.source === 'habit' && item.habitDoneToday
                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelectDate(date)}
                        className={`absolute rounded-lapis-sm border px-1 py-0.5 overflow-hidden text-left hover:brightness-125 transition-all ${
                          isHabitDone ? HABIT_DONE_STYLE : SOURCE_STYLE[item.source]
                        }`}
                        style={{ top, height, left: `calc(${leftPct}% + 1px)`, width: `calc(${widthPct}% - 2px)` }}
                      >
                        <p className="text-[10px] font-medium truncate leading-tight">{item.title}</p>
                      </button>
                    )
                  })}

                  {overflow.map((chip) => (
                    <button
                      key={chip.id}
                      onClick={() => onSelectDate(date)}
                      className="absolute right-0.5 flex items-center justify-center rounded-lapis-sm bg-lapis-surface-3 border border-lapis-border text-lapis-text-secondary text-[9px] font-medium px-1 hover:bg-lapis-surface-2 transition-colors"
                      style={{ top: chip.top, height: 18 }}
                    >
                      +{chip.count}
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Phone - condensed agenda, no hourly grid at all: at this width
          a real grid has no room to render text in, so this is a
          genuinely different (simpler) view rather than a squeezed one. */}
      <div className="md:hidden space-y-3">
        {weekDates.map((date) => {
          const items = itemsByDate.get(date) ?? []
          const sorted = [...items].sort((a, b) => {
            if (a.startMinutes == null && b.startMinutes == null) return 0
            if (a.startMinutes == null) return 1
            if (b.startMinutes == null) return -1
            return a.startMinutes - b.startMinutes
          })
          const { weekday, day } = formatDayHeader(date)
          const isToday = date === today

          return (
            <button
              key={date}
              onClick={() => onSelectDate(date)}
              className={`w-full text-left border rounded-lapis-lg p-4 transition-colors ${
                isToday ? 'border-lapis-accent-500/40 bg-lapis-accent-500/[0.06]' : 'border-lapis-border-subtle bg-lapis-surface-1'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-sm font-medium ${isToday ? 'text-lapis-accent-400' : 'text-lapis-text-primary'}`}>
                  {weekday} {day}
                </span>
                {isToday && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-lapis-accent-500/15 text-lapis-accent-400">Today</span>}
              </div>
              {sorted.length === 0 ? (
                <p className="text-lapis-text-disabled text-sm">Nothing scheduled</p>
              ) : (
                <div className="space-y-1.5">
                  {sorted.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-sm">
                      <span className="font-data tabular-nums text-lapis-text-tertiary text-xs w-11 shrink-0">
                        {item.startMinutes != null ? minutesToTimeString(item.startMinutes) : 'All day'}
                      </span>
                      <span className="text-lapis-text-secondary truncate">{item.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </>
  )
}
