import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InviteCodeClient from './invite-code-client'

export default async function InviteCodePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (roleRow?.role !== 'owner') {
    redirect('/dashboard')
  }

  const { data: inviteCode } = await supabase
    .from('invite_codes')
    .select('id, code, updated_at')
    .single()

  return <InviteCodeClient inviteCode={inviteCode} />
}
