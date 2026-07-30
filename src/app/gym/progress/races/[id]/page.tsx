'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Flag, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { raceTypeLabel, RACE_TYPE_DISTANCE, type RaceType } from '@/lib/race-constants'
import { getLocalDateString, getLocalWeekStart } from '@/lib/date'
import { daysBetween } from '@/lib/goals'
import { fetchCardioActivity } from '@/lib/cardio-stats'
import { analyzeCurrentFitness, type FitnessSnapshot } from '@/lib/race-plan/analyze-fitness'
import type { RaceApproach, TrainingPhase } from '@/lib/race-plan/periodization'

type Race = {
  id: string
  race_type: RaceType
  courseOrLocation: string | null
  race_date: string
}

type PlanWeek = {
  weekStartDate: string
  phase: TrainingPhase
  targetCardioKm: number
  targetCardioSessions: number
  targetStrengthSessions: number
  focusNote: string
}

type Plan = {
  approach: RaceApproach
  overview: string
  weeks: PlanWeek[]
}

type CurrentWeekActual = { cardioKm: number; strengthSessions: number }

const PHASE_LABELS: Record<TrainingPhase, string> = {
  base: 'Base',
  build: 'Build',
  peak: 'Peak',
  taper: 'Taper',
}

function formatWeekDate(dateString: string): string {
  return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function RaceDetailPage() {
  const params = useParams()
  const raceId = params.id as string
  const supabase = createClient()

  const [race, setRace] = useState<Race | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [snapshot, setSnapshot] = useState<FitnessSnapshot | null>(null)
  const [currentWeekActual, setCurrentWeekActual] = useState<CurrentWeekActual | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [approach, setApproach] = useState<RaceApproach>('balanced')
  const [manualRegenerate, setManualRegenerate] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  useEffect(() => {
    fetchAll()
  }, [raceId])

  useEffect(() => {
    if (plan) computeCurrentWeekActual()
  }, [plan])

  const fetchAll = async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const [{ data: raceRow }, { data: planRow }] = await Promise.all([
      supabase.from('races').select('id, race_type, course_id, location, race_date').eq('id', raceId).eq('user_id', user.id).maybeSingle(),
      supabase.from('race_training_plans').select('approach, overview, weeks').eq('race_id', raceId).maybeSingle(),
    ])

    if (!raceRow) {
      setNotFound(true)
      setLoading(false)
      return
    }

    let courseName: string | null = null
    if (raceRow.course_id) {
      const { data: course } = await supabase.from('race_courses').select('name').eq('id', raceRow.course_id).maybeSingle()
      courseName = course?.name ?? null
    }
    setRace({ id: raceRow.id, race_type: raceRow.race_type, courseOrLocation: courseName ?? raceRow.location, race_date: raceRow.race_date })

    if (planRow) {
      setPlan(planRow as Plan)
      setApproach(planRow.approach)
    }

    const facts = await analyzeCurrentFitness(supabase, user.id)
    setSnapshot(facts)
    setLoading(false)
  }

  const computeCurrentWeekActual = async () => {
    const weekStart = getLocalWeekStart()
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const activities = await fetchCardioActivity(supabase)
    const cardioKm = activities
      .filter((a) => {
        const d = new Date(a.date)
        return d >= weekStart && d < weekEnd
      })
      .reduce((sum, a) => sum + a.distanceKm, 0)

    const { data: sets } = await supabase
      .from('sets')
      .select('created_at')
      .eq('completed', true)
      .gte('created_at', weekStart.toISOString())
      .lt('created_at', weekEnd.toISOString())

    const strengthDays = new Set((sets ?? []).map((s: any) => getLocalDateString(new Date(s.created_at)))).size

    setCurrentWeekActual({ cardioKm, strengthSessions: strengthDays })
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setGenerateError(null)

    try {
      const res = await fetch('/api/ai-coach/race-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raceId, approach }),
      })
      const data = await res.json()

      if (data.status === 'ok') {
        setPlan(data.plan)
        setManualRegenerate(false)
      } else {
        setGenerateError('Could not generate a plan right now — try again later.')
      }
    } catch (err) {
      console.error('Error generating race plan:', err)
      setGenerateError('Could not generate a plan right now — try again later.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-white/40">Loading...</div>
        </div>
      </AppLayout>
    )
  }

  if (notFound || !race) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/gym/progress/races" className="text-white/40 hover:text-white/60 transition-colors mb-6 inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Races
          </Link>
          <p className="text-white/40">Race not found.</p>
        </div>
      </AppLayout>
    )
  }

  const today = getLocalDateString()
  const daysUntil = daysBetween(race.race_date, today)
  const currentWeekStartDate = getLocalDateString(getLocalWeekStart())
  const showGenerator = !plan || manualRegenerate

  const weeksByPhase: { phase: TrainingPhase; weeks: PlanWeek[] }[] = []
  if (plan) {
    for (const week of plan.weeks) {
      const group = weeksByPhase.find((g) => g.phase === week.phase)
      if (group) {
        group.weeks.push(week)
      } else {
        weeksByPhase.push({ phase: week.phase, weeks: [week] })
      }
    }
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/gym/progress/races" className="text-white/40 hover:text-white/60 transition-colors mb-6 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Races
        </Link>

        <div className="flex items-center gap-4 mb-8 mt-6">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <Flag className="w-8 h-8 text-white/80" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">
              {raceTypeLabel(race.race_type)}
              {race.courseOrLocation && <span className="text-white/40"> · {race.courseOrLocation}</span>}
            </h1>
            <p className="text-white/50 text-sm">
              {new Date(race.race_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {' — '}
              {daysUntil > 0 ? `${daysUntil} days away` : daysUntil === 0 ? 'Today' : `${Math.abs(daysUntil)} days ago`}
            </p>
            {RACE_TYPE_DISTANCE[race.race_type] && <p className="text-white/30 text-xs mt-1">{RACE_TYPE_DISTANCE[race.race_type]}</p>}
          </div>
        </div>

        {plan && !showGenerator && (
          <div className="space-y-8 mb-10">
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-3">
                <h2 className="text-lg font-medium text-white">
                  Training Plan <span className="text-white/40 text-sm font-normal">({plan.approach === 'full_send' ? 'Full send' : 'Balanced'})</span>
                </h2>
                <button
                  onClick={() => setManualRegenerate(true)}
                  className="text-sm text-white/40 hover:text-white/60 transition-colors"
                >
                  Regenerate Plan
                </button>
              </div>
              <p className="text-white/70 text-sm leading-relaxed">{plan.overview}</p>
            </div>

            {weeksByPhase.map((group) => (
              <div key={group.phase}>
                <h3 className="text-sm font-medium text-white/60 mb-3">{PHASE_LABELS[group.phase]} Phase</h3>
                <div className="grid gap-3">
                  {group.weeks.map((week) => {
                    const isCurrentWeek = week.weekStartDate === currentWeekStartDate
                    return (
                      <div
                        key={week.weekStartDate}
                        className={`border rounded-2xl p-6 transition-all duration-200 ${
                          isCurrentWeek ? 'border-white/25 bg-white/[0.05]' : 'border-white/10 bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">Week of {formatWeekDate(week.weekStartDate)}</span>
                            {isCurrentWeek && (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-white text-black">This Week</span>
                            )}
                          </div>
                          <div className="flex gap-4 text-right text-sm">
                            <div>
                              <p className="text-xs text-white/40">Cardio</p>
                              <p className="text-white font-semibold">
                                {isCurrentWeek && currentWeekActual ? `${currentWeekActual.cardioKm.toFixed(1)} / ` : ''}
                                {week.targetCardioKm}km
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-white/40">Sessions</p>
                              <p className="text-white font-semibold">{week.targetCardioSessions} cardio · {week.targetStrengthSessions} strength</p>
                            </div>
                          </div>
                        </div>
                        <p className="text-white/50 text-sm">{week.focusNote}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {showGenerator && (
          <div className="space-y-8">
            {snapshot && (
              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
                <h2 className="text-lg font-medium text-white mb-4">Current Fitness Snapshot</h2>

                <div className="mb-6">
                  <p className="text-white/60 text-sm mb-3">Weekly cardio distance (last 8 weeks)</p>
                  <div className="space-y-2">
                    {snapshot.cardio.weeklyDistanceKm.map((km, i) => {
                      const max = Math.max(...snapshot.cardio.weeklyDistanceKm, 1)
                      return (
                        <div key={i} className="w-full bg-white/10 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-white transition-all duration-300" style={{ width: `${(km / max) * 100}%` }} />
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-white/40 text-xs mt-2">
                    Averaging {snapshot.cardio.recentAvgWeeklyKm.toFixed(1)}km/week across {snapshot.cardio.recentAvgSessionsPerWeek.toFixed(1)} sessions/week recently, active {snapshot.cardio.weeksActive}/8 weeks. Longest recent session: {snapshot.cardio.longestSessionKm}km.
                  </p>
                </div>

                {snapshot.strength.muscleGroupTrends.length > 0 && (
                  <div className="mb-6">
                    <p className="text-white/60 text-sm mb-3">Strength trend (best est. 1RM, last 6 weeks vs. prior 6)</p>
                    <div className="flex flex-wrap gap-2">
                      {snapshot.strength.muscleGroupTrends.map((t) => (
                        <span key={t.muscleGroup} className="px-3 py-1.5 rounded-full text-xs bg-white/5 text-white/60 border border-white/10">
                          {t.muscleGroup}: {t.currentBestEst1RM}kg ({t.trend})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-white/40 text-xs">
                  Consistency (last 90 days): {snapshot.gymConsistencyWeeks} weeks with gym activity, {snapshot.nutritionConsistencyWeeks} weeks with nutrition logged.
                  {snapshot.trainingPhase && ` Current training phase: ${snapshot.trainingPhase} (${snapshot.trainingIntensity}).`}
                  {snapshot.competingGoalsCount > 0 && ` ${snapshot.competingGoalsCount} other active goal(s).`}
                </p>
              </div>
            )}

            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
              <h2 className="text-lg font-medium text-white mb-1">Approach</h2>
              <p className="text-white/40 text-sm mb-4">Choose how much this race should take over your training.</p>
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setApproach('full_send')}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    approach === 'full_send' ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  Full Send
                </button>
                <button
                  onClick={() => setApproach('balanced')}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    approach === 'balanced' ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  Balanced
                </button>
              </div>

              <Button onClick={handleGenerate} disabled={generating} className="w-full bg-white text-black hover:bg-white/90">
                {generating ? 'Generating...' : plan ? 'Regenerate Plan' : 'Generate Plan'}
              </Button>
              {generateError && <p className="text-sm text-red-400 mt-2">{generateError}</p>}
              {plan && (
                <button onClick={() => setManualRegenerate(false)} className="text-sm text-white/40 hover:text-white/60 transition-colors mt-3">
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
