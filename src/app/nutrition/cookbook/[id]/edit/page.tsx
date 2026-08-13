import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EditRecipeClient from './edit-recipe-client'

export default async function EditRecipePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  const { data: roleRow } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()

  if (roleRow?.role !== 'owner') {
    redirect('/nutrition/cookbook')
  }

  return <EditRecipeClient />
}
