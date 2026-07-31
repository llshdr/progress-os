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

interface MultisportSelfAssessmentFormProps {
  value: MultisportSelfAssessment
  onChange: (value: MultisportSelfAssessment) => void
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
export default function MultisportSelfAssessmentForm({ value, onChange }: MultisportSelfAssessmentFormProps) {
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
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                current === Number(opt.value) ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
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
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                current.includes(opt.value) ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )
    }

    if (q.type === 'distance') {
      const current = disciplineValue.longestRecentSessionKm
      return (
        <div className="flex items-center gap-2 max-w-xs">
          <Input
            type="number"
            step="0.1"
            value={current ?? ''}
            onChange={(e) => patchDiscipline(discipline, { longestRecentSessionKm: e.target.value ? parseFloat(e.target.value) : null })}
            placeholder="e.g. 2"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
          <span className="text-white/40 text-sm">km</span>
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
      patchDiscipline(discipline, { recentTimeTrial: !distanceKm && !timeSeconds ? null : { distanceKm, timeSeconds } })
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          step="0.1"
          value={current?.distanceKm ?? ''}
          onChange={(e) => update({ distanceKm: e.target.value ? parseFloat(e.target.value) : 0 })}
          placeholder="km"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 w-24"
        />
        <span className="text-white/40 text-sm">in</span>
        <Input
          type="number"
          value={hours || ''}
          onChange={(e) => update({ hours: e.target.value ? parseInt(e.target.value, 10) : 0 })}
          placeholder="hh"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 w-16"
        />
        <Input
          type="number"
          value={minutes || ''}
          onChange={(e) => update({ minutes: e.target.value ? parseInt(e.target.value, 10) : 0 })}
          placeholder="mm"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 w-16"
        />
        <Input
          type="number"
          value={seconds || ''}
          onChange={(e) => update({ seconds: e.target.value ? parseInt(e.target.value, 10) : 0 })}
          placeholder="ss"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 w-16"
        />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {(['swim', 'bike', 'run'] as Discipline[]).map((discipline) => (
        <div key={discipline} className="space-y-5 border-t border-white/10 pt-6 first:border-t-0 first:pt-0">
          <h3 className="text-white font-medium">{DISCIPLINE_LABELS[discipline]}</h3>
          {questionsForDiscipline(discipline).map((q) => (
            <div key={q.id} className="space-y-2">
              <Label className="text-white/80">
                {q.label}
                {q.required && <span className="text-white/40"> *</span>}
              </Label>
              <p className="text-white/40 text-xs">{q.helpText}</p>
              {renderDisciplineQuestion(discipline, q)}
            </div>
          ))}
        </div>
      ))}

      <div className="space-y-5 border-t border-white/10 pt-6">
        <div className="space-y-2">
          <Label className="text-white/80">How would you rate your current strength training?</Label>
          <p className="text-white/40 text-xs">We already track your logged lifts, so this is mostly a sanity check.</p>
          <div className="flex flex-wrap gap-2">
            {FITNESS_SCALE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  onChange({ ...value, perceivedStrength: value.perceivedStrength === Number(opt.value) ? null : (Number(opt.value) as 1 | 2 | 3 | 4 | 5) })
                }
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  value.perceivedStrength === Number(opt.value) ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-white/80">Past multi-sport race experience</Label>
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
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  value.pastMultisportExperience === opt.value ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-white/80">Anything else the plan should account for?</Label>
          <Textarea
            value={value.notes ?? ''}
            onChange={(e) => onChange({ ...value, notes: e.target.value || null })}
            placeholder="Optional..."
            rows={2}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
          />
        </div>
      </div>
    </div>
  )
}
