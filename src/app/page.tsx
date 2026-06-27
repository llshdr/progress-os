import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Dashboard from './dashboard'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  return <Dashboard user={user} />
}
