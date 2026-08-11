import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { createClient } from '@/lib/supabase/server'

const MODEL = 'gemini-2.5-flash'
// How many prior checkins to show as "already tried" context - enough to
// ground a genuinely different suggestion, not a full history dump.
const PRIOR_CONTEXT_LIMIT = 2

// Deliberately NOT the goal-plan route's Type.ARRAY-of-milestones shape -
// one short, concrete idea for what to try next, reusing the same
// "facts in, one grounded output out" pattern the AI Coach recommend
// route already uses, just with a much smaller prompt. No due dates, no
// sequencing, no multi-step plan - this is the lightweight alternative
// to that heavier, still-available flow.
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
  // Bypasses the cache below to explicitly ask for a different idea -
  // the client sends this once a suggestion already exists and the
  // button reads "Get another idea" rather than "Get an idea".
  const force: boolean = body?.force ?? false
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

  const { data: checkins, error: checkinsError } = await supabase
    .from('goal_checkins')
    .select('id, focus, ai_suggestion, created_at')
    .eq('goal_id', goalId)
    .order('created_at', { ascending: false })
    .limit(1 + PRIOR_CONTEXT_LIMIT)

  if (checkinsError) {
    console.error('Error fetching goal checkins:', checkinsError)
    return NextResponse.json({ status: 'error', error: 'Failed to load check-ins' }, { status: 502 })
  }

  // Nothing to ground a real suggestion in yet - the philosophy here is
  // "facts in, one grounded output out," same as everywhere else in this
  // app; a goal with no logged focus at all gets no suggestion rather
  // than a generic, ungrounded one.
  const latest = checkins?.[0]
  if (!latest) {
    return NextResponse.json({ status: 'not_enough_context' })
  }

  // Cached, not regenerated on every click - same "only recompute on
  // real change" discipline used throughout this app, just per-request
  // here rather than trigger-driven, since a checkin is a one-time user
  // action rather than a high-frequency write source.
  if (latest.ai_suggestion && !force) {
    return NextResponse.json({ status: 'ok', suggestion: latest.ai_suggestion })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set')
    return NextResponse.json({ status: 'error', error: 'AI Coach is not configured' }, { status: 500 })
  }

  const priorCheckins = (checkins ?? []).slice(1)
  const priorContext =
    priorCheckins.length > 0
      ? `\n\nWhat they've already tried before that (most recent first): ${priorCheckins.map((c) => `"${c.focus}"`).join(', ')}`
      : ''

  const prompt = `You are a sharp, practical advisor helping someone make progress on a personal goal one step at a time - not by planning their whole future, but by suggesting a genuinely good next thing to try given where they are right now. The philosophy here is deliberate: nobody can know the whole path in advance, it reveals itself as you go - what matters is always having a real next idea, not a complete roadmap.

Goal: "${goal.title}"
${goal.description ? `Description: ${goal.description}` : ''}
${goal.target_date ? `Target date: ${goal.target_date}` : ''}

What they're currently trying: "${latest.focus}"${priorContext}

Suggest ONE concrete, specific next step or idea worth trying - something that could genuinely move this forward, grounded in what they've already tried (don't repeat it). Keep it to 1-2 sentences. Be specific and actionable, not generic filler like "stay motivated" or "keep pushing" - and don't propose a multi-step plan, just the single next good thing to try.`

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestion: { type: Type.STRING },
          },
          required: ['suggestion'],
        },
      },
    })

    const parsed = JSON.parse(response.text ?? '{}')
    if (typeof parsed.suggestion !== 'string' || !parsed.suggestion.trim()) {
      throw new Error('Malformed model response')
    }

    const { error: updateError } = await supabase
      .from('goal_checkins')
      .update({ ai_suggestion: parsed.suggestion })
      .eq('id', latest.id)

    if (updateError) {
      console.error('Error saving goal next-step suggestion:', updateError)
    }

    return NextResponse.json({ status: 'ok', suggestion: parsed.suggestion })
  } catch (err) {
    console.error('Goal next-step generation failed:', err)
    return NextResponse.json({ status: 'error', error: 'Failed to generate a suggestion' }, { status: 502 })
  }
}
