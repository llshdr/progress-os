'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { displayToKg, kgToDisplay, WeightUnit } from '@/lib/weight'

type TrainingPhase = 'bulk' | 'cut' | 'maintain'
type TrainingIntensity = 'mild' | 'aggressive'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function TrainingSettingsPage() {
  const [weeklyWorkoutGoal, setWeeklyWorkoutGoal] = useState('5')
  const [countCardioTowardGoal, setCountCardioTowardGoal] = useState(true)
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg')
  const [goalWeight, setGoalWeight] = useState('')
  const [trainingPhase, setTrainingPhase] = useState<TrainingPhase>('maintain')
  const [trainingIntensity, setTrainingIntensity] = useState<TrainingIntensity>('mild')
  const [openWaterSeasonStart, setOpenWaterSeasonStart] = useState('')
  const [openWaterSeasonEnd, setOpenWaterSeasonEnd] = useState('')
  const [commuteBikeKmPerWeek, setCommuteBikeKmPerWeek] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('user_settings')
      .select(
        'weekly_workout_goal, count_cardio_toward_workout_goal, weight_unit, goal_weight, training_phase, training_intensity, open_water_season_start_month, open_water_season_end_month, commute_bike_km_per_week'
      )
      .eq('user_id', user.id)
      .maybeSingle()

    if (data?.weekly_workout_goal) {
      setWeeklyWorkoutGoal(String(data.weekly_workout_goal))
    }
    setCountCardioTowardGoal(data?.count_cardio_toward_workout_goal ?? true)
    const unit: WeightUnit = data?.weight_unit === 'lbs' ? 'lbs' : 'kg'
    setWeightUnit(unit)
    if (data?.goal_weight) {
      setGoalWeight(kgToDisplay(data.goal_weight, unit).toFixed(1))
    }
    if (data?.training_phase === 'bulk' || data?.training_phase === 'cut' || data?.training_phase === 'maintain') {
      setTrainingPhase(data.training_phase)
    }
    if (data?.training_intensity === 'mild' || data?.training_intensity === 'aggressive') {
      setTrainingIntensity(data.training_intensity)
    }
    if (data?.open_water_season_start_month) setOpenWaterSeasonStart(String(data.open_water_season_start_month))
    if (data?.open_water_season_end_month) setOpenWaterSeasonEnd(String(data.open_water_season_end_month))
    if (data?.commute_bike_km_per_week) setCommuteBikeKmPerWeek(String(data.commute_bike_km_per_week))
    setLoading(false)
  }

  const handleUnitChange = (unit: WeightUnit) => {
    // Re-express whatever's already typed in the new unit rather than
    // silently reinterpreting the same number under a different unit.
    if (goalWeight) {
      const kg = displayToKg(parseFloat(goalWeight), weightUnit)
      if (!Number.isNaN(kg)) {
        setGoalWeight(kgToDisplay(kg, unit).toFixed(1))
      }
    }
    setWeightUnit(unit)
    setSaved(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const goal = parseInt(weeklyWorkoutGoal, 10)
    if (!goal || goal < 1) return

    const goalWeightKg = goalWeight ? displayToKg(parseFloat(goalWeight), weightUnit) : null

    setSaving(true)
    setSaved(false)

    const { error } = await supabase.from('user_settings').upsert(
      {
        user_id: user.id,
        weekly_workout_goal: goal,
        count_cardio_toward_workout_goal: countCardioTowardGoal,
        weight_unit: weightUnit,
        goal_weight: goalWeightKg,
        training_phase: trainingPhase,
        training_intensity: trainingIntensity,
        open_water_season_start_month: openWaterSeasonStart ? parseInt(openWaterSeasonStart, 10) : null,
        open_water_season_end_month: openWaterSeasonEnd ? parseInt(openWaterSeasonEnd, 10) : null,
        commute_bike_km_per_week: commuteBikeKmPerWeek ? parseFloat(commuteBikeKmPerWeek) : null,
      },
      { onConflict: 'user_id' }
    )

    setSaving(false)
    if (!error) {
      setSaved(true)
    } else {
      console.error('Error saving training settings:', error)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/settings" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 block">
          ← Back to Settings
        </Link>

        <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-8">Training</h1>

        <div className="max-w-md">
          {loading ? (
            <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
              <div className="h-10 bg-lapis-surface-2 rounded-lapis-sm animate-pulse" />
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
                <h2 className="text-lg font-medium text-lapis-text-primary mb-1">Weekly Workout Target</h2>
                <p className="text-lapis-text-tertiary text-sm mb-4">
                  Used for your dashboard progress and daily suggestions.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="weekly-workout-goal" className="text-lapis-text-secondary">
                    Workouts per week
                  </Label>
                  <Input
                    id="weekly-workout-goal"
                    type="number"
                    min={1}
                    max={14}
                    value={weeklyWorkoutGoal}
                    onChange={(e) => {
                      setWeeklyWorkoutGoal(e.target.value)
                      setSaved(false)
                    }}
                    className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary"
                  />
                </div>
                <div className="space-y-1 mt-4 pt-4 border-t border-lapis-border-subtle">
                  <label className="flex items-center gap-2 text-sm text-lapis-text-secondary">
                    <input
                      type="checkbox"
                      checked={countCardioTowardGoal}
                      onChange={(e) => {
                        setCountCardioTowardGoal(e.target.checked)
                        setSaved(false)
                      }}
                    />
                    Cardio-only sessions count toward this target
                  </label>
                  <p className="text-lapis-text-tertiary text-xs">
                    Off means a workout only counts here if it has at least one strength exercise - a mixed session still
                    counts either way. Also affects your streak and the gym part of your rank.
                  </p>
                </div>
              </div>

              <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
                <h2 className="text-lg font-medium text-lapis-text-primary mb-1">Weight Tracking</h2>
                <p className="text-lapis-text-tertiary text-sm mb-4">
                  Controls the units used across weight tracking, the trend graph, and the AI insight.
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-lapis-text-secondary">Unit</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleUnitChange('kg')}
                        className={`flex-1 px-4 py-2 rounded-lapis-sm text-sm font-medium transition-colors ${
                          weightUnit === 'kg'
                            ? 'bg-lapis-accent-500 text-lapis-text-primary'
                            : 'bg-lapis-surface-2 text-lapis-text-secondary hover:bg-lapis-surface-2'
                        }`}
                      >
                        kg
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnitChange('lbs')}
                        className={`flex-1 px-4 py-2 rounded-lapis-sm text-sm font-medium transition-colors ${
                          weightUnit === 'lbs'
                            ? 'bg-lapis-accent-500 text-lapis-text-primary'
                            : 'bg-lapis-surface-2 text-lapis-text-secondary hover:bg-lapis-surface-2'
                        }`}
                      >
                        lbs
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goal-weight" className="text-lapis-text-secondary">
                      Goal weight ({weightUnit}) — optional
                    </Label>
                    <Input
                      id="goal-weight"
                      type="number"
                      step="0.1"
                      value={goalWeight}
                      onChange={(e) => {
                        setGoalWeight(e.target.value)
                        setSaved(false)
                      }}
                      placeholder={weightUnit === 'kg' ? '75.0' : '165.0'}
                      className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
                    />
                  </div>
                </div>
              </div>

              <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
                <h2 className="text-lg font-medium text-lapis-text-primary mb-1">Training Phase</h2>
                <p className="text-lapis-text-tertiary text-sm mb-4">
                  A placeholder until real nutrition/calorie tracking exists — helps the AI Coach
                  calibrate how aggressive its recommendations should be.
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-lapis-text-secondary">Phase</Label>
                    <div className="flex gap-2">
                      {(['bulk', 'maintain', 'cut'] as const).map((phase) => (
                        <button
                          key={phase}
                          type="button"
                          onClick={() => {
                            setTrainingPhase(phase)
                            setSaved(false)
                          }}
                          className={`flex-1 px-4 py-2 rounded-lapis-sm text-sm font-medium capitalize transition-colors ${
                            trainingPhase === phase
                              ? 'bg-lapis-accent-500 text-lapis-text-primary'
                              : 'bg-lapis-surface-2 text-lapis-text-secondary hover:bg-lapis-surface-2'
                          }`}
                        >
                          {phase}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-lapis-text-secondary">Intensity</Label>
                    <div className="flex gap-2">
                      {(['mild', 'aggressive'] as const).map((intensity) => (
                        <button
                          key={intensity}
                          type="button"
                          onClick={() => {
                            setTrainingIntensity(intensity)
                            setSaved(false)
                          }}
                          className={`flex-1 px-4 py-2 rounded-lapis-sm text-sm font-medium capitalize transition-colors ${
                            trainingIntensity === intensity
                              ? 'bg-lapis-accent-500 text-lapis-text-primary'
                              : 'bg-lapis-surface-2 text-lapis-text-secondary hover:bg-lapis-surface-2'
                          }`}
                        >
                          {intensity}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
                <h2 className="text-lg font-medium text-lapis-text-primary mb-1">Open Water Swim Season</h2>
                <p className="text-lapis-text-tertiary text-sm mb-4">
                  Optional - only used to suggest when open-water-specific swim sessions are realistic for a multisport race. Leave blank if you&apos;re not sure; nothing is guessed on your behalf.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ow-season-start" className="text-lapis-text-secondary">
                      Season starts
                    </Label>
                    <select
                      id="ow-season-start"
                      value={openWaterSeasonStart}
                      onChange={(e) => {
                        setOpenWaterSeasonStart(e.target.value)
                        setSaved(false)
                      }}
                      className="w-full bg-lapis-surface-2 border border-lapis-border-subtle text-lapis-text-primary rounded-lapis-sm px-3 py-2 text-sm"
                    >
                      <option value="" className="bg-lapis-bg">
                        Not set
                      </option>
                      {MONTH_NAMES.map((name, i) => (
                        <option key={i} value={i + 1} className="bg-lapis-bg">
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ow-season-end" className="text-lapis-text-secondary">
                      Season ends
                    </Label>
                    <select
                      id="ow-season-end"
                      value={openWaterSeasonEnd}
                      onChange={(e) => {
                        setOpenWaterSeasonEnd(e.target.value)
                        setSaved(false)
                      }}
                      className="w-full bg-lapis-surface-2 border border-lapis-border-subtle text-lapis-text-primary rounded-lapis-sm px-3 py-2 text-sm"
                    >
                      <option value="" className="bg-lapis-bg">
                        Not set
                      </option>
                      {MONTH_NAMES.map((name, i) => (
                        <option key={i} value={i + 1} className="bg-lapis-bg">
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
                <h2 className="text-lg font-medium text-lapis-text-primary mb-1">Bike Commute</h2>
                <p className="text-lapis-text-tertiary text-sm mb-4">
                  If you have a regular guaranteed commute ride (e.g. biking to work most days), a multisport race
                  plan subtracts it from your prescribed weekly bike volume instead of stacking extra training on
                  top of it - so a plan built assuming ~140km/week of commuting doesn&apos;t also ask for that much
                  again. Leave blank if this doesn&apos;t apply to you; nothing is guessed on your behalf. This is a
                  stable, declared number, not derived from logged rides - it only changes here, not automatically
                  from what you log.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="commute-km" className="text-lapis-text-secondary">
                    Guaranteed commute (km/week)
                  </Label>
                  <Input
                    id="commute-km"
                    type="number"
                    step="0.1"
                    min={0}
                    value={commuteBikeKmPerWeek}
                    onChange={(e) => {
                      setCommuteBikeKmPerWeek(e.target.value)
                      setSaved(false)
                    }}
                    placeholder="e.g. 140 for ~28km round trip, 5 days/week"
                    className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={saving} className="bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110">
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                {saved && <span className="text-lapis-text-tertiary text-sm">Saved</span>}
              </div>
            </form>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
