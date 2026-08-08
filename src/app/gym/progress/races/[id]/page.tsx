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
import { fetchCardioActivity, type CardioActivity } from '@/lib/cardio-stats'
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
import { deriveCurrentFormLevel, deriveRunFormEvidence, TIER_ORDER } from '@/lib/race-plan/current-form'
import { slotsForWeek, ZONE_GUIDANCE, thresholdPaceHint, type PhaseTemplate, type PhaseTemplates } from '@/lib/race-plan/day-template'
import {
  FUELING_GUIDANCE,
  TRANSITION_GUIDANCE,
  RACE_DAY_CHECKPOINTS,
  summarizeSeasonMismatch,
  ACCLIMATION_GUIDANCE,
} from '@/lib/race-plan/race-day-prep'
import { DISRUPTION_GUIDANCE } from '@/lib/disruptions'
import { suggestMilestoneSessions } from '@/lib/race-plan/milestone-sessions'
import { TYPE_LABEL } from '@/components/races/day-slot-display'
import PhaseTemplateDialog from '@/components/races/phase-template-dialog'
import WeekDayList from '@/components/races/week-day-list'
import RaceChecklistCard from '@/components/races/race-checklist-card'
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
import {
  computeDisciplineActivityFacts,
  assessMultisportReadiness,
  describePaceTrend,
  type DisciplineActivityFacts,
} from '@/lib/race-plan/discipline-weakness'
import { formatPaceForDiscipline } from '@/lib/race-plan/pace-units'
import { resolvePeakPaceTargets, resolveEasyPaceTargets, TYPICAL_TRANSITION_SECONDS } from '@/lib/race-plan/pace-targets'
import { resolveRealZone2Pace, computePaceGaps, describePaceGap, type PaceGap } from '@/lib/race-plan/goal-achievability'
import { assessBenchmarkCompliance, type BenchmarkFlag, type DisruptionRange } from '@/lib/race-plan/benchmark-verification'
import DisruptionDeclaration, { formatDateRange, type TrainingDisruption } from '@/components/disruption-declaration'
import {
  fetchCourseProfile,
  fetchCourseTimeBand,
  fetchCourseCutoffs,
  describeCourseDifficulty,
  type RaceCourseProfile,
  type RaceCourseTimeBand,
  type RaceCourseCutoff,
} from '@/lib/race-plan/course-data'
import SelfAssessmentForm from '@/components/races/self-assessment-form'
import MultisportSelfAssessmentForm from '@/components/races/multisport-self-assessment-form'
import ApproachSpectrum from '@/components/races/approach-spectrum'
import type { ExperienceLevel } from '@/lib/race-plan/self-assessment'
import { PageSkeleton } from '@/components/ui/page-skeleton'

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
  isAcclimation: boolean
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
const TIER_LABELS: Record<ExperienceLevel, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }

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
  comfortable: 'text-lapis-text-primary',
  watch: 'text-lapis-citrine',
  risk: 'text-lapis-garnet',
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
      <span className="text-lapis-text-tertiary text-xs w-20 shrink-0 capitalize">{SEGMENT_LABEL[flag.segment]}</span>
      <div>
        <p className="text-xs text-lapis-text-tertiary mb-0.5">Projected (slow)</p>
        <p className="text-lapis-text-primary text-sm">{formatDuration(projectedSlowEnd)}</p>
      </div>
      <div>
        <p className="text-xs text-lapis-text-tertiary mb-0.5">Cutoff</p>
        <p className="text-lapis-text-primary text-sm">{formatDuration(flag.cutoffSecondsFromStart)}</p>
      </div>
      <div>
        <p className="text-xs text-lapis-text-tertiary mb-0.5">Margin</p>
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
      <p className="text-xs text-lapis-text-tertiary mb-1">{label}</p>
      <p className="text-lapis-text-primary text-sm">{value}</p>
      {showsTrainingAssumption && (
        <p className="text-lapis-text-tertiary text-xs mt-1 max-w-sm">Assumes you complete the training plan below - not a snapshot of your fitness today.</p>
      )}
      {showingProjection && <p className="text-lapis-text-tertiary text-xs mt-1 max-w-sm">{courseRange!.sourceNote}</p>}
      {reason && <p className="text-lapis-text-tertiary text-xs mt-1 max-w-sm">{reason}</p>}
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
    <div className="border border-lapis-garnet/30 rounded-lapis-lg bg-lapis-garnet/[0.06] p-4">
      <p className="text-lapis-garnet text-sm font-semibold mb-1">Real cutoff risk</p>
      {riskFlags.map((f) => (
        <p key={f.segment} className="text-lapis-garnet/80 text-xs mt-1">
          {f.message}
        </p>
      ))}
    </div>
  )
}

// One tier softer than CutoffRiskBanner (amber, not red) - a real,
// actionable adherence issue, not a finish-risk emergency. Includes a
// direct Regenerate action since that's the one corrective step this
// feature ever recommends - never silent auto-replanning.
function BenchmarkComplianceBanner({ flags, onRegenerate }: { flags: BenchmarkFlag[]; onRegenerate: () => void }) {
  if (flags.length === 0) return null

  return (
    <div className="border border-lapis-citrine/30 rounded-lapis-lg bg-lapis-citrine/[0.06] p-4">
      <p className="text-lapis-citrine text-sm font-semibold mb-1">Falling behind plan</p>
      {flags.map((f) => (
        <p key={f.discipline} className="text-lapis-citrine/80 text-xs mt-1">
          {f.message}
        </p>
      ))}
      <button onClick={onRegenerate} className="text-lapis-citrine text-xs font-medium underline underline-offset-2 mt-2 hover:brightness-125 transition-all">
        Regenerate Plan
      </button>
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
  const [cardioActivities, setCardioActivities] = useState<CardioActivity[]>([])
  const [disruptions, setDisruptions] = useState<TrainingDisruption[]>([])
  const [courseProfile, setCourseProfile] = useState<RaceCourseProfile | null>(null)
  const [courseTimeBands, setCourseTimeBands] = useState<Partial<Record<ExperienceLevel, RaceCourseTimeBand | null>>>({})
  const [courseCutoffs, setCourseCutoffs] = useState<RaceCourseCutoff[]>([])
  const [currentWeekActual, setCurrentWeekActual] = useState<CurrentWeekActual | null>(null)
  // The day-by-day list is the primary way to see "what do I do this
  // week" - expanded by default only for the current week so a
  // multi-month plan stays scannable; every other week can still be
  // peeked at on demand.
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set([getLocalDateString(getLocalWeekStart())]))
  // Same idea one level up: a phase can hold up to 52 weeks, so phases
  // themselves collapse to a summary row by default too - only the phase
  // containing the current week starts open. Uses the same touched-flag
  // pattern as approachTouched below (rather than seeding this via a
  // useEffect keyed off plan, which can't run until after the first
  // paint): until the user ever toggles a phase, isPhaseExpanded falls
  // back to "is this the current week's phase," computed fresh every
  // render from data that's already loaded - no flash-of-wrong-state.
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set())
  const [phasesTouched, setPhasesTouched] = useState(false)
  const [milestoneExpanded, setMilestoneExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [step, setStep] = useState<Step>('confirm')
  // Only meaningful once step === 'review' - the wizard steps above stay
  // their own single-column linear flow, untouched by this. Plan/Progress/
  // Prep, not routes: nearly every section here reads from the same large
  // block of derived values computed once after fetch (cutoffRiskFlags,
  // peakPaceTargets, muscleImpact, etc.), so splitting into real routes
  // would mean duplicating all of that per-route or introducing a shared
  // layout/context - an in-page tab, same pattern as Calendar's Day/Week
  // toggle, is the lower-risk fit for "sections of one entity that share
  // one fetch," not "independent features" (Settings/Gym's hub-of-routes
  // pattern is for the latter).
  const [reviewTab, setReviewTab] = useState<'plan' | 'progress' | 'prep'>('plan')

  const [selfAssessment, setSelfAssessment] = useState<SelfAssessment>(emptySelfAssessmentFor('other'))
  const [disciplineWeakness, setDisciplineWeakness] = useState<DisciplineWeakness | null>(null)
  const [openWaterSeasonStartMonth, setOpenWaterSeasonStartMonth] = useState<number | null>(null)
  const [openWaterSeasonEndMonth, setOpenWaterSeasonEndMonth] = useState<number | null>(null)
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

    const [{ data: raceRow }, { data: planRow }, { data: settingsRow }, { data: disruptionRows }] = await Promise.all([
      supabase
        .from('races')
        .select('id, race_type, course_id, location, race_date, self_assessment, target_finish_seconds, discipline_weakness, training_start_date')
        .eq('id', raceId)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase.from('race_training_plans').select('approach, overview, weeks, phase_templates').eq('race_id', raceId).maybeSingle(),
      supabase.from('user_settings').select('open_water_season_start_month, open_water_season_end_month').eq('user_id', user.id).maybeSingle(),
      // User-level, not race-specific - shared across every race the
      // athlete is training for. See migration 057.
      supabase
        .from('training_disruptions')
        .select('id, start_date, end_date, reason, note')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false }),
    ])

    setOpenWaterSeasonStartMonth(settingsRow?.open_water_season_start_month ?? null)
    setOpenWaterSeasonEndMonth(settingsRow?.open_water_season_end_month ?? null)
    setDisruptions(disruptionRows ?? [])

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
      setCardioActivities(await fetchCardioActivity(supabase))
    }

    const facts = await analyzeCurrentFitness(supabase, user.id, raceId)
    setSnapshot(facts)
    setLoading(false)
  }

  const refetchDisruptions = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('training_disruptions')
      .select('id, start_date, end_date, reason, note')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false })
    setDisruptions(data ?? [])
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

  // Self-contained rather than sharing the later currentWeekStartDate
  // const (out of scope this early) - same "compute it fresh, it's cheap"
  // precedent expandedWeeks' own initial state already uses.
  const currentWeekPhaseKey = (): string | null => {
    const week = plan?.weeks.find((w) => w.weekStartDate === getLocalDateString(getLocalWeekStart()))
    return week ? `${week.phase}-${week.isAcclimation}` : null
  }

  const isPhaseExpanded = (key: string): boolean => (phasesTouched ? expandedPhases.has(key) : key === currentWeekPhaseKey())

  const togglePhaseExpanded = (key: string) => {
    // On first-ever toggle, seed the real set from the default (rather
    // than the empty placeholder Set expandedPhases starts as) - without
    // this, clicking to collapse the auto-expanded current phase would
    // instead ADD it to an empty set and read as "explicitly expanded."
    const base = phasesTouched ? expandedPhases : new Set(currentWeekPhaseKey() ? [currentWeekPhaseKey()!] : [])
    const next = new Set(base)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setExpandedPhases(next)
    setPhasesTouched(true)
  }

  if (loading) {
    return (
      <AppLayout>
        <PageSkeleton />
      </AppLayout>
    )
  }

  if (notFound || !race) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/gym/progress/races" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Races
          </Link>
          <p className="text-lapis-text-tertiary">Race not found.</p>
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
  // deriveCurrentFormLevel's tier logic is inherently multisport (LEVEL_PEAK_KM
  // has no single-discipline-running equivalent, and `level` has no numeric
  // consumer for run races) - currentForm.reason for a run race is always
  // its permanent "insufficient... no logged swim/bike/run activity"
  // message, which is both wrong (real logged running is never checked)
  // and nonsensical (mentions disciplines a runner never had). Use the
  // run-specific evidence check instead for that category.
  const currentFormReason = category === 'run' ? (snapshot ? deriveRunFormEvidence(snapshot.cardio).reason : null) : currentForm.reason
  const tensionFlags = snapshot ? computeTensionFlags(selfAssessment, snapshot) : []
  const projectedFinishSeconds = snapshot ? estimateProjectedFinishSeconds(race.race_type, snapshot) : null
  const courseRange =
    category === 'multisport' && snapshot
      ? estimateCourseFinishRange(race.race_type, level, snapshot.pastRaceResults, race.courseId, courseTimeBands[level] ?? null)
      : null

  // Aspirational, clearly-secondary projection: reuses estimateCourseFinishRange
  // verbatim with the NEXT tier up - zero new calculation. Gated on real
  // evidence already existing (not shown before there's anything to
  // project from) and undefined at the top tier (nothing further to show).
  const nextTier = TIER_ORDER[TIER_ORDER.indexOf(currentForm.level) + 1] as ExperienceLevel | undefined
  const aspirationalRange =
    category === 'multisport' && nextTier && snapshot && currentForm.evidence !== 'insufficient'
      ? estimateCourseFinishRange(race.race_type, nextTier, snapshot.pastRaceResults, race.courseId, courseTimeBands[nextTier] ?? null)
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
  // Peak-phase (= race-day) target pace per discipline, derived from the
  // stated goal time when set, else the course band's slow end (same
  // honest-margin basis the rest of this feature already uses) - and
  // the Base-phase baseline each key session ramps from, prioritizing
  // the athlete's own reported comfortableEffort pace, then real logged
  // activity, before falling back to an estimate. See pace-targets.ts.
  const peakPaceTargets = category === 'multisport' ? resolvePeakPaceTargets(race.race_type, targetFinishSeconds, courseRange) : null
  const comfortableEffortByDiscipline =
    category === 'multisport' && selfAssessment.kind === 'multisport'
      ? { swim: selfAssessment.swim.comfortableEffort, bike: selfAssessment.bike.comfortableEffort, run: selfAssessment.run.comfortableEffort }
      : { swim: null, bike: null, run: null }
  const easyPaceTargets = peakPaceTargets ? resolveEasyPaceTargets(peakPaceTargets, comfortableEffortByDiscipline, disciplineActivityFacts) : null

  // Opportunistic threshold-pace proxy per discipline - reuses the
  // athlete's own recentTimeTrial only when its duration fits a real
  // threshold-test window (see thresholdPaceHint in day-template.ts),
  // never a substitute for real protocol-based capture.
  const thresholdPaceHints: Record<Discipline, number | null> | null =
    category === 'multisport' && selfAssessment.kind === 'multisport'
      ? {
          swim: thresholdPaceHint('swim', selfAssessment.swim.recentTimeTrial),
          bike: thresholdPaceHint('bike', selfAssessment.bike.recentTimeTrial),
          run: thresholdPaceHint('run', selfAssessment.run.recentTimeTrial),
        }
      : null

  // Only computed when a stated goal is already flagged as unrealistic in
  // TIME terms (realismFlag) - reuses that same check as the trigger
  // rather than a second comparison, so the pace-terms note and the
  // time-terms note can never disagree about whether there's a real gap.
  const safeCutoffPaceTargets =
    category === 'multisport' && targetFinishSeconds != null && realismFlag && courseRange
      ? resolvePeakPaceTargets(race.race_type, null, courseRange)
      : null

  // Concrete, real-data-grounded companion to realismFlag's qualitative
  // TIME-based check - whenever a goal is actually stated, compares the
  // pace it requires against the athlete's own real logged Zone 2 pace
  // (never a placeholder - see resolveRealZone2Pace), citing the actual
  // gap rather than just flagging "ambitious." Shown regardless of
  // whether realismFlag already fired, since even a modest gap is real
  // information the athlete asked to see.
  const weeksUntilRace = Math.max(0, Math.round(daysUntil / 7))
  const paceGaps: PaceGap[] =
    category === 'multisport' && targetFinishSeconds != null && peakPaceTargets
      ? computePaceGaps(peakPaceTargets, {
          swim: resolveRealZone2Pace(comfortableEffortByDiscipline.swim, disciplineActivityFacts?.swim ?? null),
          bike: resolveRealZone2Pace(comfortableEffortByDiscipline.bike, disciplineActivityFacts?.bike ?? null),
          run: resolveRealZone2Pace(comfortableEffortByDiscipline.run, disciplineActivityFacts?.run ?? null),
        })
      : []

  // Real logged activity vs. this plan's planned key sessions - purely
  // computed at render time from data already fetched, same "no cache
  // table, never silent auto-replanning" precedent as every other flag
  // here. Only meaningful once a plan actually exists. Declared
  // disruptions exclude overlapping weeks entirely (never counted good
  // or bad) - deliberately never passed to deriveCurrentFormLevel, which
  // stays honest to real logged activity regardless of why a gap exists.
  const disruptionRanges: DisruptionRange[] = disruptions.map((d) => ({ startDate: d.start_date, endDate: d.end_date }))
  const benchmarkFlags = plan
    ? assessBenchmarkCompliance(plan, cardioActivities, currentWeekStartDate, category, easyPaceTargets, peakPaceTargets, disruptionRanges)
    : []
  const behindBenchmarkFlags = benchmarkFlags.filter((f) => f.status === 'behind')
  const watchBenchmarkFlags = benchmarkFlags.filter((f) => f.status === 'watch')

  // Small, unobtrusive header indicator only - deliberately not a
  // calendar view or dashboard-wide banner (over-building this wasn't
  // the ask). Fires when a declared disruption is active now or starts
  // within the next 7 days.
  const activeOrUpcomingDisruption = disruptions.find((d) => {
    const start = new Date(d.start_date + 'T00:00:00')
    const end = new Date(d.end_date + 'T00:00:00')
    const horizon = new Date(today + 'T00:00:00')
    horizon.setDate(horizon.getDate() + 7)
    return start <= horizon && end >= new Date(today + 'T00:00:00')
  })

  const allFlags = [
    ...tensionFlags,
    ...readinessFlags,
    ...cutoffRiskFlags.map((f) => f.message),
    ...(realismFlag ? [realismFlag] : []),
    ...watchBenchmarkFlags.map((f) => f.message),
  ]

  const disciplineInputs =
    category === 'multisport' && disciplineWeakness && disciplineActivityFacts
      ? { activityFacts: disciplineActivityFacts, order: disciplineWeakness.order, level, hasCutoffRisk }
      : undefined

  const stepSequence: Step[] = category === 'multisport' ? ['confirm', 'assessment', 'weakness', 'snapshot', 'spectrum'] : ['confirm', 'assessment', 'snapshot', 'spectrum']

  // Acclimation weeks are phase: 'base' underneath (see periodization.ts's
  // TrainingWeekSkeleton.isAcclimation) but grouped separately here so they
  // get their own "Acclimation" heading instead of merging into "Base
  // Phase" - the (phase, isAcclimation) composite key is what keeps them
  // split even though both share the same phase value.
  const weeksByPhase: { phase: TrainingPhase; isAcclimation: boolean; weeks: PlanWeek[] }[] = []
  if (plan) {
    for (const week of plan.weeks) {
      const group = weeksByPhase.find((g) => g.phase === week.phase && g.isAcclimation === week.isAcclimation)
      if (group) {
        group.weeks.push(week)
      } else {
        weeksByPhase.push({ phase: week.phase, isAcclimation: week.isAcclimation, weeks: [week] })
      }
    }
  }

  // Which of this plan's phases actually have a 'key' (long) or brick
  // session worth flagging for intra-workout fueling - reuses the
  // already-computed phase templates rather than estimating session
  // duration from scratch (see race-day-prep.ts's FUELING_GUIDANCE).
  // Deduped by phase (not by weeksByPhase group) since acclimation and
  // real Base share the same underlying phase template - showing "Base:"
  // twice would be a duplicate, not new information.
  const fuelingPhases = Array.from(new Set(weeksByPhase.map((g) => g.phase)))
  const fuelingPhaseSummaries: { phase: TrainingPhase; summary: string }[] = plan
    ? fuelingPhases
        .map((phase) => {
          const template = plan.phaseTemplates[phase]
          if (!template) return null
          const keySlots = template.enduranceSlots.filter((s) => s.role === 'key')
          if (keySlots.length === 0 && template.brickDays.length === 0) return null
          const parts: string[] = keySlots.map((s) => `${TYPE_LABEL[s.type]} key session`)
          if (template.brickDays.length > 0) parts.push(`${template.brickDays.length} brick session(s)`)
          return { phase, summary: parts.join(', ') }
        })
        .filter((s): s is { phase: TrainingPhase; summary: string } => s != null)
    : []

  const seasonMismatchNote =
    category === 'multisport' && plan ? summarizeSeasonMismatch(plan.weeks, openWaterSeasonStartMonth, openWaterSeasonEndMonth) : null

  // Informational only - never mutates plan.weeks/phaseTemplates. Only
  // ever offered (and only ever opt-in, via milestoneExpanded) for a
  // long-runway multisport plan - see MIN_WEEKS_FOR_MILESTONE.
  const milestoneSuggestions = plan ? suggestMilestoneSessions(race.race_type, category, plan.weeks) : null

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
        <Link href="/gym/progress/races" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Races
        </Link>

        <div className="flex items-center gap-4 mb-8 mt-6">
          <div className="p-3 rounded-lapis-lg bg-lapis-surface-2 border border-lapis-border-subtle">
            <Flag className="w-8 h-8 text-lapis-text-secondary" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-1">
              {raceTypeLabel(race.race_type)}
              {race.courseOrLocation && <span className="text-lapis-text-tertiary"> · {race.courseOrLocation}</span>}
            </h1>
            <p className="text-lapis-text-tertiary text-sm">
              {new Date(race.race_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {' — '}
              {daysUntil > 0 ? `${daysUntil} days away` : daysUntil === 0 ? 'Today' : `${Math.abs(daysUntil)} days ago`}
            </p>
            {RACE_TYPE_DISTANCE[race.race_type] && <p className="text-lapis-text-disabled text-xs mt-1">{RACE_TYPE_DISTANCE[race.race_type]}</p>}
          </div>
        </div>

        {step !== 'review' && (
          <div className="flex flex-wrap items-center gap-1 mb-8 text-xs">
            {stepSequence.map((s, i) => (
              <span key={s} className={step === s ? 'text-lapis-text-primary font-medium' : 'text-lapis-text-disabled'}>
                {i + 1}. {STEP_LABELS[s]}
                {i < stepSequence.length - 1 ? <span className="text-lapis-text-disabled mx-1">·</span> : null}
              </span>
            ))}
          </div>
        )}

        {step === 'confirm' && (
          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
            <p className="text-lapis-text-secondary text-sm mb-4">
              Next, a few questions about your current condition, then a look at your real training data, then you
              choose how this race should shape your training.
            </p>
            <div className="space-y-2 mb-6 max-w-xs">
              <Label htmlFor="training-start-date" className="text-lapis-text-secondary">
                When do you want to start training?
              </Label>
              <Input
                id="training-start-date"
                type="date"
                value={trainingStartDateInput}
                min={today}
                max={race.race_date}
                onChange={(e) => setTrainingStartDateInput(e.target.value)}
                className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary"
              />
              <p className="text-lapis-text-tertiary text-xs">Defaults to today - the plan's week-by-week schedule is built from whichever date you pick.</p>
            </div>
            <Button onClick={handleConfirmStartDate} className="bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110">
              Continue
            </Button>
          </div>
        )}

        {step === 'assessment' && (
          <div className="space-y-6">
            <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
              <h2 className="text-lg font-medium text-lapis-text-primary mb-1">How are you feeling right now?</h2>
              <p className="text-lapis-text-tertiary text-sm mb-6">
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
                  disciplineActivityFacts={disciplineActivityFacts}
                />
              ) : (
                <SelfAssessmentForm category={category} value={selfAssessment as SimpleSelfAssessment} onChange={setSelfAssessment} />
              )}
            </div>
            {assessmentError && <p className="text-sm text-lapis-garnet">{assessmentError}</p>}
            {weaknessError && <p className="text-sm text-lapis-garnet">{weaknessError}</p>}
            <Button onClick={handleAssessmentContinue} disabled={weaknessLoading} className="bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110">
              {weaknessLoading ? 'Analyzing...' : weaknessError ? 'Retry analysis' : 'Continue'}
            </Button>
          </div>
        )}

        {step === 'weakness' && disciplineWeakness && (
          <div className="space-y-6">
            <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
              <h2 className="text-lg font-medium text-lapis-text-primary mb-4">Discipline Analysis</h2>
              <div className="space-y-4">
                {disciplineWeakness.order.map((discipline, i) => (
                  <div key={discipline}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lapis-text-primary font-medium">{DISCIPLINE_LABELS[discipline]}</span>
                      {i === 0 && <span className="px-2 py-0.5 rounded-full text-xs bg-lapis-accent-500 text-lapis-text-primary">Primary Focus</span>}
                    </div>
                    <p className="text-lapis-text-secondary text-sm">{disciplineWeakness.notes[discipline]}</p>
                    {(() => {
                      const facts = disciplineActivityFacts?.[discipline]
                      if (!facts) return null
                      const trend = describePaceTrend(facts.avgPaceSecPerKmRecent, facts.avgPaceSecPerKmPrior)
                      if (trend === 'insufficient_data') {
                        return <p className="text-lapis-text-disabled text-xs mt-1">No recent pace trend yet.</p>
                      }
                      return (
                        <p className="text-lapis-text-disabled text-xs mt-1">
                          Pace: {trend} ({formatPaceForDiscipline(facts.avgPaceSecPerKmPrior!, discipline)} →{' '}
                          {formatPaceForDiscipline(facts.avgPaceSecPerKmRecent!, discipline)} over the last 8 weeks)
                        </p>
                      )
                    })()}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('assessment')} className="text-sm text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors">
                Back
              </button>
              <Button onClick={() => setStep('snapshot')} className="bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110">
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'snapshot' && (
          <div className="space-y-6">
            <CutoffRiskBanner flags={cutoffRiskFlags} />

            {(category === 'run' || category === 'multisport') && (
              <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
                <FinishTimeCard
                  category={category}
                  targetFinishSeconds={targetFinishSeconds}
                  projectedFinishSeconds={projectedFinishSeconds}
                  courseRange={courseRange}
                  reason={currentFormReason}
                />
              </div>
            )}

            {allFlags.length > 0 && (
              <div className="border border-lapis-citrine/20 rounded-lapis-lg bg-lapis-citrine/[0.04] p-4">
                <p className="text-lapis-citrine/80 text-sm font-medium mb-1">Worth double-checking</p>
                {allFlags.map((flag, i) => (
                  <p key={i} className="text-lapis-citrine/60 text-xs mt-1">
                    {flag}
                  </p>
                ))}
              </div>
            )}

            {snapshot && (
              <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
                <h2 className="text-lg font-medium text-lapis-text-primary mb-4">Current Fitness Snapshot</h2>

                <div className="mb-6">
                  <p className="text-lapis-text-secondary text-sm mb-3">Weekly cardio distance (last 8 weeks)</p>
                  <div className="space-y-2">
                    {snapshot.cardio.weeklyDistanceKm.map((km, i) => {
                      const max = Math.max(...snapshot.cardio.weeklyDistanceKm, 1)
                      return (
                        <div key={i} className="w-full bg-lapis-surface-2 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-lapis-accent-500 transition-all duration-300" style={{ width: `${(km / max) * 100}%` }} />
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-lapis-text-tertiary text-xs mt-2">
                    Averaging {snapshot.cardio.recentAvgWeeklyKm.toFixed(1)}km/week across {snapshot.cardio.recentAvgSessionsPerWeek.toFixed(1)} sessions/week recently, active {snapshot.cardio.weeksActive}/8 weeks. Longest recent session: {snapshot.cardio.longestSessionKm}km.
                  </p>
                </div>

                {snapshot.strength.muscleGroupTrends.length > 0 && (
                  <div className="mb-6">
                    <p className="text-lapis-text-secondary text-sm mb-3">Strength trend (best est. 1RM, last 6 weeks vs. prior 6)</p>
                    <div className="flex flex-wrap gap-2">
                      {snapshot.strength.muscleGroupTrends.map((t) => (
                        <span key={t.muscleGroup} className="px-3 py-1.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-subtle">
                          {t.muscleGroup}: {t.currentBestEst1RM}kg ({t.trend})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {snapshot.weightTrend && (
                  <div className="mb-6">
                    <p className="text-lapis-text-secondary text-sm mb-3">Body weight</p>
                    <p className="text-lapis-text-secondary text-sm">
                      {snapshot.weightTrend.currentWeightKg}kg currently
                      {snapshot.weightTrend.changeKgLast90Days != null &&
                        ` (${snapshot.weightTrend.changeKgLast90Days >= 0 ? '+' : ''}${snapshot.weightTrend.changeKgLast90Days.toFixed(1)}kg over 90 days)`}
                    </p>
                  </div>
                )}

                {snapshot.pastRaceResults.length > 0 && (
                  <div className="mb-6">
                    <p className="text-lapis-text-secondary text-sm mb-3">Past race results</p>
                    <div className="space-y-1">
                      {snapshot.pastRaceResults.slice(0, 3).map((r, i) => (
                        <p key={i} className="text-lapis-text-secondary text-sm">
                          {raceTypeLabel(r.raceType)}
                          {r.courseOrLocation ? ` (${r.courseOrLocation})` : ''} — {r.raceDate}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-lapis-text-tertiary text-xs">
                  Consistency (last 90 days): {snapshot.gymConsistencyWeeks} weeks with gym activity, {snapshot.nutritionConsistencyWeeks} weeks with nutrition logged.
                  {snapshot.trainingPhase && ` Current training phase: ${snapshot.trainingPhase} (${snapshot.trainingIntensity}).`}
                  {snapshot.competingGoalsCount > 0 && ` ${snapshot.competingGoalsCount} other active goal(s).`}
                </p>
              </div>
            )}

            {(courseProfile || cutoffRiskFlags.length > 0) && (
              <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
                <h2 className="text-lg font-medium text-lapis-text-primary mb-3">About This Course</h2>
                {courseProfile && (
                  <div className="space-y-1">
                    {describeCourseDifficulty(courseProfile.difficultyFactor) && (
                      <p className="text-lapis-text-secondary text-sm">{describeCourseDifficulty(courseProfile.difficultyFactor)}</p>
                    )}
                    {courseProfile.elevationGainM != null && <p className="text-lapis-text-secondary text-sm">Elevation gain: ~{courseProfile.elevationGainM}m</p>}
                    {courseProfile.swimNotes && <p className="text-lapis-text-secondary text-sm">Swim: {courseProfile.swimNotes}</p>}
                    {courseProfile.bikeNotes && <p className="text-lapis-text-secondary text-sm">Bike: {courseProfile.bikeNotes}</p>}
                    {courseProfile.runNotes && <p className="text-lapis-text-secondary text-sm">Run: {courseProfile.runNotes}</p>}
                  </div>
                )}
                {cutoffRiskFlags.length > 0 && courseRange && (
                  <div className={courseProfile ? 'mt-4 pt-4 border-t border-lapis-border-subtle space-y-3' : 'space-y-3'}>
                    <p className="text-lapis-text-tertiary text-xs">Cutoff safety margin</p>
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
                className="text-sm text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors"
              >
                Back
              </button>
              <Button onClick={() => setStep('spectrum')} className="bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110">
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'spectrum' && snapshot && (
          <div className="space-y-6">
            <CutoffRiskBanner flags={cutoffRiskFlags} />

            <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
              <h2 className="text-lg font-medium text-lapis-text-primary mb-1">Approach</h2>
              <p className="text-lapis-text-tertiary text-sm mb-6">Choose how much this race should take over your training.</p>
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
                currentFormReason={currentFormReason}
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
                className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 mt-6"
              >
                {generating ? 'Generating...' : plan ? 'Regenerate Plan' : 'Generate Plan'}
              </Button>
              {category === 'multisport' && !disciplineWeakness && (
                <p className="text-sm text-lapis-garnet mt-2">
                  Discipline analysis is missing for this race - go back and complete the assessment step before generating a plan.
                </p>
              )}
              {generateError && <p className="text-sm text-lapis-garnet mt-2">{generateError}</p>}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('snapshot')} className="text-sm text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors">
                Back
              </button>
              {plan && (
                <button onClick={() => setStep('review')} className="text-sm text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors">
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {step === 'review' && plan && snapshot && (
          <div className="space-y-8">
            <CutoffRiskBanner flags={cutoffRiskFlags} />
            <BenchmarkComplianceBanner flags={behindBenchmarkFlags} onRegenerate={() => setStep('spectrum')} />

            {activeOrUpcomingDisruption && (
              <p className="text-lapis-text-tertiary text-xs">
                {formatDateRange(activeOrUpcomingDisruption.start_date, activeOrUpcomingDisruption.end_date)} (
                {activeOrUpcomingDisruption.reason}) - {DISRUPTION_GUIDANCE[activeOrUpcomingDisruption.reason]}
              </p>
            )}

            {/* Plan/Progress/Prep, not routes - see reviewTab's own comment
                for why. Same pill-toggle pattern as Calendar's Day/Week
                switch, reused rather than inventing a new nav style. */}
            <div className="flex items-center gap-1 p-1 rounded-lapis-sm bg-lapis-surface-2 w-fit">
              {([
                { key: 'plan', label: 'Plan' },
                { key: 'progress', label: 'Progress' },
                { key: 'prep', label: 'Prep' },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setReviewTab(tab.key)}
                  className={`px-4 py-1.5 rounded-lapis-sm text-sm font-medium transition-colors ${
                    reviewTab === tab.key ? 'bg-lapis-accent-500 text-lapis-text-primary' : 'text-lapis-text-secondary hover:text-lapis-text-primary'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {reviewTab === 'plan' && (
              <div className="space-y-8">
                <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
                  <div className="flex items-center justify-between flex-wrap gap-4 mb-3">
                    <h2 className="text-lg font-medium text-lapis-text-primary">
                      Training Plan <span className="text-lapis-text-tertiary text-sm font-normal">({RACE_APPROACH_LABELS[plan.approach]})</span>
                    </h2>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setStep('confirm')} className="text-sm text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors">
                        Edit start date
                      </button>
                      <button onClick={() => setStep('assessment')} className="text-sm text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors">
                        Edit my assessment
                      </button>
                      <Button onClick={() => setStep('spectrum')} variant="outline" className="border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2">
                        Regenerate Plan
                      </Button>
                    </div>
                  </div>
                  {race.trainingStartDate && race.trainingStartDate > today && (
                    <p className="text-lapis-text-tertiary text-xs mb-3">
                      Training starts {new Date(race.trainingStartDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
                      {daysBetween(race.trainingStartDate, today)} days from now.
                    </p>
                  )}
                  <p className="text-lapis-text-secondary text-sm leading-relaxed mb-4">{plan.overview}</p>
                  {seasonMismatchNote && <p className="text-lapis-text-tertiary text-xs mb-4">{seasonMismatchNote}</p>}

                  <div className="pt-4 border-t border-lapis-border-subtle">
                    <p className="text-xs text-lapis-text-tertiary mb-1">Strength Emphasis</p>
                    <p className="text-lapis-text-primary text-sm">{describeStrengthEmphasis(plan.approach, snapshot.strength.recentSessionsPerWeek)}</p>
                  </div>

                  {nutritionTensionFlag && (
                    <div className="mt-4 border border-lapis-citrine/20 rounded-lapis-lg bg-lapis-citrine/[0.04] p-4">
                      <p className="text-lapis-citrine/80 text-sm font-medium mb-1">Worth double-checking</p>
                      <p className="text-lapis-citrine/60 text-xs">{nutritionTensionFlag}</p>
                    </div>
                  )}
                </div>

                {weeksByPhase.map((group) => {
                  const groupKey = `${group.phase}-${group.isAcclimation}`
                  const isGroupExpanded = isPhaseExpanded(groupKey)
                  const firstWeek = group.weeks[0]
                  const lastWeek = group.weeks[group.weeks.length - 1]
                  const containsCurrentWeek = group.weeks.some((w) => w.weekStartDate === currentWeekStartDate)
                  const phaseEndDate = new Date(lastWeek.weekStartDate + 'T00:00:00')
                  phaseEndDate.setDate(phaseEndDate.getDate() + 6)
                  const dateRangeLabel = `${formatWeekDate(firstWeek.weekStartDate)} – ${formatWeekDate(getLocalDateString(phaseEndDate))}`
                  // Boundary weeks of the phase, not a claimed "peak" -
                  // Base/Build ramp up (last week highest) while Taper
                  // ramps down (first week highest), so "start → end"
                  // stays honest either way without needing to determine
                  // which end is actually higher.
                  const loadSummary = firstWeek.disciplines
                    ? (['swim', 'bike', 'run'] as Discipline[])
                        .map((d) => `${DISCIPLINE_LABELS[d]} ${firstWeek.disciplines![d].km}→${lastWeek.disciplines![d].km}km`)
                        .join(' · ')
                    : `${firstWeek.targetCardioKm}→${lastWeek.targetCardioKm}km`

                  return (
                    <div key={groupKey}>
                      <button
                        onClick={() => togglePhaseExpanded(groupKey)}
                        className={`w-full text-left flex items-center justify-between flex-wrap gap-3 border rounded-lapis-lg p-4 transition-colors ${
                          containsCurrentWeek
                            ? 'border-lapis-border-strong bg-lapis-accent-500/[0.05]'
                            : 'border-lapis-border-subtle bg-lapis-surface-1 hover:bg-lapis-surface-2'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isGroupExpanded ? (
                            <ChevronUp className="w-4 h-4 text-lapis-text-tertiary shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-lapis-text-tertiary shrink-0" />
                          )}
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-lapis-text-primary font-medium text-sm">
                                {group.isAcclimation ? 'Acclimation' : `${PHASE_LABELS[group.phase]} Phase`}
                              </span>
                              <span className="text-lapis-text-tertiary text-xs">— {group.weeks.length} week{group.weeks.length === 1 ? '' : 's'}</span>
                              {containsCurrentWeek && (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-lapis-accent-500 text-lapis-text-primary">This Week</span>
                              )}
                            </div>
                            <p className="text-lapis-text-tertiary text-xs mt-0.5">{dateRangeLabel}</p>
                          </div>
                        </div>
                        <p className="text-lapis-text-tertiary text-xs">{loadSummary}</p>
                      </button>

                      {isGroupExpanded && (
                        <div className="mt-3">
                          {/* Editing here reuses the shared Base template, which also governs
                              real Base weeks - hidden for the acclimation group so "edit" isn't
                              offered from a heading it wouldn't be scoped to. */}
                          {!group.isAcclimation && plan.phaseTemplates[group.phase] && (
                            <div className="mb-1">
                              <PhaseTemplateDialog
                                raceId={raceId}
                                phase={group.phase}
                                template={plan.phaseTemplates[group.phase]!}
                                allTemplates={plan.phaseTemplates}
                                weeksInPhase={group.weeks}
                                onSaved={(updated) => handleTemplateSaved(group.phase, updated)}
                                easyPaceTargets={easyPaceTargets}
                                peakPaceTargets={peakPaceTargets}
                                thresholdPaceHints={thresholdPaceHints}
                              />
                            </div>
                          )}
                          {group.isAcclimation && <p className="text-lapis-text-tertiary text-xs mb-1">{ACCLIMATION_GUIDANCE}</p>}
                          <p className="text-lapis-text-tertiary text-xs mb-1">{STRENGTH_SEQUENCING_NOTES[group.phase]}</p>
                          <p className="text-lapis-text-tertiary text-xs mb-3">{PHASE_NUTRITION_GUIDANCE[group.phase]}</p>
                          <div className="grid gap-3">
                            {group.weeks.map((week, weekIndex) => {
                              const isCurrentWeek = week.weekStartDate === currentWeekStartDate
                              const phaseTemplate = plan.phaseTemplates[week.phase]
                              const isExpanded = expandedWeeks.has(week.weekStartDate)
                              return (
                                <div
                                  key={week.weekStartDate}
                                  className={`border rounded-lapis-lg p-6 transition-all duration-200 ${
                                    isCurrentWeek ? 'border-lapis-border-strong bg-lapis-accent-500/[0.05]' : 'border-lapis-border-subtle bg-lapis-surface-1'
                                  }`}
                                >
                                  <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lapis-text-primary font-medium">Week of {formatWeekDate(week.weekStartDate)}</span>
                                      {isCurrentWeek && (
                                        <span className="px-2 py-0.5 rounded-full text-xs bg-lapis-accent-500 text-lapis-text-primary">This Week</span>
                                      )}
                                      {!!week.brickSessions && (
                                        <span className="px-2 py-0.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-strong">
                                          {week.brickSessions} brick
                                        </span>
                                      )}
                                    </div>
                                    {week.disciplines ? (
                                      <div className="flex gap-4 text-right text-sm flex-wrap justify-end">
                                        {(['swim', 'bike', 'run'] as Discipline[]).map((d) => (
                                          <div key={d}>
                                            <p className="text-xs text-lapis-text-tertiary">{DISCIPLINE_LABELS[d]}</p>
                                            <p className="text-lapis-text-primary font-semibold">
                                              {week.disciplines![d].km}km · {week.disciplines![d].sessions}x
                                            </p>
                                          </div>
                                        ))}
                                        <div>
                                          <p className="text-xs text-lapis-text-tertiary">Strength</p>
                                          <p className="text-lapis-text-primary font-semibold">{week.targetStrengthSessions}x</p>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex gap-4 text-right text-sm">
                                        <div>
                                          <p className="text-xs text-lapis-text-tertiary">Cardio</p>
                                          <p className="text-lapis-text-primary font-semibold">
                                            {isCurrentWeek && currentWeekActual ? `${currentWeekActual.cardioKm.toFixed(1)} / ` : ''}
                                            {week.targetCardioKm}km
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-lapis-text-tertiary">Sessions</p>
                                          <p className="text-lapis-text-primary font-semibold">{week.targetCardioSessions} cardio · {week.targetStrengthSessions} strength</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-lapis-text-tertiary text-sm">{week.focusNote}</p>

                                  {phaseTemplate && (
                                    <>
                                      <button
                                        onClick={() => toggleWeekExpanded(week.weekStartDate)}
                                        className="flex items-center gap-1 text-xs text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mt-3"
                                      >
                                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                        {isExpanded ? 'Hide days' : 'Show days'}
                                      </button>
                                      {isExpanded && (
                                        <WeekDayList
                                          slots={slotsForWeek(phaseTemplate, week)}
                                          week={week}
                                          weekIndexWithinPhase={weekIndex}
                                          easyPaceTargets={easyPaceTargets}
                                          peakPaceTargets={peakPaceTargets}
                                          thresholdPaceHints={thresholdPaceHints}
                                          approach={plan.approach}
                                          paceGaps={paceGaps}
                                          weeksUntilRace={weeksUntilRace}
                                          level={level}
                                        />
                                      )}
                                    </>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {milestoneSuggestions && (
                  <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
                    <button
                      onClick={() => setMilestoneExpanded((prev) => !prev)}
                      className="flex items-center gap-1 text-lg font-medium text-lapis-text-primary"
                    >
                      {milestoneExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      Milestone session ideas
                    </button>
                    {!milestoneExpanded ? (
                      <p className="text-lapis-text-tertiary text-sm mt-2">
                        You have a long runway to this race - optionally, consider one longer-than-usual session per discipline for confidence and nutrition
                        practice. Entirely optional and doesn&apos;t change your plan&apos;s numbers.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <p className="text-lapis-text-tertiary text-xs mb-2">
                          A one-off, occasional session per discipline - not a new weekly expectation. Adjust distance/timing to how it feels.
                        </p>
                        {milestoneSuggestions.map((s) => (
                          <p key={s.discipline} className="text-lapis-text-secondary text-sm">
                            <span className="text-lapis-text-tertiary">{DISCIPLINE_LABELS[s.discipline]}:</span> ~{s.km}km, around the week of {formatWeekDate(s.weekStartDate)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {reviewTab === 'progress' && (
              <div className="space-y-8">
                <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
                  <h2 className="text-lg font-medium text-lapis-text-primary mb-3">Finish Time &amp; Projections</h2>
                  <FinishTimeCard
                    category={category}
                    targetFinishSeconds={targetFinishSeconds}
                    projectedFinishSeconds={projectedFinishSeconds}
                    courseRange={courseRange}
                    reason={currentFormReason}
                  />

                  {/* Only shown separately when a target is set - otherwise
                      FinishTimeCard's own value above already IS the
                      projection, and repeating it here would be the exact
                      duplicate this reorg removed. */}
                  {targetFinishSeconds != null && (courseRange || projectedFinishSeconds != null) && (
                    <div className="pt-4 mt-4 border-t border-lapis-border-subtle">
                      <p className="text-xs text-lapis-text-tertiary mb-1">Projected Finish</p>
                      <p className="text-lapis-text-secondary text-sm">
                        {courseRange
                          ? `${formatDuration(courseRange.totalSecondsLow)}–${formatDuration(courseRange.totalSecondsHigh)}`
                          : formatDuration(projectedFinishSeconds!)}
                      </p>
                    </div>
                  )}

                  {aspirationalRange && nextTier && (
                    <div className="pt-4 mt-4 border-t border-lapis-border-subtle">
                      <p className="text-xs text-lapis-text-tertiary mb-1">If You Progress Further</p>
                      <p className="text-lapis-text-secondary text-sm">
                        {formatDuration(aspirationalRange.totalSecondsLow)}–{formatDuration(aspirationalRange.totalSecondsHigh)}
                      </p>
                      <p className="text-lapis-text-tertiary text-xs mt-1 max-w-sm">
                        If your real training reaches {TIER_LABELS[nextTier]}-level fitness by race day - the same tracking already updating your
                        projection above - your range could look more like this. Not a promise, just where the evidence would point.
                      </p>
                    </div>
                  )}

                  {cutoffRiskFlags.length > 0 && courseRange && (
                    <div className="pt-4 mt-4 border-t border-lapis-border-subtle space-y-3">
                      <p className="text-xs text-lapis-text-tertiary">Cutoff safety margin</p>
                      {cutoffRiskFlags.map((f) => (
                        <CutoffMarginRow key={f.segment} flag={f} range={courseRange} />
                      ))}
                    </div>
                  )}
                </div>

                {muscleImpact.length > 0 && (
                  <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
                    <h2 className="text-lg font-medium text-lapis-text-primary mb-3">Muscle Impact</h2>
                    <div className="flex flex-wrap gap-2">
                      {muscleImpact.map((line) => (
                        <span
                          key={line.muscle}
                          title={line.description}
                          className="px-3 py-1.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-subtle"
                        >
                          {line.muscle}: {line.shortLabel}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <DisruptionDeclaration disruptions={disruptions} onChanged={refetchDisruptions} />
              </div>
            )}

            {reviewTab === 'prep' && (
              <div className="space-y-8">
                <RaceChecklistCard raceId={race.id} category={category} />

                {fuelingPhaseSummaries.length > 0 && (
                  <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
                    <h2 className="text-lg font-medium text-lapis-text-primary mb-3">Fueling</h2>
                    <p className="text-lapis-text-secondary text-sm leading-relaxed mb-4">{FUELING_GUIDANCE}</p>
                    <div className="space-y-1 mb-4">
                      {fuelingPhaseSummaries.map((line) => (
                        <p key={line.phase} className="text-lapis-text-tertiary text-xs">
                          <span className="text-lapis-text-secondary">{PHASE_LABELS[line.phase]}:</span> {line.summary}
                        </p>
                      ))}
                    </div>
                    <Link href="/nutrition" className="text-sm text-lapis-text-secondary hover:text-lapis-text-primary underline underline-offset-2">
                      Log an Intra-Workout entry →
                    </Link>
                  </div>
                )}

                <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
                  <h2 className="text-lg font-medium text-lapis-text-primary mb-3">Race Day Plan</h2>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-lapis-text-tertiary mb-1">Pacing</p>
                      <p className="text-lapis-text-secondary text-sm">{ZONE_GUIDANCE.key.peak.full}</p>
                      {peakPaceTargets && (
                        <div className="mt-2 space-y-1">
                          {(['swim', 'bike', 'run'] as Discipline[]).map((d) => {
                            const gap = paceGaps.find((g) => g.discipline === d)
                            return (
                              <p key={d} className="text-lapis-text-secondary text-sm">
                                {DISCIPLINE_LABELS[d]}: ~{formatPaceForDiscipline(peakPaceTargets[d], d)}
                                {gap && <span className="text-lapis-text-tertiary text-xs"> ({describePaceGap(gap, weeksUntilRace, level)})</span>}
                                {!gap && safeCutoffPaceTargets && (
                                  <span className="text-lapis-text-tertiary text-xs">
                                    {' '}
                                    (a safe-cutoff pace would be ~{formatPaceForDiscipline(safeCutoffPaceTargets[d], d)} - reaching your goal takes real
                                    improvement, not just showing up; not enough logged data yet for a more precise comparison)
                                  </span>
                                )}
                              </p>
                            )
                          })}
                        </div>
                      )}
                      {targetFinishSeconds != null && peakPaceTargets && (
                        <p className="text-lapis-text-tertiary text-xs mt-2 max-w-sm">
                          These paces reserve ~{Math.round(TYPICAL_TRANSITION_SECONDS / 60)} minutes for T1/T2 transitions, so multiplying them out by
                          distance won't quite reach your goal time on its own - that's expected, not a shortfall.
                        </p>
                      )}
                    </div>

                    {category === 'multisport' && (
                      <div>
                        <p className="text-xs text-lapis-text-tertiary mb-1">Transitions</p>
                        <p className="text-lapis-text-secondary text-sm">{TRANSITION_GUIDANCE.peak.full}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-xs text-lapis-text-tertiary mb-2">Checkpoints</p>
                      <div className="space-y-2">
                        {RACE_DAY_CHECKPOINTS[category].map((checkpoint) => (
                          <div key={checkpoint.label}>
                            <p className="text-lapis-text-primary text-sm font-medium">{checkpoint.label}</p>
                            <ul className="list-disc ml-4">
                              {checkpoint.notes.map((note) => (
                                <li key={note} className="text-lapis-text-secondary text-xs">
                                  {note}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
