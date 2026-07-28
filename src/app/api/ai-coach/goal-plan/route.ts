import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { createClient } from '@/lib/supabase/server'

const MODEL = 'gemini-2.5-flash'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ status: 'error', error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const goalId: string | null = body?.goalId ?? null
  if (!goalId) {
    return NextResponse.json({ status: 'error', error: 'Missing goalId' }, { status: 400 })
  }

  const { data: goal, error: goalError } = await supabase
    .from('goals')
    .select('title, description, target_date')
    .eq('id', goalId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (goalError || !goal) {
    return NextResponse.json({ status: 'not_found' })
  }

  // Generation is only ever offered once per goal (see the edit page's UI
  // gating) - this is the server-side half of that guarantee, so a stale
  // client / double-click can't produce a duplicate batch.
  const { count: existingCount } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('goal_id', goalId)

  if (existingCount && existingCount > 0) {
    return NextResponse.json({ status: 'already_has_plan' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set')
    return NextResponse.json({ status: 'error', error: 'AI Coach is not configured' }, { status: 500 })
  }

  // Only reference the gym module if the user actually has a schedule -
  // an existence check, not its contents, so this stays a light-touch hint
  // for the model rather than any coded goals-to-gym coupling.
  const { data: settings } = await supabase
    .from('user_settings')
    .select('weekly_workout_goal')
    .eq('user_id', user.id)
    .maybeSingle()

  const { count: scheduleSlotCount } = await supabase
    .from('workout_schedule_slots')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  let gymContext = ''
  if (settings?.weekly_workout_goal || (scheduleSlotCount && scheduleSlotCount > 0)) {
    const parts: string[] = []
    if (settings?.weekly_workout_goal) parts.push(`trains toward a goal of ${settings.weekly_workout_goal} workouts/week`)
    if (scheduleSlotCount && scheduleSlotCount > 0) parts.push('has a gym schedule already set up (Gym -> Schedule)')
    gymContext = `\n\nFor context, this person ${parts.join(' and ')}.`
  }

  const prompt = `You are a practical, no-nonsense planning coach helping someone break down a personal goal into a small number of concrete milestones.

Goal: "${goal.title}"
${goal.description ? `Description: ${goal.description}` : ''}
${goal.target_date ? `Target date: ${goal.target_date}` : ''}${gymContext}

Break this down into 3-5 concrete, sequential milestones that would realistically move this goal forward. Each milestone needs a short title, an optional one-sentence description of why it matters or what it involves, and a single concrete next action the person could actually do this week to start on it. Keep everything specific and actionable - no vague filler advice like "stay motivated" or "track your progress." Most goals are not fitness-related - only reference the gym module if the goal is genuinely fitness/training-related and it's actually relevant.`

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              nextAction: { type: Type.STRING },
            },
            required: ['title', 'nextAction'],
          },
        },
      },
    })

    const parsed = JSON.parse(response.text ?? '[]')
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Malformed model response')
    }

    const milestones = parsed.filter(
      (m): m is { title: string; description?: string; nextAction: string } =>
        typeof m?.title === 'string' && typeof m?.nextAction === 'string'
    )
    if (milestones.length === 0) {
      throw new Error('No usable milestones in model response')
    }

    const rows = milestones.map((m) => ({
      user_id: user.id,
      goal_id: goalId,
      title: m.title,
      description: typeof m.description === 'string' && m.description ? m.description : null,
      next_action: m.nextAction,
      status: 'active' as const,
    }))

    const { data: inserted, error: insertError } = await supabase.from('projects').insert(rows).select()

    if (insertError) {
      console.error('Error inserting generated milestones:', insertError)
      return NextResponse.json({ status: 'error', error: 'Failed to save plan' }, { status: 502 })
    }

    // Convenience only, never overwrites an existing manual next_action.
    const { data: currentGoal } = await supabase.from('goals').select('next_action').eq('id', goalId).maybeSingle()
    if (!currentGoal?.next_action) {
      await supabase.from('goals').update({ next_action: milestones[0].nextAction }).eq('id', goalId)
    }

    return NextResponse.json({ status: 'ok', projects: inserted })
  } catch (err) {
    console.error('Goal plan generation failed:', err)
    return NextResponse.json({ status: 'error', error: 'Failed to generate plan' }, { status: 502 })
  }
}
