'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Client-side mirror of the server-side owner check already used to gate
// /owner/invite-code and /settings' Invite Code link (both check
// user_roles.role === 'owner'). Lets a page conditionally show
// owner-only controls (e.g. "Add Recipe", Edit/Delete) without a full
// page redirect. This only controls what's rendered - the real
// enforcement is still RLS plus the server-side redirect on the actual
// write pages, same as every other owner-only surface in this app.
export function useIsOwner(): boolean {
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => setIsOwner(data?.role === 'owner'))
    })
  }, [])

  return isOwner
}
