import type { SupabaseClient } from '@supabase/supabase-js'

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

// Deliberately stateless: "next" is derived from real workout history each
// time, not a stored pointer that could drift if slots are reordered/edited
// or a workout is logged out of sequence. Falls back to the first slot when
// there's no history, or the last workout's template isn't in the rotation
// at all (ad-hoc session, or the rotation changed since).
export function computeNextSlot(slots: ScheduleSlot[], lastWorkoutTemplateId: string | null): ScheduleSlot | null {
  if (slots.length === 0) return null
  if (!lastWorkoutTemplateId) return slots[0]

  const lastIndex = slots.findIndex((s) => s.templateId === lastWorkoutTemplateId)
  if (lastIndex === -1) return slots[0]

  return slots[(lastIndex + 1) % slots.length]
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
