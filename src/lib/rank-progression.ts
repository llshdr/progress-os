import type { SupabaseClient } from '@supabase/supabase-js'

// Writers for the two private, per-user progression signals that feed
// recompute_user_rank's progression bonus (migration 076) - self-
// referential quality signals ("are you executing YOUR OWN plan well"),
// never a cross-person comparison. Both live on user_settings, already
// owner-only RLS, same trust boundary as every other column there -
// only the resulting +0/+1 bump to the single coarse public_profiles.rank
// integer is ever visible to other users. A DB trigger with a WHEN
// clause (see migration 076) skips the actual rank recompute when the
// value hasn't changed, so writing on every page view here is cheap and
// doesn't require a read-before-write check client-side.
//
// upsert (not update) because a user_settings row may not exist yet for
// a given user - every other column has a table DEFAULT, so a partial
// upsert with just user_id + one signal is safe on the INSERT path too.

export async function upsertRacesProgressionSignal(supabase: SupabaseClient, userId: string, value: number | null): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, races_progression_signal: value }, { onConflict: 'user_id' })
  if (error) console.error('Error saving races progression signal:', error)
}

export async function upsertGymProgressionSignal(supabase: SupabaseClient, userId: string, value: number | null): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, gym_progression_signal: value }, { onConflict: 'user_id' })
  if (error) console.error('Error saving gym progression signal:', error)
}
