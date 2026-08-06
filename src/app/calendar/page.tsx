'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { CalendarDays, ArrowLeft, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { getLocalDateString, getLocalWeekStart } from '@/lib/date'
import {
  buildTimedItemsForDate,
  layoutTimedItems,
  timeStringToMinutes,
  minutesToTimeString,
  type CalendarEntry,
  type TimedItem,
  type TimedItemSource,
  type PositionedItem,
} from '@/lib/calendar'
import { fetchScheduleSlots, WEEKDAY_NAMES, type ScheduleSlot } from '@/lib/gym-schedule'
import { fetchActiveActionItems, type ActionItem } from '@/lib/goals'
import { selectActiveMesocycle, type Mesocycle, type CurrentMesocycleStatus } from '@/lib/mesocycle'
import { slotsForWeek, type PhaseTemplates } from '@/lib/race-plan/day-template'
import type { TrainingWeekSkeleton } from '@/lib/race-plan/periodization'
import { raceTypeLabel } from '@/lib/race-constants'
import { daysBetween } from '@/lib/goals'
import DisruptionDeclaration, { type TrainingDisruption } from '@/components/disruption-declaration'
import TravelPrepDialog from '@/components/calendar/travel-prep-dialog'
import HabitsCard from '@/components/calendar/habits-card'
import type { Habit, HabitLog } from '@/lib/habits'

// Every source below is fetched once per page load via the exact
// function/query each feature already ships with - this page only
// groups the results per displayed day (buildTimedItemsForDate,
// calendar.ts) and lays out overlapping blocks (layoutTimedItems). Not a
// new source of truth for any of it.

type ScheduleMode = 'rotation' | 'calendar'

const PIXELS_PER_MINUTE = 1 // 60px per hour
const MIN_BLOCK_HEIGHT = 28
const DAY_HEIGHT = 24 * 60 * PIXELS_PER_MINUTE

const SOURCE_STYLE: Record<TimedItemSource, string> = {
  entry: 'bg-white/10 border-white/25 text-white',
  gym: 'bg-blue-500/10 border-blue-400/30 text-blue-100',
  races: 'bg-orange-500/10 border-orange-400/30 text-orange-100',
  race_day: 'bg-white/10 border-white/25 text-white',
  goal: 'bg-white/5 border-white/10 text-white/70',
  habit: 'bg-emerald-500/10 border-emerald-400/30 text-emerald-100',
}
// Brighter variant once a habit is logged for the displayed day - the
// only source with a done/not-done state, so it's the only one that
// needs a second style.
const HABIT_DONE_STYLE = 'bg-emerald-500/40 border-emerald-400/70 text-white'

function shiftDay(date: string, deltaDays: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + deltaDays)
  return getLocalDateString(d)
}

function formatDayHeading(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export default function CalendarPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(getLocalDateString())

  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('rotation')
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([])
  const [activeRace, setActiveRace] = useState<{ raceDate: string; raceTypeLabel: string } | null>(null)
  const [racePlan, setRacePlan] = useState<{ weeks: TrainingWeekSkeleton[]; phaseTemplates: PhaseTemplates } | null>(null)
  const [mesocycles, setMesocycles] = useState<Mesocycle[]>([])
  const [goalItems, setGoalItems] = useState<ActionItem[]>([])
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([])
  const [disruptions, setDisruptions] = useState<TrainingDisruption[]>([])
  const [habits, setHabits] = useState<Habit[]>([])
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([])
  const [wakeTime, setWakeTime] = useState('06:00:00')
  const [sleepTime, setSleepTime] = useState('23:00:00')
  const [travelPrepEntryId, setTravelPrepEntryId] = useState<string | null>(null)
  const [welcomeBackDismissed, setWelcomeBackDismissed] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(getLocalDateString())
  const [isMultiDay, setIsMultiDay] = useState(false)
  const [endDate, setEndDate] = useState(getLocalDateString())
  const [hasTime, setHasTime] = useState(false)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([])
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const [entryToDelete, setEntryToDelete] = useState<string | null>(null)

  const axisRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchAll()
  }, [])

  // Re-scroll to the wake-time position whenever the displayed day
  // changes (or once loading finishes) - a fresh day view should always
  // open at the same sensible default, not wherever the user happened
  // to scroll to on the previous day.
  useEffect(() => {
    if (!axisRef.current) return
    const wakeMinutes = timeStringToMinutes(wakeTime)
    axisRef.current.scrollTop = Math.max(0, (wakeMinutes - 30) * PIXELS_PER_MINUTE)
  }, [date, loading, wakeTime])

  const fetchAll = async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    setUserId(user.id)

    const today = getLocalDateString()

    const [
      settingsResult,
      slots,
      raceResult,
      mesoResult,
      activeGoalItems,
      entriesResult,
      disruptionsResult,
      habitsResult,
      habitLogsResult,
    ] = await Promise.all([
      supabase.from('user_settings').select('schedule_mode, wake_time, sleep_time').eq('user_id', user.id).maybeSingle(),
      fetchScheduleSlots(supabase, user.id),
      supabase
        .from('races')
        .select('id, race_type, race_date')
        .eq('user_id', user.id)
        .gte('race_date', today)
        .order('race_date', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase.from('training_mesocycles').select('id, start_date, length_weeks, deload_week_number, label').eq('user_id', user.id),
      fetchActiveActionItems(supabase, user.id),
      supabase
        .from('calendar_entries')
        .select('id, title, start_date, end_date, start_time, end_time, note, recurrence_weekdays, recurrence_end_date')
        .eq('user_id', user.id),
      // User-level, not race-specific - shared across every race the
      // athlete is training for. See migration 057.
      supabase
        .from('training_disruptions')
        .select('id, start_date, end_date, reason, note')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false }),
      supabase.from('habits').select('id, name, recurrence_weekdays, usual_time').eq('user_id', user.id),
      // No date window - a personal habit log stays small for years (see
      // migration 063's own reasoning), same "fetch it all, filter
      // per-day client-side" treatment calendarEntries already gets.
      supabase.from('habit_logs').select('id, habit_id, date').eq('user_id', user.id),
    ])

    setScheduleMode(settingsResult.data?.schedule_mode === 'calendar' ? 'calendar' : 'rotation')
    if (settingsResult.data?.wake_time) setWakeTime(settingsResult.data.wake_time)
    if (settingsResult.data?.sleep_time) setSleepTime(settingsResult.data.sleep_time)
    setScheduleSlots(slots)

    const raceRow = raceResult.data
    if (raceRow) {
      setActiveRace({ raceDate: raceRow.race_date, raceTypeLabel: raceTypeLabel(raceRow.race_type) })
      const { data: planRow } = await supabase
        .from('race_training_plans')
        .select('weeks, phase_templates')
        .eq('race_id', raceRow.id)
        .maybeSingle()
      setRacePlan(planRow ? { weeks: planRow.weeks, phaseTemplates: planRow.phase_templates ?? {} } : null)
    } else {
      setActiveRace(null)
      setRacePlan(null)
    }

    setMesocycles(
      (mesoResult.data ?? []).map((r) => ({
        id: r.id,
        startDate: r.start_date,
        lengthWeeks: r.length_weeks,
        deloadWeekNumber: r.deload_week_number,
        label: r.label,
      }))
    )
    setGoalItems(activeGoalItems)
    setCalendarEntries(
      (entriesResult.data ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        startDate: r.start_date,
        endDate: r.end_date,
        startTime: r.start_time,
        endTime: r.end_time,
        note: r.note,
        recurrenceWeekdays: r.recurrence_weekdays,
        recurrenceEndDate: r.recurrence_end_date,
      }))
    )
    setDisruptions(disruptionsResult.data ?? [])
    setHabits(
      (habitsResult.data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        recurrenceWeekdays: r.recurrence_weekdays,
        usualTime: r.usual_time,
      }))
    )
    setHabitLogs((habitLogsResult.data ?? []).map((r: any) => ({ id: r.id, habitId: r.habit_id, date: r.date })))

    setLoading(false)
  }

  const refetchDisruptions = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('training_disruptions')
      .select('id, start_date, end_date, reason, note')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false })
    setDisruptions(data ?? [])
  }

  const refetchHabits = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const [habitsRes, logsRes] = await Promise.all([
      supabase.from('habits').select('id, name, recurrence_weekdays, usual_time').eq('user_id', user.id),
      supabase.from('habit_logs').select('id, habit_id, date').eq('user_id', user.id),
    ])
    setHabits(
      (habitsRes.data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        recurrenceWeekdays: r.recurrence_weekdays,
        usualTime: r.usual_time,
      }))
    )
    setHabitLogs((logsRes.data ?? []).map((r: any) => ({ id: r.id, habitId: r.habit_id, date: r.date })))
  }

  // A log is presence-only: insert if missing, delete if present. Gated
  // to today-or-earlier - logging a future day done makes no sense (same
  // implicit invariant workouts already have via completed_at).
  const handleToggleHabit = async (habit: Habit) => {
    if (date > getLocalDateString()) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const existing = habitLogs.find((l) => l.habitId === habit.id && l.date === date)
    const { error } = existing
      ? await supabase.from('habit_logs').delete().eq('id', existing.id)
      : await supabase.from('habit_logs').insert({ user_id: user.id, habit_id: habit.id, date })

    if (error) {
      console.error('Error toggling habit log:', error)
      return
    }
    refetchHabits()
  }

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setStartDate(date)
    setIsMultiDay(false)
    setEndDate(date)
    setHasTime(false)
    setStartTime('')
    setEndTime('')
    setIsRecurring(false)
    setRecurrenceWeekdays([])
    setRecurrenceEndDate('')
    setNote('')
  }

  const openAddDialog = (prefillDate?: string) => {
    resetForm()
    const d = prefillDate ?? date
    setStartDate(d)
    setEndDate(d)
    setDialogOpen(true)
  }

  const openEditDialog = (entry: CalendarEntry) => {
    setEditingId(entry.id)
    setTitle(entry.title)
    setStartDate(entry.startDate)
    setIsMultiDay(entry.endDate !== entry.startDate)
    setEndDate(entry.endDate)
    setHasTime(entry.startTime != null)
    setStartTime(entry.startTime ? entry.startTime.slice(0, 5) : '')
    setEndTime(entry.endTime ? entry.endTime.slice(0, 5) : '')
    setIsRecurring(entry.recurrenceWeekdays != null && entry.recurrenceWeekdays.length > 0)
    setRecurrenceWeekdays(entry.recurrenceWeekdays ?? [])
    setRecurrenceEndDate(entry.recurrenceEndDate ?? '')
    setNote(entry.note ?? '')
    setDialogOpen(true)
  }

  const toggleRecurrenceWeekday = (weekday: number) => {
    setRecurrenceWeekdays((prev) => (prev.includes(weekday) ? prev.filter((d) => d !== weekday) : [...prev, weekday].sort()))
  }

  const canSave =
    title.trim().length > 0 &&
    startDate.length > 0 &&
    (!isMultiDay || endDate >= startDate) &&
    (!hasTime || (startTime.length > 0 && endTime.length > 0 && endTime > startTime)) &&
    (!isRecurring || recurrenceWeekdays.length > 0)

  const handleSave = async () => {
    if (!canSave || !userId) return
    setSaving(true)

    const payload = {
      user_id: userId,
      title: title.trim(),
      start_date: startDate,
      end_date: isMultiDay ? endDate : startDate,
      start_time: hasTime ? startTime : null,
      end_time: hasTime ? endTime : null,
      note: note.trim() || null,
      recurrence_weekdays: isRecurring ? recurrenceWeekdays : null,
      recurrence_end_date: isRecurring && recurrenceEndDate ? recurrenceEndDate : null,
    }

    const { error } = editingId
      ? await supabase.from('calendar_entries').update(payload).eq('id', editingId)
      : await supabase.from('calendar_entries').insert(payload)

    setSaving(false)
    if (error) {
      console.error('Error saving calendar entry:', error)
      return
    }

    setDialogOpen(false)
    resetForm()
    fetchAll()
  }

  const handleDelete = async () => {
    if (!entryToDelete) return
    const { error } = await supabase.from('calendar_entries').delete().eq('id', entryToDelete)
    setEntryToDelete(null)
    if (error) {
      console.error('Error deleting calendar entry:', error)
      return
    }
    fetchAll()
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-white/40">Loading...</div>
        </div>
      </AppLayout>
    )
  }

  // The plan week containing the currently-displayed day, if any -
  // reuses slotsForWeek (day-template.ts) exactly as WeekDayList
  // (Races) does, just for this day's week instead of "today's."
  const displayedWeekStart = getLocalDateString(getLocalWeekStart(new Date(date + 'T00:00:00')))
  const matchedPlanWeek = racePlan?.weeks.find((w) => w.weekStartDate === displayedWeekStart) ?? null
  const raceWeekSlots =
    matchedPlanWeek && racePlan?.phaseTemplates[matchedPlanWeek.phase]
      ? slotsForWeek(racePlan.phaseTemplates[matchedPlanWeek.phase]!, matchedPlanWeek)
      : null

  const mesocycleStatus: CurrentMesocycleStatus | null = selectActiveMesocycle(mesocycles, date)

  // A short, naturally-expiring window (not a stored "dismissed" flag) -
  // shows a soft nudge for a few days after a declared disruption ends,
  // then just stops applying on its own. No migration needed.
  const today = getLocalDateString()
  const recentlyEndedDisruption = disruptions.find((d) => {
    const daysSinceEnd = daysBetween(today, d.end_date)
    return daysSinceEnd >= 0 && daysSinceEnd <= 3
  })

  const editingEntry = editingId ? calendarEntries.find((e) => e.id === editingId) ?? null : null

  const timedItems: TimedItem[] = buildTimedItemsForDate({
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

  const allDayItems = timedItems.filter((i) => i.startMinutes == null)
  const positioned: PositionedItem[] = layoutTimedItems(timedItems)

  const wakeMinutes = timeStringToMinutes(wakeTime)
  const sleepMinutes = timeStringToMinutes(sleepTime)

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard" className="text-white/40 hover:text-white/60 transition-colors mb-6 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-4 mb-6 mt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <CalendarDays className="w-8 h-8 text-white/80" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">Calendar</h1>
              <p className="text-white/50 text-sm">Your day, plus what your training already has planned</p>
            </div>
          </div>

          <button
            onClick={() => openAddDialog()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-white/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Add Entry</span>
          </button>
        </div>

        {recentlyEndedDisruption && !welcomeBackDismissed && (
          <div className="flex items-center justify-between gap-3 border border-white/10 rounded-2xl bg-white/[0.02] p-4 mb-6">
            <p className="text-white/60 text-sm">
              Welcome back - pick up your plan where you left off{activeRace ? ', or Regenerate if things shifted while you were away' : ''}.
            </p>
            <button
              onClick={() => setWelcomeBackDismissed(true)}
              className="text-white/30 hover:text-white/60 text-xs shrink-0 transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setDate(shiftDay(date, -1))}
            className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="text-white font-medium">{formatDayHeading(date)}</p>
            {mesocycleStatus && (
              <p className="text-white/40 text-xs mt-1">
                {mesocycleStatus.mesocycle.label ? `${mesocycleStatus.mesocycle.label} — ` : ''}
                {mesocycleStatus.isDeloadWeek
                  ? 'Deload week'
                  : `Week ${mesocycleStatus.currentWeek} of ${mesocycleStatus.mesocycle.lengthWeeks}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDate(getLocalDateString())}
              className="text-xs text-white/50 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setDate(shiftDay(date, 1))}
              className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {allDayItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {allDayItems.map((item) => {
              if (item.source === 'habit' && item.habit) {
                return (
                  <button
                    key={item.id}
                    onClick={() => handleToggleHabit(item.habit!)}
                    disabled={date > getLocalDateString()}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      item.habitDoneToday ? HABIT_DONE_STYLE : `${SOURCE_STYLE.habit} hover:brightness-125`
                    }`}
                  >
                    {item.habitDoneToday && <CheckCircle2 className="w-3 h-3" />}
                    {item.title}
                  </button>
                )
              }

              const content = (
                <span
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs border ${SOURCE_STYLE[item.source]}`}
                >
                  {item.source === 'goal' ? `Due: ${item.title}` : item.title}
                </span>
              )
              return item.href ? (
                <Link key={item.id} href={item.href} className="hover:opacity-80 transition-opacity">
                  {content}
                </Link>
              ) : (
                <div key={item.id} className="group relative inline-flex items-center">
                  {content}
                  {item.entry && (
                    <span className="hidden group-hover:inline-flex items-center gap-0.5 ml-1">
                      <button
                        onClick={() => openEditDialog(item.entry!)}
                        className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setEntryToDelete(item.entry!.id)}
                        className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div ref={axisRef} className="relative border border-white/10 rounded-2xl overflow-y-auto" style={{ maxHeight: '65vh' }}>
          <div className="relative" style={{ height: DAY_HEIGHT }}>
            {/* Dimmed regions outside wake/sleep - a default emphasis, never a hard cutoff; anything scheduled here still shows in full. */}
            <div
              className="absolute left-0 right-0 top-0 bg-black/30 pointer-events-none"
              style={{ height: wakeMinutes * PIXELS_PER_MINUTE }}
            />
            <div
              className="absolute left-0 right-0 bottom-0 bg-black/30 pointer-events-none"
              style={{ height: (24 * 60 - sleepMinutes) * PIXELS_PER_MINUTE }}
            />

            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="absolute left-0 right-0 border-t border-white/5" style={{ top: hour * 60 * PIXELS_PER_MINUTE }}>
                <span className="absolute -top-2 left-2 text-white/25 text-xs bg-black px-1">{String(hour).padStart(2, '0')}:00</span>
              </div>
            ))}

            <div className="absolute left-14 right-2 top-0 bottom-0">
              {positioned.map((item) => {
                const top = item.startMinutes * PIXELS_PER_MINUTE
                const height = Math.max(MIN_BLOCK_HEIGHT, (item.endMinutes - item.startMinutes) * PIXELS_PER_MINUTE)
                const widthPct = 100 / item.columnsInCluster
                const leftPct = item.column * widthPct
                const isHabit = item.source === 'habit' && item.habit
                const canToggleHabit = isHabit && date <= getLocalDateString()
                const clickable = (item.source === 'entry' && item.entry) || canToggleHabit

                const handleClick = () => {
                  if (item.source === 'entry' && item.entry) openEditDialog(item.entry)
                  else if (canToggleHabit) handleToggleHabit(item.habit!)
                }

                return (
                  <div
                    key={item.id}
                    onClick={clickable ? handleClick : undefined}
                    className={`absolute rounded-lg border px-2 py-1 overflow-hidden text-xs ${
                      isHabit && item.habitDoneToday ? HABIT_DONE_STYLE : SOURCE_STYLE[item.source]
                    } ${clickable ? 'cursor-pointer hover:brightness-125' : ''}`}
                    style={{ top, height, left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)` }}
                  >
                    <p className="font-medium truncate flex items-center gap-1">
                      {isHabit && item.habitDoneToday && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                      {item.title}
                    </p>
                    <p className="text-[10px] opacity-70 truncate">
                      {minutesToTimeString(item.startMinutes)}–{minutesToTimeString(item.endMinutes)}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <HabitsCard habits={habits} onChanged={refetchHabits} />
        </div>

        <div className="mt-6">
          <DisruptionDeclaration disruptions={disruptions} onChanged={refetchDisruptions} mesocycles={mesocycles} />
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="bg-black border-white/10 text-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Entry' : 'Add Entry'}</DialogTitle>
            <DialogDescription className="text-white/40">A title and a date is all you need - everything else is optional.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="entry-title" className="text-white/80">
                Title
              </Label>
              <Input
                id="entry-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Dentist appointment"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entry-start-date" className="text-white/80">
                {isMultiDay ? 'Start date' : 'Date'}
              </Label>
              <Input
                id="entry-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            {!isRecurring && (
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input type="checkbox" checked={isMultiDay} onChange={(e) => setIsMultiDay(e.target.checked)} />
                Spans multiple days
              </label>
            )}

            {isMultiDay && (
              <div className="space-y-2">
                <Label htmlFor="entry-end-date" className="text-white/80">
                  End date
                </Label>
                <Input
                  id="entry-end-date"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            )}

            {isMultiDay && editingEntry && (
              <button
                type="button"
                onClick={() => setTravelPrepEntryId(editingEntry.id)}
                className="text-xs text-white/40 hover:text-white/60 transition-colors underline underline-offset-2"
              >
                Travel Prep
              </button>
            )}

            <label className="flex items-center gap-2 text-sm text-white/70">
              <input type="checkbox" checked={hasTime} onChange={(e) => setHasTime(e.target.checked)} />
              Has a specific time
            </label>

            {hasTime && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="entry-start-time" className="text-white/80">
                    Start time
                  </Label>
                  <Input
                    id="entry-start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entry-end-time" className="text-white/80">
                    End time
                  </Label>
                  <Input
                    id="entry-end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>
            )}

            {!isMultiDay && (
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
                Repeats weekly
              </label>
            )}

            {isRecurring && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-white/80">Repeats on</Label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_NAMES.map((name, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleRecurrenceWeekday(i)}
                        className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                          recurrenceWeekdays.includes(i) ? 'bg-white text-black' : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {name.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entry-recurrence-end" className="text-white/80">
                    Until (optional)
                  </Label>
                  <Input
                    id="entry-recurrence-end"
                    type="date"
                    value={recurrenceEndDate}
                    min={startDate}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <p className="text-white/30 text-xs">
                  Editing or deleting this entry affects every occurrence - there&apos;s no way to change just one week.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="entry-note" className="text-white/80">
                Note (optional)
              </Label>
              <Textarea
                id="entry-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Any details worth remembering..."
                rows={3}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
              />
            </div>

            <Button onClick={handleSave} disabled={saving || !canSave} className="w-full bg-white text-black hover:bg-white/90">
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Entry'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={entryToDelete !== null}
        onOpenChange={(open) => !open && setEntryToDelete(null)}
        title="Remove Entry"
        description="Are you sure you want to remove this calendar entry? If it repeats weekly, this removes every occurrence."
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={handleDelete}
        destructive
      />

      {travelPrepEntryId &&
        (() => {
          const travelPrepEntry = calendarEntries.find((e) => e.id === travelPrepEntryId)
          if (!travelPrepEntry) return null
          return (
            <TravelPrepDialog
              entry={travelPrepEntry}
              mesocycles={mesocycles}
              open={travelPrepEntryId !== null}
              onOpenChange={(open) => !open && setTravelPrepEntryId(null)}
              onDisruptionDeclared={refetchDisruptions}
            />
          )
        })()}
    </AppLayout>
  )
}
