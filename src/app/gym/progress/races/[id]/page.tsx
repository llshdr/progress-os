'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Flag, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { raceTypeLabel, RACE_TYPE_DISTANCE, type RaceType } from '@/lib/race-constants'
import { getLocalDateString, getLocalWeekStart } from '@/lib/date'
import { daysBetween } from '@/lib/goals'
import { fetchCardioActivity } from '@/lib/cardio-stats'
import { analyzeCurrentFitness, type FitnessSnapshot } from '@/lib/race-plan/analyze-fitness'
import {
  RACE_APPROACH_LABELS,
  describeStrengthEmphasis,
  describeMuscleImpact,
  sortMuscleImpact,
  STRENGTH_SEQUENCING_NOTES,
  type RaceApproach,
  type TrainingPhase,
  type DisciplineTarget,
} from '@/lib/race-plan/periodization'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { PHASE_NUTRITION_GUIDANCE, assessNutritionPhaseTension } from '@/lib/race-plan/nutrition-phase'
import { deriveCurrentFormLevel } from '@/lib/race-plan/current-form'
import { slotsForWeek, type PhaseTemplate, type PhaseTemplates } from '@/lib/race-plan/day-template'
import PhaseTemplateDialog from '@/components/races/phase-template-dialog'
import WeekDayList from '@/components/races/week-day-list'
import {
  emptySelfAssessmentFor,
  normalizeSelfAssessment,
  raceCategoryFor,
  experienceLevelFor,
  type RaceCategory,
  type SelfAssessment,
  type SimpleSelfAssessment,
  type MultisportSelfAssessment,
  type Discipline,
} from '@/lib/race-plan/self-assessment'
import { computeTensionFlags } from '@/lib/race-plan/tension'
import {
  estimateProjectedFinishSeconds,
  assessGoalRealism,
  estimateCourseFinishRange,
  assessCutoffRisk,
  assessGoalRealismForRange,
  SEGMENT_LABEL,
  type CutoffRiskFlag,
  type ProjectedRaceTimeRange,
} from '@/lib/race-plan/finish-time'
import { computeDisciplineActivityFacts, assessMultisportReadiness, type DisciplineActivityFacts } from '@/lib/race-plan/discipline-weakness'
import {
  fetchCourseProfile,
  fetchCourseTimeBand,
  fetchCourseCutoffs,
  type RaceCourseProfile,
  type RaceCourseTimeBand,
  type RaceCourseCutoff,
} from '@/lib/race-plan/course-data'
import SelfAssessmentForm from '@/components/races/self-assessment-form'
import MultisportSelfAssessmentForm from '@/components/races/multisport-self-assessment-form'
import ApproachSpectrum from '@/components/races/approach-spectrum'
import type { ExperienceLevel } from '@/lib/race-plan/self-assessment'

type Race = {
  id: string
  race_type: RaceType
  courseId: string | null
  courseOrLocation: string | null
  race_date: string
  trainingStartDate: string | null
}

type PlanWeek = {
  weekStartDate: string
  phase: TrainingPhase
  disciplines: { swim: DisciplineTarget; bike: DisciplineTarget; run: DisciplineTarget } | null
  brickSessions: number | null
  targetCardioKm: number
  targetCardioSessions: number
  targetStrengthSessions: number
  focusNote: string
}

type Plan = {
  approach: RaceApproach
  overview: string
  weeks: PlanWeek[]
  phaseTemplates: PhaseTemplates
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

function formatMargin(marginSeconds: number): string {
  return marginSeconds >= 0 ? formatDuration(marginSeconds) : `${formatDuration(Math.abs(marginSeconds))} over`
}

const MARGIN_RISK_COLOR: Record<CutoffRiskFlag['risk'], string> = {
  comfortable: 'text-white',
  watch: 'text-yellow-200',
  risk: 'text-red-300',
}

// Three separately-labeled mini-stats (matching the Swim/Bike/Run/Strength
// stat pattern already used in the week card) instead of one dense
// sentence - "16h projected / 17h cutoff / 1h margin" is easy to misread
// as prose but hard to misread once each number has its own label.
function CutoffMarginRow({ flag, range }: { flag: CutoffRiskFlag; range: ProjectedRaceTimeRange }) {
  const projectedSlowEnd =
    flag.segment === 'overall'
      ? range.totalSecondsHigh
      : flag.segment === 'swim'
        ? (range.swimExitSecondsHigh ?? range.totalSecondsHigh)
        : (range.bikeFinishSecondsHigh ?? range.totalSecondsHigh)

  return (
    <div className="flex items-center gap-6">
      <span className="text-white/40 text-xs w-20 shrink-0 capitalize">{SEGMENT_LABEL[flag.segment]}</span>
      <div>
        <p className="text-xs text-white/40 mb-0.5">Projected (slow)</p>
        <p className="text-white text-sm">{formatDuration(projectedSlowEnd)}</p>
      </div>
      <div>
        <p className="text-xs text-white/40 mb-0.5">Cutoff</p>
        <p className="text-white text-sm">{formatDuration(flag.cutoffSecondsFromStart)}</p>
      </div>
      <div>
        <p className="text-xs text-white/40 mb-0.5">Margin</p>
        <p className={`text-sm font-medium ${MARGIN_RISK_COLOR[flag.risk]}`}>{formatMargin(flag.marginSecondsSlowEnd)}</p>
      </div>
    </div>
  )
}

// Shared between Snapshot and Review (Spectrum shows its own version via
// ApproachSpectrum's props) so the number and its current-form
// explanation - when the tier was re-derived from real recent activity,
// not the frozen self-assessment answer - never drift between steps.
function FinishTimeCard({
  category,
  targetFinishSeconds,
  projectedFinishSeconds,
  courseRange,
  reason,
}: {
  category: RaceCategory
  targetFinishSeconds: number | null
  projectedFinishSeconds: number | null
  courseRange: ProjectedRaceTimeRange | null
  reason: string | null
}) {
  if (category === 'run' && targetFinishSeconds == null && projectedFinishSeconds == null) return null
  if (category === 'multisport' && targetFinishSeconds == null && courseRange == null) return null
  if (category !== 'run' && category !== 'multisport') return null

  const label =
    category === 'run'
      ? targetFinishSeconds != null
        ? 'Target Finish Time'
        : 'Projected Finish Time'
      : targetFinishSeconds != null
        ? 'Target Finish Time'
        : 'Projected Finish Range'

  const value =
    category === 'run'
      ? formatDuration(targetFinishSeconds ?? projectedFinishSeconds!)
      : targetFinishSeconds != null
        ? formatDuration(targetFinishSeconds)
        : `${formatDuration(courseRange!.totalSecondsLow)}–${formatDuration(courseRange!.totalSecondsHigh)}`

  const showingProjection = category === 'multisport' && targetFinishSeconds == null && courseRange != null
  const showsTrainingAssumption = showingProjection && courseRange!.source !== 'exact_course_result'

  return (
    <div>
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className="text-white text-sm">{value}</p>
      {showsTrainingAssumption && (
        <p className="text-white/40 text-xs mt-1 max-w-sm">Assumes you complete the training plan below - not a snapshot of your fitness today.</p>
      )}
      {showingProjection && <p className="text-white/40 text-xs mt-1 max-w-sm">{courseRange!.sourceNote}</p>}
      {reason && <p className="text-white/40 text-xs mt-1 max-w-sm">{reason}</p>}
    </div>
  )
}

// Escalated, hard-to-miss treatment for a real (risk-tier) cutoff margin -
// one severity step up from the yellow "Worth double-checking" box used
// for softer flags. The whole point is that this can't just blend in as
// another line among many; it's the single thing this plan most needs to
// react to.
function CutoffRiskBanner({ flags }: { flags: CutoffRiskFlag[] }) {
  const riskFlags = flags.filter((f) => f.risk === 'risk')
  if (riskFlags.length === 0) return null

  return (
    <div className="border border-red-500/30 rounded-2xl bg-red-500/[0.06] p-4">
      <p className="text-red-300 text-sm font-semibold mb-1">Real cutoff risk</p>
      {riskFlags.map((f) => (
        <p key={f.segment} className="text-red-200/80 text-xs mt-1">
          {f.message}
        </p>
      ))}
    </div>
  )
}

export default function RaceDetailPage() {
  const params = useParams()
  const raceId = params.id as string
  const supabase = createClient()

  const [race, setRace] = useState<Race | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [snapshot, setSnapshot] = useState<FitnessSnapshot | null>(null)
  const [disciplineActivityFacts, setDisciplineActivityFacts] = useState<Record<Discipline, DisciplineActivityFacts> | null>(null)
  const [courseProfile, setCourseProfile] = useState<RaceCourseProfile | null>(null)
  const [courseTimeBands, setCourseTimeBands] = useState<Partial<Record<ExperienceLevel, RaceCourseTimeBand | null>>>({})
  const [courseCutoffs, setCourseCutoffs] = useState<RaceCourseCutoff[]>([])
  const [currentWeekActual, setCurrentWeekActual] = useState<CurrentWeekActual | null>(null)
  // The day-by-day list is the primary way to see "what do I do this
  // week" - expanded by default only for the current week so a
  // multi-month plan stays scannable; every other week can still be
  // peeked at on demand.
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set([getLocalDateString(getLocalWeekStart())]))
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [step, setStep] = useState<Step>('confirm')

  const [selfAssessment, setSelfAssessment] = useState<SelfAssessment>(emptySelfAssessmentFor('other'))
  const [disciplineWeakness, setDisciplineWeakness] = useState<DisciplineWeakness | null>(null)
  const [assessmentError, setAssessmentError] = useState<string | null>(null)
  const [weaknessError, setWeaknessError] = useState<string | null>(null)
  const [weaknessLoading, setWeaknessLoading] = useState(false)

  const [approach, setApproach] = useState<RaceApproach>('balanced')
  // Tracks whether the user has ever manually moved the slider - once
  // true, the cutoff-risk smart default (below) never overrides them
  // again, this session or any future one for this race.
  const [approachTouched, setApproachTouched] = useState(false)
  const [targetFinishSeconds, setTargetFinishSeconds] = useState<number | null>(null)
  const [trainingStartDateInput, setTrainingStartDateInput] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [showCutoffConfirm, setShowCutoffConfirm] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [raceId])

  useEffect(() => {
    if (plan) computeCurrentWeekActual()
  }, [plan])

  // Smart default, not a forced value: if there's a real (risk-tier)
  // cutoff margin and the athlete hasn't touched the approach slider yet,
  // default it toward Race-Leaning instead of Balanced - fully
  // overridable, never re-applied once touched or once a plan exists.
  useEffect(() => {
    if (!race || !snapshot || plan || approachTouched) return
    if (raceCategoryFor(race.race_type) !== 'multisport') return
    const baseline = selfAssessment.kind === 'multisport' ? experienceLevelFor(selfAssessment.pastMultisportExperience) : 'beginner'
    const lvl = deriveCurrentFormLevel(baseline, disciplineActivityFacts).level
    const range = estimateCourseFinishRange(race.race_type, lvl, snapshot.pastRaceResults, race.courseId, courseTimeBands[lvl] ?? null)
    const flags = assessCutoffRisk(range, courseCutoffs)
    if (flags.some((f) => f.risk === 'risk')) setApproach('race_leaning')
  }, [race, snapshot, courseTimeBands, courseCutoffs, plan, approachTouched, selfAssessment, disciplineActivityFacts])

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
        .select('id, race_type, course_id, location, race_date, self_assessment, target_finish_seconds, discipline_weakness, training_start_date')
        .eq('id', raceId)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase.from('race_training_plans').select('approach, overview, weeks, phase_templates').eq('race_id', raceId).maybeSingle(),
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
    setRace({
      id: raceRow.id,
      race_type: raceType,
      courseId: raceRow.course_id ?? null,
      courseOrLocation: courseName ?? raceRow.location,
      race_date: raceRow.race_date,
      trainingStartDate: raceRow.training_start_date ?? null,
    })
    setTrainingStartDateInput(raceRow.training_start_date ?? getLocalDateString())

    const category = raceCategoryFor(raceType)
    setSelfAssessment(normalizeSelfAssessment(raceRow.self_assessment, category))
    setTargetFinishSeconds(raceRow.target_finish_seconds ?? null)
    setDisciplineWeakness(raceRow.discipline_weakness ?? null)

    if (category === 'multisport') {
      setDisciplineActivityFacts(await computeDisciplineActivityFacts(supabase))

      if (raceRow.course_id) {
        const courseId = raceRow.course_id as string
        const [profile, beginnerBand, intermediateBand, advancedBand, cutoffs] = await Promise.all([
          fetchCourseProfile(supabase, courseId),
          fetchCourseTimeBand(supabase, courseId, 'beginner'),
          fetchCourseTimeBand(supabase, courseId, 'intermediate'),
          fetchCourseTimeBand(supabase, courseId, 'advanced'),
          fetchCourseCutoffs(supabase, courseId),
        ])
        setCourseProfile(profile)
        setCourseTimeBands({ beginner: beginnerBand, intermediate: intermediateBand, advanced: advancedBand })
        setCourseCutoffs(cutoffs)
      }
    }

    if (planRow) {
      setPlan({ approach: planRow.approach, overview: planRow.overview, weeks: planRow.weeks, phaseTemplates: planRow.phase_templates ?? {} })
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

  const handleConfirmStartDate = async () => {
    await supabase.from('races').update({ training_start_date: trainingStartDateInput }).eq('id', raceId)
    setRace((prev) => (prev ? { ...prev, trainingStartDate: trainingStartDateInput } : prev))
    setStep('assessment')
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
    setWeaknessError(null)

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
        // Must not silently advance - discipline_weakness would stay
        // unset in the DB, and any later Generate/Regenerate would
        // silently fall back to single-discipline mode with no warning
        // (see route.ts's own guard against exactly that).
        setWeaknessError('Discipline analysis failed - this is required for a multisport race before you can continue.')
      }
    } catch (err) {
      console.error('Error analyzing discipline weakness:', err)
      setWeaknessError('Discipline analysis failed - this is required for a multisport race before you can continue.')
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
        setGenerateError(data.error || 'Could not generate a plan right now — try again later.')
      }
    } catch (err) {
      console.error('Error generating race plan:', err)
      setGenerateError('Could not generate a plan right now — try again later.')
    } finally {
      setGenerating(false)
    }
  }

  const handleTemplateSaved = (phase: TrainingPhase, updated: PhaseTemplate) => {
    setPlan((prev) => (prev ? { ...prev, phaseTemplates: { ...prev.phaseTemplates, [phase]: updated } } : prev))
  }

  const toggleWeekExpanded = (weekStartDate: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev)
      if (next.has(weekStartDate)) next.delete(weekStartDate)
      else next.add(weekStartDate)
      return next
    })
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
  const baselineLevel: ExperienceLevel = category === 'multisport' && selfAssessment.kind === 'multisport' ? experienceLevelFor(selfAssessment.pastMultisportExperience) : 'beginner'
  // Re-derived from real, sustained recent activity rather than trusting
  // the self-report forever - see current-form.ts. Only ever affects
  // this always-fresh display (and a future, explicitly-triggered
  // Generate/Regenerate) - never an already-generated plan's stored
  // numbers.
  const currentForm = deriveCurrentFormLevel(baselineLevel, disciplineActivityFacts)
  const level = currentForm.level
  const tensionFlags = snapshot ? computeTensionFlags(selfAssessment, snapshot) : []
  const projectedFinishSeconds = snapshot ? estimateProjectedFinishSeconds(race.race_type, snapshot) : null
  const courseRange =
    category === 'multisport' && snapshot
      ? estimateCourseFinishRange(race.race_type, level, snapshot.pastRaceResults, race.courseId, courseTimeBands[level] ?? null)
      : null
  const cutoffRiskFlags: CutoffRiskFlag[] = courseRange ? assessCutoffRisk(courseRange, courseCutoffs) : []
  const hasCutoffRisk = cutoffRiskFlags.some((f) => f.risk === 'risk')
  const readinessFlags = category === 'multisport' && disciplineActivityFacts ? assessMultisportReadiness(disciplineActivityFacts, daysUntil) : []
  const realismFlag =
    category === 'run' && targetFinishSeconds != null && projectedFinishSeconds != null
      ? assessGoalRealism(targetFinishSeconds, projectedFinishSeconds)
      : category === 'multisport' && targetFinishSeconds != null && courseRange != null
        ? assessGoalRealismForRange(targetFinishSeconds, courseRange)
        : null
  const allFlags = [...tensionFlags, ...readinessFlags, ...cutoffRiskFlags.map((f) => f.message), ...(realismFlag ? [realismFlag] : [])]

  const disciplineInputs =
    category === 'multisport' && disciplineWeakness && disciplineActivityFacts
      ? { activityFacts: disciplineActivityFacts, order: disciplineWeakness.order, level, hasCutoffRisk }
      : undefined

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

  const muscleImpact = snapshot && plan ? sortMuscleImpact(describeMuscleImpact(plan.approach, snapshot.strength.recentSessionsPerWeek, snapshot.muscleVolume)) : []

  // plan.weeks is a fixed snapshot from generation time - find the week
  // matching today's date rather than assuming weeks[0], which is only
  // "current" right after generation.
  const currentPlanPhase = plan?.weeks.find((w) => w.weekStartDate === currentWeekStartDate)?.phase ?? null
  const nutritionTensionFlag =
    currentPlanPhase && snapshot
      ? assessNutritionPhaseTension(currentPlanPhase, snapshot.trainingPhase, snapshot.trainingIntensity, snapshot.maintenanceCalories)
      : null

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
            <div className="space-y-2 mb-6 max-w-xs">
              <Label htmlFor="training-start-date" className="text-white/80">
                When do you want to start training?
              </Label>
              <Input
                id="training-start-date"
                type="date"
                value={trainingStartDateInput}
                min={today}
                max={race.race_date}
                onChange={(e) => setTrainingStartDateInput(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
              <p className="text-white/40 text-xs">Defaults to today - the plan's week-by-week schedule is built from whichever date you pick.</p>
            </div>
            <Button onClick={handleConfirmStartDate} className="bg-white text-black hover:bg-white/90">
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
                    setWeaknessError(null)
                  }}
                />
              ) : (
                <SelfAssessmentForm category={category} value={selfAssessment as SimpleSelfAssessment} onChange={setSelfAssessment} />
              )}
            </div>
            {assessmentError && <p className="text-sm text-red-400">{assessmentError}</p>}
            {weaknessError && <p className="text-sm text-red-400">{weaknessError}</p>}
            <Button onClick={handleAssessmentContinue} disabled={weaknessLoading} className="bg-white text-black hover:bg-white/90">
              {weaknessLoading ? 'Analyzing...' : weaknessError ? 'Retry analysis' : 'Continue'}
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
            <CutoffRiskBanner flags={cutoffRiskFlags} />

            {(category === 'run' || category === 'multisport') && (
              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
                <FinishTimeCard
                  category={category}
                  targetFinishSeconds={targetFinishSeconds}
                  projectedFinishSeconds={projectedFinishSeconds}
                  courseRange={courseRange}
                  reason={currentForm.reason}
                />
              </div>
            )}

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

            {(courseProfile || cutoffRiskFlags.length > 0) && (
              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
                <h2 className="text-lg font-medium text-white mb-3">About This Course</h2>
                {courseProfile && (
                  <div className="space-y-1">
                    {courseProfile.swimNotes && <p className="text-white/70 text-sm">Swim: {courseProfile.swimNotes}</p>}
                    {courseProfile.bikeNotes && <p className="text-white/70 text-sm">Bike: {courseProfile.bikeNotes}</p>}
                    {courseProfile.runNotes && <p className="text-white/70 text-sm">Run: {courseProfile.runNotes}</p>}
                  </div>
                )}
                {cutoffRiskFlags.length > 0 && courseRange && (
                  <div className={courseProfile ? 'mt-4 pt-4 border-t border-white/10 space-y-3' : 'space-y-3'}>
                    <p className="text-white/40 text-xs">Cutoff safety margin</p>
                    {cutoffRiskFlags.map((f) => (
                      <CutoffMarginRow key={f.segment} flag={f} range={courseRange} />
                    ))}
                  </div>
                )}
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
            <CutoffRiskBanner flags={cutoffRiskFlags} />

            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
              <h2 className="text-lg font-medium text-white mb-1">Approach</h2>
              <p className="text-white/40 text-sm mb-6">Choose how much this race should take over your training.</p>
              <ApproachSpectrum
                value={approach}
                onChange={(v) => {
                  setApproach(v)
                  setApproachTouched(true)
                }}
                currentWeeklyCardioKm={snapshot.cardio.recentAvgWeeklyKm}
                currentStrengthSessionsPerWeek={snapshot.strength.recentSessionsPerWeek}
                showFinishTime={category === 'run' || courseRange != null}
                projectedFinishSeconds={projectedFinishSeconds}
                projectedFinishRange={courseRange ? { low: courseRange.totalSecondsLow, high: courseRange.totalSecondsHigh } : null}
                finishRangeSource={courseRange?.source ?? null}
                finishRangeSourceNote={courseRange?.sourceNote ?? null}
                targetFinishSeconds={targetFinishSeconds}
                onTargetFinishSecondsChange={setTargetFinishSeconds}
                disciplineInputs={disciplineInputs}
                muscleVolume={snapshot.muscleVolume}
                currentFormReason={currentForm.reason}
              />

              <Button
                onClick={() => {
                  if (hasCutoffRisk && (approach === 'muscle_leaning' || approach === 'muscle_focused')) {
                    setShowCutoffConfirm(true)
                  } else {
                    handleGenerate()
                  }
                }}
                disabled={generating || (category === 'multisport' && !disciplineWeakness)}
                className="w-full bg-white text-black hover:bg-white/90 mt-6"
              >
                {generating ? 'Generating...' : plan ? 'Regenerate Plan' : 'Generate Plan'}
              </Button>
              {category === 'multisport' && !disciplineWeakness && (
                <p className="text-sm text-red-400 mt-2">
                  Discipline analysis is missing for this race - go back and complete the assessment step before generating a plan.
                </p>
              )}
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
            <CutoffRiskBanner flags={cutoffRiskFlags} />

            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-3">
                <h2 className="text-lg font-medium text-white">
                  Training Plan <span className="text-white/40 text-sm font-normal">({RACE_APPROACH_LABELS[plan.approach]})</span>
                </h2>
                <div className="flex items-center gap-3">
                  <button onClick={() => setStep('confirm')} className="text-sm text-white/40 hover:text-white/60 transition-colors">
                    Edit start date
                  </button>
                  <button onClick={() => setStep('assessment')} className="text-sm text-white/40 hover:text-white/60 transition-colors">
                    Edit my assessment
                  </button>
                  <Button onClick={() => setStep('spectrum')} variant="outline" className="border-white/10 text-white hover:bg-white/5">
                    Regenerate Plan
                  </Button>
                </div>
              </div>
              {race.trainingStartDate && race.trainingStartDate > today && (
                <p className="text-white/40 text-xs mb-3">
                  Training starts {new Date(race.trainingStartDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
                  {daysBetween(race.trainingStartDate, today)} days from now.
                </p>
              )}
              <p className="text-white/70 text-sm leading-relaxed mb-4">{plan.overview}</p>

              <div className="flex flex-wrap gap-8 pt-4 border-t border-white/10">
                <div>
                  <p className="text-xs text-white/40 mb-1">Strength Emphasis</p>
                  <p className="text-white text-sm">{describeStrengthEmphasis(plan.approach, snapshot.strength.recentSessionsPerWeek)}</p>
                </div>
                <FinishTimeCard
                  category={category}
                  targetFinishSeconds={targetFinishSeconds}
                  projectedFinishSeconds={projectedFinishSeconds}
                  courseRange={courseRange}
                  reason={currentForm.reason}
                />
              </div>

              {cutoffRiskFlags.length > 0 && courseRange && (
                <div className="pt-4 mt-4 border-t border-white/10 space-y-3">
                  <p className="text-xs text-white/40">Cutoff safety margin</p>
                  {cutoffRiskFlags.map((f) => (
                    <CutoffMarginRow key={f.segment} flag={f} range={courseRange} />
                  ))}
                </div>
              )}

              {muscleImpact.length > 0 && (
                <div className="pt-4 mt-4 border-t border-white/10">
                  <p className="text-xs text-white/40 mb-2">Muscle Impact</p>
                  <div className="flex flex-wrap gap-2">
                    {muscleImpact.map((line) => (
                      <span
                        key={line.muscle}
                        title={line.description}
                        className="px-3 py-1.5 rounded-full text-xs bg-white/5 text-white/60 border border-white/10"
                      >
                        {line.muscle}: {line.shortLabel}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {nutritionTensionFlag && (
                <div className="mt-4 border border-yellow-500/20 rounded-2xl bg-yellow-500/[0.04] p-4">
                  <p className="text-yellow-200/80 text-sm font-medium mb-1">Worth double-checking</p>
                  <p className="text-yellow-200/60 text-xs">{nutritionTensionFlag}</p>
                </div>
              )}
            </div>

            {weeksByPhase.map((group) => (
              <div key={group.phase}>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-sm font-medium text-white/60">{PHASE_LABELS[group.phase]} Phase</h3>
                  {plan.phaseTemplates[group.phase] && (
                    <PhaseTemplateDialog
                      raceId={raceId}
                      phase={group.phase}
                      template={plan.phaseTemplates[group.phase]!}
                      allTemplates={plan.phaseTemplates}
                      weeksInPhase={group.weeks}
                      onSaved={(updated) => handleTemplateSaved(group.phase, updated)}
                    />
                  )}
                </div>
                <p className="text-white/40 text-xs mb-1">{STRENGTH_SEQUENCING_NOTES[group.phase]}</p>
                <p className="text-white/40 text-xs mb-3">{PHASE_NUTRITION_GUIDANCE[group.phase]}</p>
                <div className="grid gap-3">
                  {group.weeks.map((week, weekIndex) => {
                    const isCurrentWeek = week.weekStartDate === currentWeekStartDate
                    const phaseTemplate = plan.phaseTemplates[week.phase]
                    const isExpanded = expandedWeeks.has(week.weekStartDate)
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
                            {!!week.brickSessions && (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/60 border border-white/20">
                                {week.brickSessions} brick
                              </span>
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

                        {phaseTemplate && (
                          <>
                            <button
                              onClick={() => toggleWeekExpanded(week.weekStartDate)}
                              className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors mt-3"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              {isExpanded ? 'Hide days' : 'Show days'}
                            </button>
                            {isExpanded && (
                              <WeekDayList slots={slotsForWeek(phaseTemplate, week)} week={week} weekIndexWithinPhase={weekIndex} />
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmationModal
        open={showCutoffConfirm}
        onOpenChange={setShowCutoffConfirm}
        title="This approach may not close your cutoff gap"
        description="Your projected pace is a real risk against the cutoff at this course, and a muscle-leaning/muscle-focused approach doesn't push training toward closing that gap. Generate the plan anyway?"
        confirmText="Generate anyway"
        onConfirm={handleGenerate}
      />
    </AppLayout>
  )
}
