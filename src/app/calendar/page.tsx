'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { CalendarDays, ArrowLeft, ChevronLeft, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { getLocalDateString, getLocalWeekStart } from '@/lib/date'
import { buildDayAggregates, type CalendarEntry, type DayAggregate } from '@/lib/calendar'
import { fetchScheduleSlots, WEEKDAY_NAMES, type ScheduleSlot } from '@/lib/gym-schedule'
import { fetchActiveActionItems, type ActionItem } from '@/lib/goals'
import { selectActiveMesocycle, type Mesocycle, type CurrentMesocycleStatus } from '@/lib/mesocycle'
import { slotsForWeek, type PhaseTemplates } from '@/lib/race-plan/day-template'
import type { TrainingWeekSkeleton } from '@/lib/race-plan/periodization'
import { raceTypeLabel } from '@/lib/race-constants'

// Every source below is fetched once per page load via the exact
// function/query each feature already ships with - this page only
// groups the results per day (buildDayAggregates, calendar.ts) and caps
// what's shown. Not a new source of truth for any of it.

type ScheduleMode = 'rotation' | 'calendar'

type DayLine =
  | { kind: 'race'; text: string }
  | { kind: 'goal'; text: string; href: string }
  | { kind: 'entry'; entry: CalendarEntry }
  | { kind: 'gym'; text: string }
  | { kind: 'races'; text: string }

// At most this many lines shown per day before a "+N more" - the one
// source capable of multiplying (Races sessions) is already consolidated
// into a single line upstream (buildDayAggregates), so this cap mostly
// protects against a day genuinely stacking several independent things
// (a manual entry + a goal due date + a gym slot, etc.).
const MAX_LINES_PER_DAY = 4

function buildDayLines(day: DayAggregate): { lines: DayLine[]; hiddenCount: number } {
  const lines: DayLine[] = []
  if (day.raceDayLabel) lines.push({ kind: 'race', text: day.raceDayLabel })
  for (const item of day.goalItems) lines.push({ kind: 'goal', text: item.title, href: item.editHref })
  for (const entry of day.entries) lines.push({ kind: 'entry', entry })
  if (day.gymSlotLabel) lines.push({ kind: 'gym', text: day.gymSlotLabel })
  if (day.racesSummary) lines.push({ kind: 'races', text: day.racesSummary })

  return { lines: lines.slice(0, MAX_LINES_PER_DAY), hiddenCount: Math.max(0, lines.length - MAX_LINES_PER_DAY) }
}

function shiftWeek(date: Date, deltaWeeks: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + deltaWeeks * 7)
  return next
}

function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${weekStart.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}, ${end.getFullYear()}`
}

export default function CalendarPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(getLocalWeekStart())

  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('rotation')
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([])
  const [activeRace, setActiveRace] = useState<{ raceDate: string; raceTypeLabel: string } | null>(null)
  const [racePlan, setRacePlan] = useState<{ weeks: TrainingWeekSkeleton[]; phaseTemplates: PhaseTemplates } | null>(null)
  const [mesocycles, setMesocycles] = useState<Mesocycle[]>([])
  const [goalItems, setGoalItems] = useState<ActionItem[]>([])
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(getLocalDateString())
  const [isMultiDay, setIsMultiDay] = useState(false)
  const [endDate, setEndDate] = useState(getLocalDateString())
  const [startTime, setStartTime] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const [entryToDelete, setEntryToDelete] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchAll()
  }, [])

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

    const [settingsResult, slots, raceResult, mesoResult, activeGoalItems, entriesResult] = await Promise.all([
      supabase.from('user_settings').select('schedule_mode').eq('user_id', user.id).maybeSingle(),
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
      supabase.from('calendar_entries').select('id, title, start_date, end_date, start_time, note').eq('user_id', user.id),
    ])

    setScheduleMode(settingsResult.data?.schedule_mode === 'calendar' ? 'calendar' : 'rotation')
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
        note: r.note,
      }))
    )

    setLoading(false)
  }

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setStartDate(getLocalDateString())
    setIsMultiDay(false)
    setEndDate(getLocalDateString())
    setStartTime('')
    setNote('')
  }

  const openAddDialog = (prefillDate?: string) => {
    resetForm()
    if (prefillDate) {
      setStartDate(prefillDate)
      setEndDate(prefillDate)
    }
    setDialogOpen(true)
  }

  const openEditDialog = (entry: CalendarEntry) => {
    setEditingId(entry.id)
    setTitle(entry.title)
    setStartDate(entry.startDate)
    setIsMultiDay(entry.endDate !== entry.startDate)
    setEndDate(entry.endDate)
    setStartTime(entry.startTime ? entry.startTime.slice(0, 5) : '')
    setNote(entry.note ?? '')
    setDialogOpen(true)
  }

  const canSave = title.trim().length > 0 && startDate.length > 0 && (!isMultiDay || endDate >= startDate)

  const handleSave = async () => {
    if (!canSave || !userId) return
    setSaving(true)

    const payload = {
      user_id: userId,
      title: title.trim(),
      start_date: startDate,
      end_date: isMultiDay ? endDate : startDate,
      start_time: startTime || null,
      note: note.trim() || null,
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

  const weekStartStr = getLocalDateString(weekStart)
  const todayStr = getLocalDateString()

  // The plan week matching the currently-displayed grid week, if any -
  // reuses slotsForWeek (day-template.ts) exactly as WeekDayList
  // (Races) does, just with this week's skeleton instead of "today's."
  const matchedPlanWeek = racePlan?.weeks.find((w) => w.weekStartDate === weekStartStr) ?? null
  const raceWeekSlots =
    matchedPlanWeek && racePlan?.phaseTemplates[matchedPlanWeek.phase]
      ? slotsForWeek(racePlan.phaseTemplates[matchedPlanWeek.phase]!, matchedPlanWeek)
      : null

  // Mesocycle status is a whole-week fact, not per-day - shown once above
  // the grid rather than repeated on all 7 cards. deriveMesocycleStatus
  // already takes an arbitrary date, so this is just evaluating it at the
  // grid's displayed week instead of literally today.
  const weekMesocycleStatus: CurrentMesocycleStatus | null = selectActiveMesocycle(mesocycles, weekStartStr)

  const days = buildDayAggregates({
    weekStart,
    calendarEntries,
    goalItems,
    activeRace,
    scheduleMode,
    scheduleSlots,
    raceWeekSlots,
  })

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <p className="text-white/50 text-sm">Your week, plus what your training already has planned</p>
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

        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setWeekStart(shiftWeek(weekStart, -1))}
            className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="text-white font-medium">{formatWeekRange(weekStart)}</p>
            {weekMesocycleStatus && (
              <p className="text-white/40 text-xs mt-1">
                {weekMesocycleStatus.mesocycle.label ? `${weekMesocycleStatus.mesocycle.label} — ` : ''}
                {weekMesocycleStatus.isDeloadWeek
                  ? 'Deload week'
                  : `Week ${weekMesocycleStatus.currentWeek} of ${weekMesocycleStatus.mesocycle.lengthWeeks}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart(getLocalWeekStart())}
              className="text-xs text-white/50 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setWeekStart(shiftWeek(weekStart, 1))}
              className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {days.map((day) => {
            const { lines, hiddenCount } = buildDayLines(day)
            const isToday = day.date === todayStr
            const dayNumber = new Date(day.date + 'T00:00:00').getDate()

            return (
              <div
                key={day.date}
                className={`border rounded-2xl p-4 ${isToday ? 'border-white/30 bg-white/[0.04]' : 'border-white/10 bg-white/[0.02]'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wide">{WEEKDAY_NAMES[day.weekdayIndex].slice(0, 3)}</p>
                    <p className={`text-lg font-medium ${isToday ? 'text-white' : 'text-white/80'}`}>{dayNumber}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {day.itemCount > 0 && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${day.itemCount >= 3 ? 'bg-white' : 'bg-white/40'}`}
                        title={`${day.itemCount} item(s)`}
                      />
                    )}
                    <button
                      onClick={() => openAddDialog(day.date)}
                      className="p-1 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {lines.length === 0 && <p className="text-white/20 text-xs">—</p>}
                  {lines.map((line, i) => {
                    if (line.kind === 'race') {
                      return (
                        <p key={i} className="text-white text-sm font-medium">
                          {line.text}
                        </p>
                      )
                    }
                    if (line.kind === 'goal') {
                      return (
                        <Link key={i} href={line.href} className="block text-sm text-white/70 hover:text-white transition-colors truncate">
                          Due: {line.text}
                        </Link>
                      )
                    }
                    if (line.kind === 'entry') {
                      return (
                        <div key={i} className="flex items-center justify-between gap-1">
                          <span className="text-sm text-white/80 truncate">
                            {line.entry.title}
                            {line.entry.startTime && <span className="text-white/40"> · {line.entry.startTime.slice(0, 5)}</span>}
                          </span>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={() => openEditDialog(line.entry)}
                              className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setEntryToDelete(line.entry.id)}
                              className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )
                    }
                    // 'gym' and 'races'
                    return (
                      <p key={i} className="text-sm text-white/50 truncate">
                        {line.text}
                      </p>
                    )
                  })}
                  {hiddenCount > 0 && <p className="text-white/30 text-xs">+{hiddenCount} more</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="bg-black border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Entry' : 'Add Entry'}</DialogTitle>
            <DialogDescription className="text-white/40">
              A title and a date is all you need - time and notes are optional.
            </DialogDescription>
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

            <label className="flex items-center gap-2 text-sm text-white/70">
              <input type="checkbox" checked={isMultiDay} onChange={(e) => setIsMultiDay(e.target.checked)} />
              Spans multiple days
            </label>

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

            <div className="space-y-2">
              <Label htmlFor="entry-time" className="text-white/80">
                Time (optional)
              </Label>
              <Input
                id="entry-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-white/5 border-white/10 text-white w-40"
              />
            </div>

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
        description="Are you sure you want to remove this calendar entry?"
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={handleDelete}
        destructive
      />
    </AppLayout>
  )
}
