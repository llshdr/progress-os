'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { questionsForCategory, type RaceCategory, type SimpleSelfAssessment, type AssessmentQuestion } from '@/lib/race-plan/self-assessment'
import { getLocalDateString } from '@/lib/date'
import { checkSessionDistancePlausibility, checkTimeTrialPlausibility } from '@/lib/race-plan/assessment-plausibility'

interface SelfAssessmentFormProps {
  category: RaceCategory
  value: SimpleSelfAssessment
  onChange: (value: SimpleSelfAssessment) => void
}

// Every question is optional and skippable - self-report only fills gaps
// in the real logged data from analyze-fitness.ts, it never blocks
// progress. Chips/scales (not blank text fields) so someone unsure how to
// assess themselves still has an easy, concrete answer to pick.
export default function SelfAssessmentForm({ category, value, onChange }: SelfAssessmentFormProps) {
  const questions = questionsForCategory(category)
  const patch = (fields: Partial<SimpleSelfAssessment>) => onChange({ ...value, ...fields })

  const renderQuestion = (q: AssessmentQuestion) => {
    if (q.type === 'scale') {
      const current = value[q.id] as number | null
      return (
        <div className="flex flex-wrap gap-2">
          {q.options?.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => patch({ [q.id]: current === Number(opt.value) ? null : Number(opt.value) } as Partial<SimpleSelfAssessment>)}
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

    if (q.type === 'chips' && q.id === 'limiters') {
      const current = value.limiters
      const toggle = (v: string) => {
        if (v === 'none') {
          patch({ limiters: current.includes('none') ? [] : ['none'] })
          return
        }
        const withoutNone = current.filter((c) => c !== 'none')
        patch({ limiters: withoutNone.includes(v) ? withoutNone.filter((c) => c !== v) : [...withoutNone, v] })
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

    if (q.type === 'chips') {
      const current = value[q.id] as string | null
      return (
        <div className="flex flex-wrap gap-2">
          {q.options?.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => patch({ [q.id]: current === opt.value ? null : opt.value } as Partial<SimpleSelfAssessment>)}
              className={`px-3 py-2 rounded-lapis-sm text-sm transition-colors ${
                current === opt.value ? 'bg-lapis-accent-500 text-lapis-text-primary' : 'bg-lapis-surface-2 text-lapis-text-secondary hover:bg-lapis-surface-2'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )
    }

    if (q.type === 'distance') {
      const current = value[q.id] as number | null
      const plausibilityWarning = q.id === 'longestRecentDistanceKm' ? checkSessionDistancePlausibility('run', current) : null
      return (
        <div>
          <div className="flex items-center gap-2 max-w-xs">
            <Input
              type="number"
              step="0.1"
              value={current ?? ''}
              onChange={(e) => patch({ [q.id]: e.target.value ? parseFloat(e.target.value) : null } as Partial<SimpleSelfAssessment>)}
              placeholder="e.g. 5"
              className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
            />
            <span className="text-lapis-text-tertiary text-sm">km</span>
          </div>
          {plausibilityWarning && <p className="text-lapis-citrine text-xs mt-1">{plausibilityWarning}</p>}
        </div>
      )
    }

    if (q.type === 'time') {
      const current = value.recentTimeTrial
      const hours = current ? Math.floor(current.timeSeconds / 3600) : 0
      const minutes = current ? Math.floor((current.timeSeconds % 3600) / 60) : 0
      const seconds = current ? current.timeSeconds % 60 : 0

      const update = (partial: { distanceKm?: number; hours?: number; minutes?: number; seconds?: number }) => {
        const distanceKm = partial.distanceKm ?? current?.distanceKm ?? 0
        const h = partial.hours ?? hours
        const m = partial.minutes ?? minutes
        const s = partial.seconds ?? seconds
        const timeSeconds = h * 3600 + m * 60 + s
        if (!distanceKm && !timeSeconds) {
          patch({ recentTimeTrial: null })
        } else {
          // Stamped on every real edit (this only fires from an input's
          // onChange) - see retest-reminder.ts, which needs a real date to
          // measure staleness from.
          patch({ recentTimeTrial: { distanceKm, timeSeconds, recordedAt: getLocalDateString() } })
        }
      }

      const plausibilityWarning = checkTimeTrialPlausibility('run', current)

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

    // text
    return (
      <Textarea
        value={(value[q.id] as string | null) ?? ''}
        onChange={(e) => patch({ [q.id]: e.target.value || null } as Partial<SimpleSelfAssessment>)}
        placeholder="Optional..."
        rows={2}
        className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled resize-none"
      />
    )
  }

  return (
    <div className="space-y-6">
      {category === 'run' && (
        <p className="text-lapis-text-tertiary text-sm">
          If you can, take a real easy-to-moderate time trial this week and log it below — a 5k or 10k at a pushed pace works well. This becomes your
          baseline, giving the plan (and the periodic retest reminder later on) a real starting reference point instead of just a self-rated guess.
        </p>
      )}
      {questions.map((q) => (
        <div key={q.id} className="space-y-2">
          <Label className="text-lapis-text-secondary">{q.label}</Label>
          <p className="text-lapis-text-tertiary text-xs">{q.helpText}</p>
          {renderQuestion(q)}
        </div>
      ))}
    </div>
  )
}
