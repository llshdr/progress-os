'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  questionsForDiscipline,
  type Discipline,
  type DisciplineAssessment,
  type DisciplineQuestion,
  type MultisportSelfAssessment,
} from '@/lib/race-plan/self-assessment'
import type { DisciplineActivityFacts } from '@/lib/race-plan/discipline-weakness'
import { DISCIPLINE_PACE_UNIT, toSecPerKm, fromSecPerKm, formatPaceForDiscipline } from '@/lib/race-plan/pace-units'
import { getLocalDateString } from '@/lib/date'
import { checkPacePlausibility, checkSessionDistancePlausibility, checkTimeTrialPlausibility } from '@/lib/race-plan/assessment-plausibility'

interface MultisportSelfAssessmentFormProps {
  value: MultisportSelfAssessment
  onChange: (value: MultisportSelfAssessment) => void
  disciplineActivityFacts: Record<Discipline, DisciplineActivityFacts> | null
}

const DISCIPLINE_LABELS: Record<Discipline, string> = { swim: 'Swim', bike: 'Bike', run: 'Run' }

const FITNESS_SCALE_OPTIONS = [
  { value: '1', label: 'Just starting out' },
  { value: '2', label: 'Building a base' },
  { value: '3', label: 'Comfortably active' },
  { value: '4', label: 'Solidly trained' },
  { value: '5', label: 'Could race tomorrow' },
]

const PAST_EXPERIENCE_OPTIONS = [
  { value: 'none', label: 'None yet' },
  { value: 'sprint', label: 'Sprint triathlon' },
  { value: 'olympic', label: 'Olympic triathlon' },
  { value: 'half_iron', label: 'Half-iron distance' },
  { value: 'full_iron', label: 'Full-iron distance' },
  { value: 'other', label: 'Other' },
]

// Mandatory per discipline (comfortLevel only - always answerable), the
// rest optional. Same scale/chips/distance/time rendering approach as
// self-assessment-form.tsx, just scoped to one DisciplineAssessment at a
// time instead of the flat SimpleSelfAssessment shape.
export default function MultisportSelfAssessmentForm({ value, onChange, disciplineActivityFacts }: MultisportSelfAssessmentFormProps) {
  const patchDiscipline = (discipline: Discipline, fields: Partial<DisciplineAssessment>) => {
    onChange({ ...value, [discipline]: { ...value[discipline], ...fields } })
  }

  const renderDisciplineQuestion = (discipline: Discipline, q: DisciplineQuestion) => {
    const disciplineValue = value[discipline]

    if (q.type === 'scale') {
      const current = disciplineValue[q.id] as number | null
      return (
        <div className="flex flex-wrap gap-2">
          {q.options?.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                patchDiscipline(discipline, { [q.id]: current === Number(opt.value) ? null : Number(opt.value) } as Partial<DisciplineAssessment>)
              }
              className={`px-3 py-2 rounded-lapis-sm text-sm transition-colors ${
                current === Number(opt.value) ? 'bg-lapis-accent-500 text-lapis-text-primary' : 'bg-lapis-surface-2 text-lapis-text-secondary hover:bg-lapis-surface-2'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )
    }

    if (q.type === 'chips') {
      const current = disciplineValue.limiters
      const toggle = (v: string) => {
        if (v === 'none') {
          patchDiscipline(discipline, { limiters: current.includes('none') ? [] : ['none'] })
          return
        }
        const withoutNone = current.filter((c) => c !== 'none')
        patchDiscipline(discipline, { limiters: withoutNone.includes(v) ? withoutNone.filter((c) => c !== v) : [...withoutNone, v] })
      }
      return (
        <div className="flex flex-wrap gap-2">
          {q.options?.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`px-3 py-2 rounded-lapis-sm text-sm transition-colors ${
                current.includes(opt.value) ? 'bg-lapis-accent-500 text-lapis-text-primary' : 'bg-lapis-surface-2 text-lapis-text-secondary hover:bg-lapis-surface-2'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )
    }

    if (q.type === 'pace_duration') {
      const unit = DISCIPLINE_PACE_UNIT[discipline]
      const current = disciplineValue.comfortableEffort
      const facts = disciplineActivityFacts?.[discipline]
      const paceValue = current ? fromSecPerKm(current.paceSecPerKm, unit) : null

      const updatePace = (paceSecPerKm: number) => {
        patchDiscipline(discipline, { comfortableEffort: { paceSecPerKm, sustainedMinutes: current?.sustainedMinutes ?? 45 } })
      }
      const updateSustainedMinutes = (sustainedMinutes: number) => {
        if (!current) return
        patchDiscipline(discipline, { comfortableEffort: { ...current, sustainedMinutes } })
      }
      const clear = () => patchDiscipline(discipline, { comfortableEffort: null })
      const plausibilityWarning = checkPacePlausibility(discipline, current?.paceSecPerKm ?? null)

      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {unit === 'km_per_h' ? (
              <>
                <Input
                  type="number"
                  step="0.1"
                  value={paceValue ?? ''}
                  onChange={(e) => (e.target.value ? updatePace(toSecPerKm(parseFloat(e.target.value), unit)) : clear())}
                  placeholder="e.g. 28"
                  className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled w-24"
                />
                <span className="text-lapis-text-tertiary text-sm">km/h</span>
              </>
            ) : (
              <>
                <Input
                  type="number"
                  value={paceValue != null ? Math.floor(paceValue) : ''}
                  onChange={(e) => {
                    if (!e.target.value && paceValue == null) return
                    const mins = e.target.value ? parseInt(e.target.value, 10) : 0
                    const secs = paceValue != null ? Math.round((paceValue - Math.floor(paceValue)) * 60) : 0
                    updatePace(toSecPerKm(mins + secs / 60, unit))
                  }}
                  placeholder="mm"
                  className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled w-16"
                />
                <span className="text-lapis-text-tertiary">:</span>
                <Input
                  type="number"
                  value={paceValue != null ? Math.round((paceValue - Math.floor(paceValue)) * 60) : ''}
                  onChange={(e) => {
                    if (!e.target.value && paceValue == null) return
                    const secs = e.target.value ? parseInt(e.target.value, 10) : 0
                    const mins = paceValue != null ? Math.floor(paceValue) : 0
                    updatePace(toSecPerKm(mins + secs / 60, unit))
                  }}
                  placeholder="ss"
                  className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled w-16"
                />
                <span className="text-lapis-text-tertiary text-sm">/{unit === 'min_per_100m' ? '100m' : 'km'}</span>
              </>
            )}
            {current && (
              <button type="button" onClick={clear} className="text-xs text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors">
                Clear
              </button>
            )}
          </div>

          {plausibilityWarning && <p className="text-lapis-citrine text-xs">{plausibilityWarning}</p>}

          {facts?.avgPaceSecPerKmRecent != null && (
            <button
              type="button"
              onClick={() => updatePace(facts.avgPaceSecPerKmRecent!)}
              className="text-xs text-lapis-text-tertiary hover:text-lapis-text-secondary underline underline-offset-2 text-left block"
            >
              Use my logged average: {formatPaceForDiscipline(facts.avgPaceSecPerKmRecent, discipline)} — this blends easy and hard days, so your
              comfortable pace is probably a bit slower than this
            </button>
          )}

          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={current?.sustainedMinutes ?? ''}
              onChange={(e) => e.target.value && updateSustainedMinutes(parseInt(e.target.value, 10))}
              placeholder="45"
              disabled={!current}
              className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled w-20 disabled:opacity-40"
            />
            <span className="text-lapis-text-tertiary text-sm">minutes you can currently hold that pace</span>
          </div>
        </div>
      )
    }

    if (q.type === 'distance') {
      const current = disciplineValue.longestRecentSessionKm
      const plausibilityWarning = checkSessionDistancePlausibility(discipline, current)
      return (
        <div>
          <div className="flex items-center gap-2 max-w-xs">
            <Input
              type="number"
              step="0.1"
              value={current ?? ''}
              onChange={(e) => patchDiscipline(discipline, { longestRecentSessionKm: e.target.value ? parseFloat(e.target.value) : null })}
              placeholder="e.g. 2"
              className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
            />
            <span className="text-lapis-text-tertiary text-sm">km</span>
          </div>
          {plausibilityWarning && <p className="text-lapis-citrine text-xs mt-1">{plausibilityWarning}</p>}
        </div>
      )
    }

    // time
    const current = disciplineValue.recentTimeTrial
    const hours = current ? Math.floor(current.timeSeconds / 3600) : 0
    const minutes = current ? Math.floor((current.timeSeconds % 3600) / 60) : 0
    const seconds = current ? current.timeSeconds % 60 : 0

    const update = (partial: { distanceKm?: number; hours?: number; minutes?: number; seconds?: number }) => {
      const distanceKm = partial.distanceKm ?? current?.distanceKm ?? 0
      const h = partial.hours ?? hours
      const m = partial.minutes ?? minutes
      const s = partial.seconds ?? seconds
      const timeSeconds = h * 3600 + m * 60 + s
      // Stamped on every real edit (this only fires from an input's
      // onChange) - see retest-reminder.ts, which needs a real date to
      // measure staleness from.
      patchDiscipline(discipline, {
        recentTimeTrial: !distanceKm && !timeSeconds ? null : { distanceKm, timeSeconds, recordedAt: getLocalDateString() },
      })
    }

    const plausibilityWarning = checkTimeTrialPlausibility(discipline, current)

    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            step="0.1"
            value={current?.distanceKm ?? ''}
            onChange={(e) => update({ distanceKm: e.target.value ? parseFloat(e.target.value) : 0 })}
            placeholder="km"
            className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled w-24"
          />
          <span className="text-lapis-text-tertiary text-sm">in</span>
          <Input
            type="number"
            value={hours || ''}
            onChange={(e) => update({ hours: e.target.value ? parseInt(e.target.value, 10) : 0 })}
            placeholder="hh"
            className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled w-16"
          />
          <Input
            type="number"
            value={minutes || ''}
            onChange={(e) => update({ minutes: e.target.value ? parseInt(e.target.value, 10) : 0 })}
            placeholder="mm"
            className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled w-16"
          />
          <Input
            type="number"
            value={seconds || ''}
            onChange={(e) => update({ seconds: e.target.value ? parseInt(e.target.value, 10) : 0 })}
            placeholder="ss"
            className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled w-16"
          />
        </div>
        {plausibilityWarning && <p className="text-lapis-citrine text-xs mt-1">{plausibilityWarning}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <p className="text-lapis-text-tertiary text-sm">
        If you can, take a real easy-to-moderate time trial this week in each discipline and log it below. This becomes your baseline, giving the plan
        (and the periodic retest reminder later on) a real starting reference point instead of just a self-rated guess.
      </p>
      {(['swim', 'bike', 'run'] as Discipline[]).map((discipline) => (
        <div key={discipline} className="space-y-5 border-t border-lapis-border-subtle pt-6 first:border-t-0 first:pt-0">
          <h3 className="text-lapis-text-primary font-medium">{DISCIPLINE_LABELS[discipline]}</h3>
          {questionsForDiscipline(discipline).map((q) => (
            <div key={q.id} className="space-y-2">
              <Label className="text-lapis-text-secondary">
                {q.label}
                {q.required && <span className="text-lapis-text-tertiary"> *</span>}
              </Label>
              <p className="text-lapis-text-tertiary text-xs">{q.helpText}</p>
              {renderDisciplineQuestion(discipline, q)}
            </div>
          ))}
        </div>
      ))}

      <div className="space-y-5 border-t border-lapis-border-subtle pt-6">
        <div className="space-y-2">
          <Label className="text-lapis-text-secondary">How would you rate your current strength training?</Label>
          <p className="text-lapis-text-tertiary text-xs">We already track your logged lifts, so this is mostly a sanity check.</p>
          <div className="flex flex-wrap gap-2">
            {FITNESS_SCALE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  onChange({ ...value, perceivedStrength: value.perceivedStrength === Number(opt.value) ? null : (Number(opt.value) as 1 | 2 | 3 | 4 | 5) })
                }
                className={`px-3 py-2 rounded-lapis-sm text-sm transition-colors ${
                  value.perceivedStrength === Number(opt.value) ? 'bg-lapis-accent-500 text-lapis-text-primary' : 'bg-lapis-surface-2 text-lapis-text-secondary hover:bg-lapis-surface-2'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-lapis-text-secondary">Past multi-sport race experience</Label>
          <div className="flex flex-wrap gap-2">
            {PAST_EXPERIENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    pastMultisportExperience: value.pastMultisportExperience === opt.value ? null : (opt.value as MultisportSelfAssessment['pastMultisportExperience']),
                  })
                }
                className={`px-3 py-2 rounded-lapis-sm text-sm transition-colors ${
                  value.pastMultisportExperience === opt.value ? 'bg-lapis-accent-500 text-lapis-text-primary' : 'bg-lapis-surface-2 text-lapis-text-secondary hover:bg-lapis-surface-2'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-lapis-text-secondary">Roughly how many hours/week can you realistically commit?</Label>
          <p className="text-lapis-text-tertiary text-xs">
            Optional - around work/family, not your absolute max. Used only to flag it if the generated plan's peak week asks for more than this.
          </p>
          <div className="flex items-center gap-2 max-w-xs">
            <Input
              type="number"
              step="0.5"
              value={value.availableWeeklyHours ?? ''}
              onChange={(e) => onChange({ ...value, availableWeeklyHours: e.target.value ? parseFloat(e.target.value) : null })}
              placeholder="e.g. 10"
              className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
            />
            <span className="text-lapis-text-tertiary text-sm">hours/week</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-lapis-text-secondary">Anything else the plan should account for?</Label>
          <Textarea
            value={value.notes ?? ''}
            onChange={(e) => onChange({ ...value, notes: e.target.value || null })}
            placeholder="Optional..."
            rows={2}
            className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled resize-none"
          />
        </div>
      </div>
    </div>
  )
}
