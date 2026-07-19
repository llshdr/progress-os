import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateDailySuggestions } from '@/lib/ai-coach/generateDailySuggestions'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ status: 'error', error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const suggestions = await generateDailySuggestions(supabase, user.id)
    return NextResponse.json({ status: 'ok', suggestions })
  } catch (err) {
    console.error('Failed to load daily suggestions:', err)
    return NextResponse.json({ status: 'error', error: 'Failed to load suggestions' }, { status: 502 })
  }
}
