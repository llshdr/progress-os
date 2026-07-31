import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { createClient } from '@/lib/supabase/server'
import { raceCategoryFor } from '@/lib/race-plan/self-assessment'
import { computeDisciplineActivityFacts, rankDisciplines } from '@/lib/race-plan/discipline-weakness'

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
  const raceId: string | null = body?.raceId ?? null
  if (!raceId) {
    return NextResponse.json({ status: 'error', error: 'Missing raceId' }, { status: 400 })
  }

  const { data: race, error: raceError } = await supabase
    .from('races')
    .select('id, race_type, self_assessment')
    .eq('id', raceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (raceError || !race) {
    return NextResponse.json({ status: 'not_found' })
  }

  const assessment = race.self_assessment
  if (raceCategoryFor(race.race_type) !== 'multisport' || !assessment || assessment.kind !== 'multisport') {
    return NextResponse.json({ status: 'error', error: 'Weakness analysis only applies to a completed multisport assessment' }, { status: 400 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set')
    return NextResponse.json({ status: 'error', error: 'AI Coach is not configured' }, { status: 500 })
  }

  const activityFacts = await computeDisciplineActivityFacts(supabase)
  const ranking = rankDisciplines(assessment, activityFacts)

  const disciplineSummary = (['swim', 'bike', 'run'] as const)
    .map((discipline) => {
      const self = assessment[discipline]
      const facts = activityFacts[discipline]
      const parts = [`self-rated comfort ${self.comfortLevel ?? 'not given'}/5`]
      if (self.longestRecentSessionKm != null) parts.push(`longest recent session ${self.longestRecentSessionKm}km`)
      if (self.limiters.length > 0 && !self.limiters.includes('none')) parts.push(`limiters: ${self.limiters.join(', ')}`)
      parts.push(`logged activity in ${facts.weeksActiveOf8}/8 recent weeks`, `longest logged session ${facts.longestSessionKm.toFixed(1)}km`)
      return `${discipline.toUpperCase()}: ${parts.join('; ')}.`
    })
    .join('\n')

  const prompt = `You are an experienced triathlon coach reviewing an athlete's self-report and logged training data across three disciplines before writing a training plan.

${disciplineSummary}

Based on the facts above, ${ranking.order[0]} is this athlete's weakest discipline, ${ranking.order[1]} is in the middle, and ${ranking.order[2]} is their strongest (this ordering is already decided - do not disagree with it or re-rank).

Write ONE short, specific sentence per discipline explaining the particular reason it's weak or strong for this athlete, grounded in the facts given above - no generic filler like "keep training." Be direct about the weakest discipline especially, since the plan will prioritize it.`

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
            swim: { type: Type.STRING },
            bike: { type: Type.STRING },
            run: { type: Type.STRING },
          },
          required: ['swim', 'bike', 'run'],
        },
      },
    })

    const parsed = JSON.parse(response.text ?? '{}')
    if (typeof parsed.swim !== 'string' || typeof parsed.bike !== 'string' || typeof parsed.run !== 'string') {
      throw new Error('Malformed model response')
    }

    const disciplineWeakness = {
      order: ranking.order,
      notes: { swim: parsed.swim, bike: parsed.bike, run: parsed.run },
      generatedAt: new Date().toISOString(),
    }

    const { error: updateError } = await supabase.from('races').update({ discipline_weakness: disciplineWeakness }).eq('id', raceId)
    if (updateError) {
      console.error('Error saving discipline weakness analysis:', updateError)
      return NextResponse.json({ status: 'error', error: 'Failed to save analysis' }, { status: 500 })
    }

    return NextResponse.json({ status: 'ok', disciplineWeakness })
  } catch (err) {
    console.error('Discipline weakness analysis failed:', err)
    return NextResponse.json({ status: 'error', error: 'Failed to analyze disciplines' }, { status: 502 })
  }
}
