import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateNutritionInsight } from '@/lib/nutrition-insight/generateNutritionInsight'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ status: 'error', error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const result = await generateNutritionInsight(supabase, user.id)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Failed to load nutrition insight:', err)
    return NextResponse.json({ status: 'error', error: 'Failed to load insight' }, { status: 502 })
  }
}
