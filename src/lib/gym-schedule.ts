import type { SupabaseClient } from '@supabase/supabase-js'
import { getLocalDateString, getLocalWeekdayIndex } from '@/lib/date'

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export interface ScheduleSlot {
  id: string
  templateId: string | null
  templateName: string | null
  label: string | null
  slotOrder: number
}

export function slotDisplayName(slot: ScheduleSlot): string {
  return slot.templateName ?? slot.label ?? 'Untitled'
}

// Ordered rotation for the current user, joined to the template name where
// one is linked. Reordering is just persisting new slot_order values - the
// list itself is the only state; nothing else needs to stay in sync.
export async function fetchScheduleSlots(supabase: SupabaseClient, userId: string): Promise<ScheduleSlot[]> {
  const { data, error } = await supabase
    .from('workout_schedule_slots')
    .select('id, template_id, label, slot_order, workout_templates(name)')
    .eq('user_id', userId)
    .order('slot_order', { ascending: true })

  if (error) {
    console.error('Error fetching schedule slots:', error)
    return []
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    templateId: row.template_id,
    templateName: row.workout_templates?.name ?? null,
    label: row.label,
    slotOrder: row.slot_order,
  }))
}

export interface LastWorkoutRef {
  templateId: string | null
  scheduleSlotId: string | null
}

// Deliberately stateless: "next" is derived from real workout history each
// time, not a stored pointer that could drift if slots are reordered/edited
// or a workout is logged out of sequence. Falls back to the first slot when
// there's no history, or the last workout can't be placed in the rotation
// at all (ad-hoc session, or the rotation changed since).
export function computeNextSlot(slots: ScheduleSlot[], lastWorkout: LastWorkoutRef | null): ScheduleSlot | null {
  if (slots.length === 0) return null
  if (!lastWorkout) return slots[0]

  // Direct lookup when the workout was started from a known slot - exact
  // and unambiguous even when the same template appears more than once in
  // the rotation, unlike matching by template_id below.
  if (lastWorkout.scheduleSlotId) {
    const slotIndex = slots.findIndex((s) => s.id === lastWorkout.scheduleSlotId)
    if (slotIndex !== -1) return slots[(slotIndex + 1) % slots.length]
    // Slot may have been removed from the rotation since - fall through.
  }

  // Fallback for workouts logged before this fix existed, or started
  // ad-hoc without going through a slot. Ambiguous if the template repeats
  // in the rotation - always resolves to its first occurrence.
  if (!lastWorkout.templateId) return slots[0]
  const lastIndex = slots.findIndex((s) => s.templateId === lastWorkout.templateId)
  if (lastIndex === -1) return slots[0]

  return slots[(lastIndex + 1) % slots.length]
}

// Calendar mode's direct lookup - replaces computeNextSlot()'s history walk
// for this mode entirely; no workout history needed to answer "what's
// today," since slot_order is a fixed weekday index (0=Monday...6=Sunday)
// here rather than a rotation position.
export function computeSlotForWeekday(slots: ScheduleSlot[], weekdayIndex: number): ScheduleSlot | null {
  return slots.find((s) => s.slotOrder === weekdayIndex) ?? null
}

export interface WizardRotationRow {
  user_id: string
  template_id: string | null
  label: string | null
  slot_order: number
}

// The quick-setup wizard's output: the chosen templates first (slot_order
// 0..N-1), then Rest Day slots filling out the rest of a 7-slot cycle.
// Training slots first is the simplest predictable placement - the user
// can still reorder afterward with the existing up/down controls, so there
// is no need to auto-interleave rest days between them.
export function buildWizardRotationRows(userId: string, templateIds: string[]): WizardRotationRow[] {
  const rows: WizardRotationRow[] = templateIds.map((id, i) => ({
    user_id: userId,
    template_id: id,
    label: null,
    slot_order: i,
  }))

  for (let i = templateIds.length; i < 7; i++) {
    rows.push({ user_id: userId, template_id: null, label: 'Rest Day', slot_order: i })
  }

  return rows
}

// Calendar mode's wizard output: N templates spread evenly across the 7
// weekdays (a standard even-distribution formula, e.g. n=3 -> Mon/Wed/Fri,
// n=4 -> Mon/Tue/Thu/Sat), Rest Day filling the remaining weekdays.
// Auto-spread rather than a full weekday-picker grid - meaningfully less
// new UI, with manual reassignment still available afterward via the
// existing reorder controls on the schedule page.
export function buildWizardCalendarRows(userId: string, templateIds: string[]): WizardRotationRow[] {
  const n = templateIds.length
  const usedWeekdays = new Set<number>()

  const rows: WizardRotationRow[] = templateIds.map((id, i) => {
    const weekday = Math.floor((i * 7) / n)
    usedWeekdays.add(weekday)
    return { user_id: userId, template_id: id, label: null, slot_order: weekday }
  })

  for (let day = 0; day < 7; day++) {
    if (!usedWeekdays.has(day)) {
      rows.push({ user_id: userId, template_id: null, label: 'Rest Day', slot_order: day })
    }
  }

  return rows
}

// Shared by both the schedule page's direct catch-up prompt and the
// dashboard suggestion candidate, so "was yesterday missed" logic lives in
// one place. Returns yesterday's slot only if it carries a template and no
// workout was completed on that actual calendar date - never a multi-day
// backlog, only ever "yesterday."
export async function getCatchUpSlot(
  supabase: SupabaseClient,
  userId: string,
  slots: ScheduleSlot[]
): Promise<ScheduleSlot | null> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const slot = computeSlotForWeekday(slots, getLocalWeekdayIndex(yesterday))
  if (!slot?.templateId) return null

  const { data } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', userId)
    .eq('date', getLocalDateString(yesterday))
    .not('completed_at', 'is', null)
    .limit(1)
    .maybeSingle()

  return data ? null : slot
}

// Broad muscle groups covered by a template's exercises, deduped - for the
// slot summary badge (e.g. "Chest, Shoulders, Arms"). Reuses exactly the
// data already on exercise_library; no new tagging.
export async function computeSlotMuscles(supabase: SupabaseClient, templateId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('workout_template_exercises')
    .select('exercise_library(primary_muscle_group, secondary_muscle_groups)')
    .eq('template_id', templateId)

  if (error) {
    console.error('Error computing slot muscles:', error)
    return []
  }

  const muscles = new Set<string>()
  for (const row of (data ?? []) as any[]) {
    const exercise = row.exercise_library
    if (!exercise) continue
    if (exercise.primary_muscle_group) muscles.add(exercise.primary_muscle_group)
    for (const secondary of exercise.secondary_muscle_groups ?? []) muscles.add(secondary)
  }

  return Array.from(muscles)
}
