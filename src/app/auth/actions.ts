'use server'

import { createClient } from '@/lib/supabase/server'

// Runs sign-in/sign-up server-side so the resulting session cookie arrives
// via a real HTTP Set-Cookie header on this action's response, rather than
// a client-side JS write - Safari treats script-writable cookies far more
// aggressively for storage eviction, which was the diagnosed cause of
// sessions not persisting for some users. The invite-code precheck stays
// client-side (a plain read-only RPC, no session/cookie side effects, so
// it isn't part of the problem this fixes).
export async function signInAction(email: string, password: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return { error: error?.message ?? null }
}

export async function signUpAction(
  email: string,
  password: string,
  inviteCode: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { invite_code: inviteCode } },
  })
  return { error: error?.message ?? null }
}
