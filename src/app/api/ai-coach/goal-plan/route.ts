import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { createClient } from '@/lib/supabase/server'
import { getLocalDateString } from '@/lib/date'

const MODEL = 'gemini-2.5-flash'

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return getLocalDateString(d)
}

// Evenly spaces `count` new milestones across [effectiveStart, targetDate]
// so the last one lands at/near the goal's target date. Deterministic,
// code-side arithmetic - never asked of the model, same standing rule
// used everywhere else in this app that generates data (the model reasons
// about content/sequencing, code handles anything that's actually math).
function computeDueDates(count: number, effectiveStart: string, targetDate: string): string[] {
  const start = new Date(effectiveStart)
  const target = new Date(targetDate)
  const windowDays = Math.max(1, Math.round((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))

  return Array.from({ length: count }, (_, i) => {
    const offset = Math.round(((i + 1) * windowDays) / count)
    return addDays(effectiveStart, offset)
  })
}

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
    .select('title, description, start_date, target_date')
    .eq('id', goalId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (goalError || !goal) {
    return NextResponse.json({ status: 'not_found' })
  }

  // Any status - a done/archived milestone is just as much "already
  // covered ground" as an active one when deciding what NOT to duplicate.
  const { data: existingMilestones } = await supabase
    .from('milestones')
    .select('title, next_action, due_date')
    .eq('goal_id', goalId)
    .order('created_at', { ascending: true })

  const existing = existingMilestones ?? []

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

  const existingContext =
    existing.length > 0
      ? `\n\nMilestones already planned for this goal (do not repeat these or anything equivalent to them):\n${existing
          .map((m) => `- ${m.title}${m.next_action ? ` (next action: ${m.next_action})` : ''}`)
          .join('\n')}`
      : ''

  const countInstruction =
    existing.length === 0
      ? 'Break this down into 3-5 concrete, sequential milestones that would realistically move this goal forward.'
      : 'Add 2-4 more concrete, sequential milestones that realistically extend the plan already in progress - genuinely new ground, not rephrasings of what is already planned.'

  const prompt = `You are a practical, no-nonsense planning coach helping someone break down a personal goal into a small number of concrete milestones.

Goal: "${goal.title}"
${goal.description ? `Description: ${goal.description}` : ''}
${goal.target_date ? `Target date: ${goal.target_date}` : ''}${gymContext}${existingContext}

${countInstruction} Each milestone needs a short title, an optional one-sentence description of why it matters or what it involves, and a single concrete next action the person could actually do this week to start on it. Keep everything specific and actionable - no vague filler advice like "stay motivated" or "track your progress." Most goals are not fitness-related - only reference the gym module if the goal is genuinely fitness/training-related and it's actually relevant.`

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

    const newMilestones = parsed.filter(
      (m): m is { title: string; description?: string; nextAction: string } =>
        typeof m?.title === 'string' && typeof m?.nextAction === 'string'
    )
    if (newMilestones.length === 0) {
      throw new Error('No usable milestones in model response')
    }

    // Due dates: skip entirely with no target_date (nothing to space
    // milestones across); otherwise fill the *remaining* window - from
    // today or the latest existing milestone's due date, whichever is
    // later, through the target date - never touching already-assigned
    // dates on existing rows.
    let dueDates: (string | null)[] = newMilestones.map(() => null)
    if (goal.target_date) {
      const today = getLocalDateString()
      const latestExistingDue = existing
        .map((m) => m.due_date)
        .filter((d): d is string => Boolean(d))
        .sort()
        .at(-1)
      const baseline = latestExistingDue ?? goal.start_date ?? today
      const effectiveStart = baseline > today ? baseline : today
      dueDates = computeDueDates(newMilestones.length, effectiveStart, goal.target_date)
    }

    const rows = newMilestones.map((m, i) => ({
      user_id: user.id,
      goal_id: goalId,
      title: m.title,
      description: typeof m.description === 'string' && m.description ? m.description : null,
      next_action: m.nextAction,
      due_date: dueDates[i],
      status: 'active' as const,
    }))

    const { data: inserted, error: insertError } = await supabase.from('milestones').insert(rows).select()

    if (insertError) {
      console.error('Error inserting generated milestones:', insertError)
      return NextResponse.json({ status: 'error', error: 'Failed to save plan' }, { status: 502 })
    }

    // Convenience only, never overwrites an existing manual next_action.
    const { data: currentGoal } = await supabase.from('goals').select('next_action').eq('id', goalId).maybeSingle()
    if (!currentGoal?.next_action) {
      await supabase.from('goals').update({ next_action: newMilestones[0].nextAction }).eq('id', goalId)
    }

    return NextResponse.json({ status: 'ok', milestones: inserted })
  } catch (err) {
    console.error('Goal plan generation failed:', err)
    return NextResponse.json({ status: 'error', error: 'Failed to generate plan' }, { status: 502 })
  }
}
