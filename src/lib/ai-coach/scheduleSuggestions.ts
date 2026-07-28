import type { SupabaseClient } from '@supabase/supabase-js'
import type { SuggestionCandidate } from './types'
import {
  fetchScheduleSlots,
  computeNextSlot,
  computeSlotForWeekday,
  getCatchUpSlot,
  computeSlotMuscles,
  slotDisplayName,
  type ScheduleSlot,
} from '@/lib/gym-schedule'
import { getLocalDateString, getLocalWeekdayIndex } from '@/lib/date'

async function buildSlotCandidate(
  supabase: SupabaseClient,
  slot: ScheduleSlot,
  text: string,
  actionLabel: string
): Promise<SuggestionCandidate> {
  const muscles = await computeSlotMuscles(supabase, slot.templateId as string)
  const muscleSuffix = muscles.length > 0 ? ` — ${muscles.join(', ')}` : ''

  return {
    module: 'gym',
    text: `${text}${muscleSuffix}.`,
    action: { label: actionLabel, href: `/gym/workouts/new?slot=${slot.id}` },
  }
}

// Deterministic, real (non-hallucinated) candidate(s) for the optional gym
// schedule. Returns nothing at all when no schedule is defined - this
// never introduces a second, disconnected notion of training frequency
// alongside weekly_workout_goal; it only adds a "which specific workout is
// next" layer for users who opt into a schedule.
export async function getScheduleSuggestionCandidates(
  supabase: SupabaseClient,
  userId: string
): Promise<SuggestionCandidate[]> {
  const slots = await fetchScheduleSlots(supabase, userId)
  if (slots.length === 0) return []

  const { data: settings } = await supabase
    .from('user_settings')
    .select('schedule_mode')
    .eq('user_id', userId)
    .maybeSingle()

  if (settings?.schedule_mode === 'calendar') {
    return getCalendarScheduleSuggestionCandidates(supabase, userId, slots)
  }

  const { data: lastWorkout } = await supabase
    .from('workouts')
    .select('template_id, schedule_slot_id, date')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('date', { ascending: false })
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Already trained today - nothing to nudge toward.
  if (lastWorkout?.date === getLocalDateString()) return []

  const next = computeNextSlot(
    slots,
    lastWorkout ? { templateId: lastWorkout.template_id, scheduleSlotId: lastWorkout.schedule_slot_id } : null
  )
  // No template (e.g. a "Rest Day" slot) means nothing to actually suggest.
  if (!next || !next.templateId) return []

  return [await buildSlotCandidate(supabase, next, `Up next in your rotation: ${slotDisplayName(next)}`, 'Start workout')]
}

// Calendar mode: today's slot is a direct weekday lookup, not a history
// walk. Also offers a catch-up candidate for yesterday's slot if it wasn't
// logged - both flow into the same pooled/AI-picked daily suggestions list
// as every other module's candidates, so neither is guaranteed to survive
// that pick on a busy day; the schedule page itself shows the catch-up
// prompt directly and unconditionally, independent of this.
async function getCalendarScheduleSuggestionCandidates(
  supabase: SupabaseClient,
  userId: string,
  slots: ScheduleSlot[]
): Promise<SuggestionCandidate[]> {
  const today = getLocalDateString()

  const { data: todaysWorkout } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', userId)
    .eq('date', today)
    .not('completed_at', 'is', null)
    .limit(1)
    .maybeSingle()

  const candidates: SuggestionCandidate[] = []

  if (!todaysWorkout) {
    const todaySlot = computeSlotForWeekday(slots, getLocalWeekdayIndex())
    if (todaySlot?.templateId) {
      candidates.push(
        await buildSlotCandidate(supabase, todaySlot, `Today's scheduled workout: ${slotDisplayName(todaySlot)}`, 'Start workout')
      )
    }
  }

  const catchUpSlot = await getCatchUpSlot(supabase, userId, slots)
  if (catchUpSlot) {
    candidates.push(
      await buildSlotCandidate(
        supabase,
        catchUpSlot,
        `Catch up: yesterday's ${slotDisplayName(catchUpSlot)}`,
        'Start catch-up workout'
      )
    )
  }

  return candidates
}
