import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateWeightInsight } from '@/lib/weight-insight/generateWeightInsight'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ status: 'error', error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const result = await generateWeightInsight(supabase, user.id)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Failed to load weight insight:', err)
    return NextResponse.json({ status: 'error', error: 'Failed to load insight' }, { status: 502 })
  }
}
