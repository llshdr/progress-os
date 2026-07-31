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
import {
  RACE_APPROACH_LABELS,
  describeStrengthEmphasis,
  describeMuscleImpact,
  type RaceApproach,
  type TrainingPhase,
  type DisciplineTarget,
} from '@/lib/race-plan/periodization'
import {
  emptySelfAssessmentFor,
  normalizeSelfAssessment,
  raceCategoryFor,
  type SelfAssessment,
  type SimpleSelfAssessment,
  type MultisportSelfAssessment,
  type Discipline,
} from '@/lib/race-plan/self-assessment'
import { computeTensionFlags } from '@/lib/race-plan/tension'
import { estimateProjectedFinishSeconds, assessGoalRealism } from '@/lib/race-plan/finish-time'
import {
  computeDisciplineActivityFacts,
  assessMultisportReadiness,
  disciplineWeightsFromRanking,
  type DisciplineActivityFacts,
} from '@/lib/race-plan/discipline-weakness'
import SelfAssessmentForm from '@/components/races/self-assessment-form'
import MultisportSelfAssessmentForm from '@/components/races/multisport-self-assessment-form'
import ApproachSpectrum from '@/components/races/approach-spectrum'

type Race = {
  id: string
  race_type: RaceType
  courseOrLocation: string | null
  race_date: string
}

type PlanWeek = {
  weekStartDate: string
  phase: TrainingPhase
  disciplines: { swim: DisciplineTarget; bike: DisciplineTarget; run: DisciplineTarget } | null
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

type DisciplineWeakness = { order: Discipline[]; notes: Record<Discipline, string> }

type Step = 'confirm' | 'assessment' | 'weakness' | 'snapshot' | 'spectrum' | 'review'

const STEP_LABELS: Record<Step, string> = {
  confirm: 'Confirm',
  assessment: 'Assessment',
  weakness: 'Analysis',
  snapshot: 'Snapshot',
  spectrum: 'Approach',
  review: 'Review',
}

const PHASE_LABELS: Record<TrainingPhase, string> = {
  base: 'Base',
  build: 'Build',
  peak: 'Peak',
  taper: 'Taper',
}

const DISCIPLINE_LABELS: Record<Discipline, string> = { swim: 'Swim', bike: 'Bike', run: 'Run' }

function formatWeekDate(dateString: string): string {
  return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

export default function RaceDetailPage() {
  const params = useParams()
  const raceId = params.id as string
  const supabase = createClient()

  const [race, setRace] = useState<Race | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [snapshot, setSnapshot] = useState<FitnessSnapshot | null>(null)
  const [disciplineActivityFacts, setDisciplineActivityFacts] = useState<Record<Discipline, DisciplineActivityFacts> | null>(null)
  const [currentWeekActual, setCurrentWeekActual] = useState<CurrentWeekActual | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [step, setStep] = useState<Step>('confirm')

  const [selfAssessment, setSelfAssessment] = useState<SelfAssessment>(emptySelfAssessmentFor('other'))
  const [disciplineWeakness, setDisciplineWeakness] = useState<DisciplineWeakness | null>(null)
  const [assessmentError, setAssessmentError] = useState<string | null>(null)
  const [weaknessLoading, setWeaknessLoading] = useState(false)

  const [approach, setApproach] = useState<RaceApproach>('balanced')
  const [targetFinishSeconds, setTargetFinishSeconds] = useState<number | null>(null)
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
      supabase
        .from('races')
        .select('id, race_type, course_id, location, race_date, self_assessment, target_finish_seconds, discipline_weakness')
        .eq('id', raceId)
        .eq('user_id', user.id)
        .maybeSingle(),
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
    const raceType = raceRow.race_type as RaceType
    setRace({ id: raceRow.id, race_type: raceType, courseOrLocation: courseName ?? raceRow.location, race_date: raceRow.race_date })

    const category = raceCategoryFor(raceType)
    setSelfAssessment(normalizeSelfAssessment(raceRow.self_assessment, category))
    setTargetFinishSeconds(raceRow.target_finish_seconds ?? null)
    setDisciplineWeakness(raceRow.discipline_weakness ?? null)

    if (category === 'multisport') {
      setDisciplineActivityFacts(await computeDisciplineActivityFacts(supabase))
    }

    if (planRow) {
      setPlan(planRow as Plan)
      setApproach(planRow.approach)
      setStep('review')
    }

    const facts = await analyzeCurrentFitness(supabase, user.id, raceId)
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

  const handleAssessmentContinue = async () => {
    if (category !== 'multisport') {
      setStep('snapshot')
      return
    }

    const ms = selfAssessment as MultisportSelfAssessment
    if (ms.swim.comfortLevel == null || ms.bike.comfortLevel == null || ms.run.comfortLevel == null) {
      setAssessmentError('Please rate your comfort level for all three disciplines to continue.')
      return
    }
    setAssessmentError(null)

    await supabase.from('races').update({ self_assessment: selfAssessment }).eq('id', raceId)

    setWeaknessLoading(true)
    try {
      const res = await fetch('/api/ai-coach/race-weakness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raceId }),
      })
      const data = await res.json()
      if (data.status === 'ok') {
        setDisciplineWeakness(data.disciplineWeakness)
        setStep('weakness')
      } else {
        // Resilience: don't hard-block the flow if analysis fails.
        setStep('snapshot')
      }
    } catch (err) {
      console.error('Error analyzing discipline weakness:', err)
      setStep('snapshot')
    } finally {
      setWeaknessLoading(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setGenerateError(null)

    try {
      await supabase.from('races').update({ self_assessment: selfAssessment, target_finish_seconds: targetFinishSeconds }).eq('id', raceId)

      const res = await fetch('/api/ai-coach/race-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raceId, approach }),
      })
      const data = await res.json()

      if (data.status === 'ok') {
        setPlan(data.plan)
        setStep('review')
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
  const category = raceCategoryFor(race.race_type)
  const tensionFlags = snapshot ? computeTensionFlags(selfAssessment, snapshot) : []
  const projectedFinishSeconds = snapshot ? estimateProjectedFinishSeconds(race.race_type, snapshot) : null
  const readinessFlags = category === 'multisport' && disciplineActivityFacts ? assessMultisportReadiness(disciplineActivityFacts, daysUntil) : []
  const realismFlag =
    category === 'run' && targetFinishSeconds != null && projectedFinishSeconds != null
      ? assessGoalRealism(targetFinishSeconds, projectedFinishSeconds)
      : null
  const allFlags = [...tensionFlags, ...readinessFlags, ...(realismFlag ? [realismFlag] : [])]

  const disciplineWeights = category === 'multisport' && disciplineWeakness ? disciplineWeightsFromRanking(disciplineWeakness) : undefined

  const stepSequence: Step[] = category === 'multisport' ? ['confirm', 'assessment', 'weakness', 'snapshot', 'spectrum'] : ['confirm', 'assessment', 'snapshot', 'spectrum']

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

  const muscleImpact = snapshot && plan ? describeMuscleImpact(plan.approach, snapshot.strength.recentSessionsPerWeek, snapshot.muscleVolume) : []

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

        {step !== 'review' && (
          <div className="flex flex-wrap items-center gap-1 mb-8 text-xs">
            {stepSequence.map((s, i) => (
              <span key={s} className={step === s ? 'text-white font-medium' : 'text-white/30'}>
                {i + 1}. {STEP_LABELS[s]}
                {i < stepSequence.length - 1 ? <span className="text-white/20 mx-1">·</span> : null}
              </span>
            ))}
          </div>
        )}

        {step === 'confirm' && (
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
            <p className="text-white/60 text-sm mb-4">
              Next, a few questions about your current condition, then a look at your real training data, then you
              choose how this race should shape your training.
            </p>
            <Button onClick={() => setStep('assessment')} className="bg-white text-black hover:bg-white/90">
              Continue
            </Button>
          </div>
        )}

        {step === 'assessment' && (
          <div className="space-y-6">
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
              <h2 className="text-lg font-medium text-white mb-1">How are you feeling right now?</h2>
              <p className="text-white/40 text-sm mb-6">
                {category === 'multisport'
                  ? 'Rate your comfort level for each discipline (required) - everything else is optional and only fills gaps in your logged data.'
                  : 'Every question is optional — this only fills gaps in your logged data, it never replaces it.'}
              </p>
              {category === 'multisport' ? (
                <MultisportSelfAssessmentForm
                  value={selfAssessment as MultisportSelfAssessment}
                  onChange={(v) => {
                    setSelfAssessment(v)
                    setAssessmentError(null)
                  }}
                />
              ) : (
                <SelfAssessmentForm category={category} value={selfAssessment as SimpleSelfAssessment} onChange={setSelfAssessment} />
              )}
            </div>
            {assessmentError && <p className="text-sm text-red-400">{assessmentError}</p>}
            <Button onClick={handleAssessmentContinue} disabled={weaknessLoading} className="bg-white text-black hover:bg-white/90">
              {weaknessLoading ? 'Analyzing...' : 'Continue'}
            </Button>
          </div>
        )}

        {step === 'weakness' && disciplineWeakness && (
          <div className="space-y-6">
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
              <h2 className="text-lg font-medium text-white mb-4">Discipline Analysis</h2>
              <div className="space-y-4">
                {disciplineWeakness.order.map((discipline, i) => (
                  <div key={discipline}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium">{DISCIPLINE_LABELS[discipline]}</span>
                      {i === 0 && <span className="px-2 py-0.5 rounded-full text-xs bg-white text-black">Primary Focus</span>}
                    </div>
                    <p className="text-white/60 text-sm">{disciplineWeakness.notes[discipline]}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('assessment')} className="text-sm text-white/40 hover:text-white/60 transition-colors">
                Back
              </button>
              <Button onClick={() => setStep('snapshot')} className="bg-white text-black hover:bg-white/90">
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'snapshot' && (
          <div className="space-y-6">
            {allFlags.length > 0 && (
              <div className="border border-yellow-500/20 rounded-2xl bg-yellow-500/[0.04] p-4">
                <p className="text-yellow-200/80 text-sm font-medium mb-1">Worth double-checking</p>
                {allFlags.map((flag, i) => (
                  <p key={i} className="text-yellow-200/60 text-xs mt-1">
                    {flag}
                  </p>
                ))}
              </div>
            )}

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

                {snapshot.weightTrend && (
                  <div className="mb-6">
                    <p className="text-white/60 text-sm mb-3">Body weight</p>
                    <p className="text-white/70 text-sm">
                      {snapshot.weightTrend.currentWeightKg}kg currently
                      {snapshot.weightTrend.changeKgLast90Days != null &&
                        ` (${snapshot.weightTrend.changeKgLast90Days >= 0 ? '+' : ''}${snapshot.weightTrend.changeKgLast90Days.toFixed(1)}kg over 90 days)`}
                    </p>
                  </div>
                )}

                {snapshot.pastRaceResults.length > 0 && (
                  <div className="mb-6">
                    <p className="text-white/60 text-sm mb-3">Past race results</p>
                    <div className="space-y-1">
                      {snapshot.pastRaceResults.slice(0, 3).map((r, i) => (
                        <p key={i} className="text-white/70 text-sm">
                          {raceTypeLabel(r.raceType)}
                          {r.courseOrLocation ? ` (${r.courseOrLocation})` : ''} — {r.raceDate}
                        </p>
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

            <div className="flex gap-3">
              <button
                onClick={() => setStep(category === 'multisport' ? 'weakness' : 'assessment')}
                className="text-sm text-white/40 hover:text-white/60 transition-colors"
              >
                Back
              </button>
              <Button onClick={() => setStep('spectrum')} className="bg-white text-black hover:bg-white/90">
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'spectrum' && snapshot && (
          <div className="space-y-6">
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
              <h2 className="text-lg font-medium text-white mb-1">Approach</h2>
              <p className="text-white/40 text-sm mb-6">Choose how much this race should take over your training.</p>
              <ApproachSpectrum
                value={approach}
                onChange={setApproach}
                currentWeeklyCardioKm={snapshot.cardio.recentAvgWeeklyKm}
                currentStrengthSessionsPerWeek={snapshot.strength.recentSessionsPerWeek}
                showFinishTime={category === 'run'}
                projectedFinishSeconds={projectedFinishSeconds}
                targetFinishSeconds={targetFinishSeconds}
                onTargetFinishSecondsChange={setTargetFinishSeconds}
                disciplineWeights={disciplineWeights}
                muscleVolume={snapshot.muscleVolume}
              />

              <Button onClick={handleGenerate} disabled={generating} className="w-full bg-white text-black hover:bg-white/90 mt-6">
                {generating ? 'Generating...' : plan ? 'Regenerate Plan' : 'Generate Plan'}
              </Button>
              {generateError && <p className="text-sm text-red-400 mt-2">{generateError}</p>}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('snapshot')} className="text-sm text-white/40 hover:text-white/60 transition-colors">
                Back
              </button>
              {plan && (
                <button onClick={() => setStep('review')} className="text-sm text-white/40 hover:text-white/60 transition-colors">
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {step === 'review' && plan && snapshot && (
          <div className="space-y-8">
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-3">
                <h2 className="text-lg font-medium text-white">
                  Training Plan <span className="text-white/40 text-sm font-normal">({RACE_APPROACH_LABELS[plan.approach]})</span>
                </h2>
                <div className="flex items-center gap-3">
                  <button onClick={() => setStep('assessment')} className="text-sm text-white/40 hover:text-white/60 transition-colors">
                    Edit my assessment
                  </button>
                  <Button onClick={() => setStep('spectrum')} variant="outline" className="border-white/10 text-white hover:bg-white/5">
                    Regenerate Plan
                  </Button>
                </div>
              </div>
              <p className="text-white/70 text-sm leading-relaxed mb-4">{plan.overview}</p>

              <div className="flex flex-wrap gap-8 pt-4 border-t border-white/10">
                <div>
                  <p className="text-xs text-white/40 mb-1">Strength Emphasis</p>
                  <p className="text-white text-sm">{describeStrengthEmphasis(plan.approach, snapshot.strength.recentSessionsPerWeek)}</p>
                </div>
                {category === 'run' && (targetFinishSeconds != null || projectedFinishSeconds != null) && (
                  <div>
                    <p className="text-xs text-white/40 mb-1">{targetFinishSeconds != null ? 'Target Finish Time' : 'Projected Finish Time'}</p>
                    <p className="text-white text-sm">{formatDuration(targetFinishSeconds ?? projectedFinishSeconds!)}</p>
                  </div>
                )}
              </div>

              {muscleImpact.length > 0 && (
                <div className="pt-4 mt-4 border-t border-white/10">
                  <p className="text-xs text-white/40 mb-2">Muscle Impact</p>
                  <div className="space-y-1">
                    {muscleImpact.map((line) => (
                      <p key={line.muscle} className="text-white/70 text-sm">
                        {line.muscle}: {line.description}
                      </p>
                    ))}
                  </div>
                </div>
              )}
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
                          {week.disciplines ? (
                            <div className="flex gap-4 text-right text-sm flex-wrap justify-end">
                              {(['swim', 'bike', 'run'] as Discipline[]).map((d) => (
                                <div key={d}>
                                  <p className="text-xs text-white/40">{DISCIPLINE_LABELS[d]}</p>
                                  <p className="text-white font-semibold">
                                    {week.disciplines![d].km}km · {week.disciplines![d].sessions}x
                                  </p>
                                </div>
                              ))}
                              <div>
                                <p className="text-xs text-white/40">Strength</p>
                                <p className="text-white font-semibold">{week.targetStrengthSessions}x</p>
                              </div>
                            </div>
                          ) : (
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
                          )}
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
      </div>
    </AppLayout>
  )
}
