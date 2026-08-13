import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewRecipeClient from './new-recipe-client'

export default async function NewRecipePage() {
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

  return <NewRecipeClient />
}
