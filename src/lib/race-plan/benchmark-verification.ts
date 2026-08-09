import type { Discipline, RaceCategory } from '@/lib/race-plan/self-assessment'
import type { TrainingWeekSkeleton } from '@/lib/race-plan/periodization'
import { slotsForWeek, enduranceSlotKmForWeek, type EnduranceSlotType, type PhaseTemplates } from '@/lib/race-plan/day-template'
import { classifyDiscipline } from '@/lib/race-plan/discipline-weakness'
import type { CardioActivity } from '@/lib/cardio-stats'
import { paceTargetForWeek } from '@/lib/race-plan/pace-targets'

export interface BenchmarkFlag {
  discipline: EnduranceSlotType
  status: 'watch' | 'behind'
  message: string
}

// Heuristic thresholds, not independently sourced - same honesty
// precedent as AMBITIOUS_TARGET_RATIO/COMFORTABLE_MARGIN_SECONDS
// elsewhere in this feature.
const WATCH_RATIO_THRESHOLD = 0.85
const BEHIND_RATIO_THRESHOLD = 0.7
const MIN_WEEKS_FOR_EVIDENCE = 4
const PACE_SHORTFALL_RATIO = 1.15 // actual pace >15% slower than target

const DISCIPLINE_LABEL: Record<EnduranceSlotType, string> = { swim: 'swim', bike: 'bike', run: 'run', cardio: 'cardio' }

interface WeekEvidence {
  weekStartDate: string
  ratio: number // actual / planned distance
  paceRatio: number | null // actual pace / target pace (>1 = slower); null when no pace data available
}

export interface DisruptionRange {
  startDate: string
  endDate: string
}

// A disrupted week is excluded entirely - not counted as good or bad.
// "Insufficient undisrupted evidence" needs no separate handling: a
// disrupted week just never reaches `evidence`, so the existing
// MIN_WEEKS_FOR_EVIDENCE gate below already does the right thing when
// disruptions eat into the available history.
function weekOverlapsDisruption(weekStart: Date, weekEnd: Date, disruptions: DisruptionRange[]): boolean {
  return disruptions.some((d) => {
    const start = new Date(d.startDate + 'T00:00:00')
    const end = new Date(d.endDate + 'T00:00:00')
    end.setDate(end.getDate() + 1) // end_date is inclusive
    return weekStart < end && weekEnd > start
  })
}

// Best-effort proxy for "the key session" - same discipline-
// classification caveat already flagged in discipline-weakness.ts.
function longestSessionThisWeek(
  activities: CardioActivity[],
  weekStart: Date,
  weekEnd: Date,
  discipline: EnduranceSlotType
): CardioActivity | null {
  let best: CardioActivity | null = null
  for (const activity of activities) {
    const date = new Date(activity.date)
    if (date < weekStart || date >= weekEnd) continue
    if (discipline !== 'cardio' && classifyDiscipline(activity.exerciseName, activity.cardioType) !== discipline) continue
    if (!best || activity.distanceKm > best.distanceKm) best = activity
  }
  return best
}

// Compares real logged activity against each week's planned KEY session
// (never the full weekly total - a key session is the one the plan
// actually expects to dominate). Only ever computed at render time from
// data already fetched elsewhere in this feature - no schema, no cache
// table, same "never silent auto-replanning" precedent as everything
// else here: this only ever flags, the athlete decides whether to
// Regenerate.
export function assessBenchmarkCompliance(
  plan: { weeks: TrainingWeekSkeleton[]; phaseTemplates: PhaseTemplates },
  activities: CardioActivity[],
  currentWeekStartDate: string,
  category: RaceCategory,
  easyPaceTargets: Record<Discipline, number> | null,
  peakPaceTargets: Record<Discipline, number> | null,
  disruptions: DisruptionRange[] = []
): BenchmarkFlag[] {
  const disciplines: EnduranceSlotType[] = category === 'multisport' ? ['swim', 'bike', 'run'] : category === 'run' ? ['cardio'] : []
  if (disciplines.length === 0) return []

  // Grouped once, self-contained rather than depending on a caller's own
  // phase grouping - lets weekIndexWithinPhase be computed the same way
  // every other consumer of SlotProgression already does. Keyed by
  // (phase, isAcclimation), not phase alone - acclimation weeks are
  // phase: 'base' underneath (see periodization.ts's
  // TrainingWeekSkeleton.isAcclimation) but are a separate block, same
  // composite-key precedent page.tsx's own weeksByPhase grouping already
  // uses. Currently a no-op either way (Base has no within-phase
  // progression to index into), but keeps this file from silently
  // drifting from that precedent if Base ever gains one.
  const phaseGroupKey = (week: TrainingWeekSkeleton) => `${week.phase}:${week.isAcclimation}`
  const weeksByPhase = new Map<string, TrainingWeekSkeleton[]>()
  for (const week of plan.weeks) {
    const key = phaseGroupKey(week)
    const list = weeksByPhase.get(key) ?? []
    list.push(week)
    weeksByPhase.set(key, list)
  }

  const flags: BenchmarkFlag[] = []

  for (const discipline of disciplines) {
    const evidence: WeekEvidence[] = []

    for (const week of plan.weeks) {
      // Taper is intentionally reduced volume - not a compliance signal.
      if (week.phase === 'taper') continue
      if (week.weekStartDate >= currentWeekStartDate) continue

      const template = plan.phaseTemplates[week.phase]
      if (!template) continue
      const phaseWeeks = weeksByPhase.get(phaseGroupKey(week))!
      const weekIndexWithinPhase = phaseWeeks.indexOf(week)

      const slots = slotsForWeek(template, week)
      const keySlot = slots.enduranceSlots.find((s) => s.type === discipline && s.role === 'key')
      if (!keySlot) continue

      const siblings = slots.enduranceSlots.filter((s) => s.type === discipline)
      const weekDisciplineTotalKm = discipline === 'cardio' ? week.targetCardioKm : (week.disciplines?.[discipline].km ?? 0)
      const plannedKm = enduranceSlotKmForWeek(keySlot, siblings, weekIndexWithinPhase, weekDisciplineTotalKm)
      if (plannedKm < 1) continue // race-week token distance - nothing meaningful to compare

      const weekStart = new Date(week.weekStartDate + 'T00:00:00')
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)
      if (weekOverlapsDisruption(weekStart, weekEnd, disruptions)) continue

      const longest = longestSessionThisWeek(activities, weekStart, weekEnd, discipline)
      const actualKm = longest?.distanceKm ?? 0
      const ratio = actualKm / plannedKm

      let paceRatio: number | null = null
      if (discipline !== 'cardio' && easyPaceTargets && peakPaceTargets && longest && longest.distanceKm > 0) {
        const targetPace = paceTargetForWeek(easyPaceTargets[discipline], peakPaceTargets[discipline], week.phase, weekIndexWithinPhase, keySlot.progression)
        const actualPace = longest.durationSeconds / longest.distanceKm
        paceRatio = actualPace / targetPace
      }

      evidence.push({ weekStartDate: week.weekStartDate, ratio, paceRatio })
    }

    // Last 4 VALID weeks, not a "3-of-4" count - same 4-week-window
    // averaging discipline deriveCurrentFormLevel already uses.
    const recentEvidence = evidence.slice(-MIN_WEEKS_FOR_EVIDENCE)
    if (recentEvidence.length < MIN_WEEKS_FOR_EVIDENCE) continue

    const avgRatio = recentEvidence.reduce((sum, e) => sum + e.ratio, 0) / recentEvidence.length
    if (avgRatio >= WATCH_RATIO_THRESHOLD) continue

    const status: 'watch' | 'behind' = avgRatio >= BEHIND_RATIO_THRESHOLD ? 'watch' : 'behind'
    const pct = Math.round(avgRatio * 100)
    const label = DISCIPLINE_LABEL[discipline]

    // Phase-aware softening: if every shortfall week is in Peak, this
    // close to race day a short blip usually isn't worth disrupting the
    // taper over - directly implements the cited research on that point.
    const shortfallWeeks = recentEvidence.filter((e) => e.ratio < WATCH_RATIO_THRESHOLD)
    const isolatedToPeak =
      shortfallWeeks.length > 0 &&
      shortfallWeeks.every((e) => plan.weeks.find((w) => w.weekStartDate === e.weekStartDate)?.phase === 'peak')

    if (isolatedToPeak) {
      flags.push({
        discipline,
        status: 'watch',
        message: `Your ${label} key sessions have been running short recently, but this close to race day a week or two of reduced volume usually isn't worth disrupting your taper over - keep an eye on it.`,
      })
      continue
    }

    const paceShortfall = recentEvidence.some((e) => e.paceRatio != null && e.paceRatio > PACE_SHORTFALL_RATIO)
    const paceClause = paceShortfall ? ' The pace on those sessions has also been notably off target.' : ''

    if (status === 'watch') {
      flags.push({
        discipline,
        status,
        message: `Your ${label} key sessions have averaged ~${pct}% of planned distance over the last 4 weeks - worth watching, not yet a pattern to act on.${paceClause}`,
      })
    } else {
      flags.push({
        discipline,
        status,
        message: `Your ${label} key sessions have consistently come in well under plan (~${pct}% of planned distance over the last 4 weeks) - Regenerate to update your plan from where your real training actually is. This won't try to make up the lost volume; it steps your starting point back to match reality and rebuilds gradually from there.${paceClause}`,
      })
    }
  }

  return flags
}
