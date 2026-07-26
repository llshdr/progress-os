import type { SupabaseClient } from '@supabase/supabase-js'
import type { SuggestionCandidate } from './types'
import { fetchScheduleSlots, computeNextSlot, computeSlotMuscles, slotDisplayName } from '@/lib/gym-schedule'
import { getLocalDateString } from '@/lib/date'

// Deterministic, real (non-hallucinated) candidate for the optional gym
// schedule. Returns nothing at all when no rotation is defined - this
// never introduces a second, disconnected notion of training frequency
// alongside weekly_workout_goal; it only adds a "which specific workout is
// next" layer for users who opt into a schedule.
export async function getScheduleSuggestionCandidates(
  supabase: SupabaseClient,
  userId: string
): Promise<SuggestionCandidate[]> {
  const slots = await fetchScheduleSlots(supabase, userId)
  if (slots.length === 0) return []

  const { data: lastWorkout } = await supabase
    .from('workouts')
    .select('template_id, date')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Already trained today - nothing to nudge toward.
  if (lastWorkout?.date === getLocalDateString()) return []

  const next = computeNextSlot(slots, lastWorkout?.template_id ?? null)
  // No template (e.g. a "Rest Day" slot) means nothing to actually suggest.
  if (!next || !next.templateId) return []

  const muscles = await computeSlotMuscles(supabase, next.templateId)
  const muscleSuffix = muscles.length > 0 ? ` — ${muscles.join(', ')}` : ''

  return [
    {
      module: 'gym',
      text: `Up next in your rotation: ${slotDisplayName(next)}${muscleSuffix}.`,
      action: { label: 'Start workout', href: '/gym/workouts/new' },
    },
  ]
}
