'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  RACE_APPROACHES,
  RACE_APPROACH_LABELS,
  previewApproachEffect,
  describeStrengthEmphasis,
  describeMuscleImpact,
  sortMuscleImpact,
  type RaceApproach,
  type DisciplineRampInputs,
} from '@/lib/race-plan/periodization'
import type { Discipline } from '@/lib/race-plan/self-assessment'
import type { MuscleVolume } from '@/lib/volume-analysis'

interface ApproachSpectrumProps {
  value: RaceApproach
  onChange: (value: RaceApproach) => void
  currentWeeklyCardioKm: number
  currentStrengthSessionsPerWeek: number
  showFinishTime: boolean
  targetFinishSeconds: number | null
  onTargetFinishSecondsChange: (seconds: number | null) => void
  disciplineInputs?: DisciplineRampInputs
  muscleVolume: MuscleVolume[]
  currentFormReason?: string | null
}

const DISCIPLINE_LABELS: Record<Discipline, string> = { swim: 'Swim', bike: 'Bike', run: 'Run' }

function parseDurationInput(hh: string, mm: string, ss: string): number | null {
  const h = parseInt(hh || '0', 10)
  const m = parseInt(mm || '0', 10)
  const s = parseInt(ss || '0', 10)
  const total = h * 3600 + m * 60 + s
  return total > 0 ? total : null
}

// 5-stop slider replacing the old binary Full-send/Balanced toggle. The
// live "Strength Emphasis" text is computed entirely from real numbers
// already on hand (periodization.ts's own preset table + the fitness
// snapshot's current baseline) - no fabricated projection, just an honest
// description of what each stop actually does.
export default function ApproachSpectrum({
  value,
  onChange,
  currentWeeklyCardioKm,
  currentStrengthSessionsPerWeek,
  showFinishTime,
  targetFinishSeconds,
  onTargetFinishSecondsChange,
  disciplineInputs,
  muscleVolume,
  currentFormReason,
}: ApproachSpectrumProps) {
  const index = RACE_APPROACHES.indexOf(value)
  const preview = previewApproachEffect(value, currentWeeklyCardioKm, currentStrengthSessionsPerWeek, disciplineInputs)
  const strengthEmphasisText = describeStrengthEmphasis(value, currentStrengthSessionsPerWeek)
  const muscleImpact = sortMuscleImpact(describeMuscleImpact(value, currentStrengthSessionsPerWeek, muscleVolume))

  const hh = targetFinishSeconds != null ? String(Math.floor(targetFinishSeconds / 3600)) : ''
  const mm = targetFinishSeconds != null ? String(Math.floor((targetFinishSeconds % 3600) / 60)) : ''
  const ss = targetFinishSeconds != null ? String(targetFinishSeconds % 60) : ''

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between text-xs text-lapis-text-tertiary mb-2">
          <span>Best Race Time</span>
          <span>Best Muscle Growth</span>
        </div>
        <input
          type="range"
          min={0}
          max={RACE_APPROACHES.length - 1}
          step={1}
          value={index}
          onChange={(e) => onChange(RACE_APPROACHES[Number(e.target.value)])}
          className="w-full accent-white"
        />
        <p className="text-lapis-text-primary text-sm font-medium text-center mt-2">{RACE_APPROACH_LABELS[value]}</p>
      </div>

      <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-4 space-y-1">
        {preview.previewDisciplineKm ? (
          <>
            <p className="text-lapis-text-secondary text-xs">Peak weekly targets</p>
            {(['swim', 'bike', 'run'] as Discipline[]).map((discipline) => (
              <p key={discipline} className="text-lapis-text-primary text-sm">
                {DISCIPLINE_LABELS[discipline]}: ~{preview.previewDisciplineKm![discipline]}km/week at peak
              </p>
            ))}
            {disciplineInputs?.hasCutoffRisk && disciplineInputs.order[0] && (
              <p className="text-lapis-text-tertiary text-xs mt-1">
                {DISCIPLINE_LABELS[disciplineInputs.order[0]]} (your weakest discipline) is getting extra emphasis above the usual weakness bias to help close your cutoff gap.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-lapis-text-secondary text-xs">Cardio peak target</p>
            <p className="text-lapis-text-primary text-sm">~{preview.previewPeakCardioKm}km/week at this plan's peak</p>
          </>
        )}
        <p className="text-lapis-text-secondary text-xs mt-3">Strength Emphasis</p>
        <p className="text-lapis-text-primary text-sm">{strengthEmphasisText}</p>
        {muscleImpact.length > 0 && (
          <>
            <p className="text-lapis-text-secondary text-xs mt-3">Muscle Impact</p>
            <div className="flex flex-wrap gap-2 mt-1">
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
          </>
        )}
      </div>

      {showFinishTime && (
        <div className="space-y-2">
          <Label className="text-lapis-text-secondary">Target finish time (optional)</Label>
          {/* Deliberately no computed estimate/range shown here - a specific
              achievable-looking number can act as a psychological ceiling.
              This is your own stated goal, not a number the app hands back
              to you; currentFormReason (real evidence quality, never a
              number) is the only context kept. */}
          {currentFormReason && <p className="text-lapis-text-tertiary text-xs">{currentFormReason}</p>}
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={hh}
              onChange={(e) => onTargetFinishSecondsChange(parseDurationInput(e.target.value, mm, ss))}
              placeholder="hh"
              className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled w-16"
            />
            <Input
              type="number"
              value={mm}
              onChange={(e) => onTargetFinishSecondsChange(parseDurationInput(hh, e.target.value, ss))}
              placeholder="mm"
              className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled w-16"
            />
            <Input
              type="number"
              value={ss}
              onChange={(e) => onTargetFinishSecondsChange(parseDurationInput(hh, mm, e.target.value))}
              placeholder="ss"
              className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled w-16"
            />
          </div>
        </div>
      )}
    </div>
  )
}
