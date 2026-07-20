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

export default function TrainingSettingsPage() {
  const [weeklyWorkoutGoal, setWeeklyWorkoutGoal] = useState('5')
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg')
  const [goalWeight, setGoalWeight] = useState('')
  const [trainingPhase, setTrainingPhase] = useState<TrainingPhase>('maintain')
  const [trainingIntensity, setTrainingIntensity] = useState<TrainingIntensity>('mild')
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
      .select('weekly_workout_goal, weight_unit, goal_weight, training_phase, training_intensity')
      .eq('user_id', user.id)
      .maybeSingle()

    if (data?.weekly_workout_goal) {
      setWeeklyWorkoutGoal(String(data.weekly_workout_goal))
    }
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
        weight_unit: weightUnit,
        goal_weight: goalWeightKg,
        training_phase: trainingPhase,
        training_intensity: trainingIntensity,
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
        <Link href="/settings" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back to Settings
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight text-white mb-8">Training</h1>

        <div className="max-w-md">
          {loading ? (
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
              <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
                <h2 className="text-lg font-medium text-white mb-1">Weekly Workout Target</h2>
                <p className="text-white/40 text-sm mb-4">
                  Used for your dashboard progress and daily suggestions.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="weekly-workout-goal" className="text-white/80">
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
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>

              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
                <h2 className="text-lg font-medium text-white mb-1">Weight Tracking</h2>
                <p className="text-white/40 text-sm mb-4">
                  Controls the units used across weight tracking, the trend graph, and the AI insight.
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-white/80">Unit</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleUnitChange('kg')}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          weightUnit === 'kg'
                            ? 'bg-white text-black'
                            : 'bg-white/5 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        kg
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnitChange('lbs')}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          weightUnit === 'lbs'
                            ? 'bg-white text-black'
                            : 'bg-white/5 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        lbs
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goal-weight" className="text-white/80">
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
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                </div>
              </div>

              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
                <h2 className="text-lg font-medium text-white mb-1">Training Phase</h2>
                <p className="text-white/40 text-sm mb-4">
                  A placeholder until real nutrition/calorie tracking exists — helps the AI Coach
                  calibrate how aggressive its recommendations should be.
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-white/80">Phase</Label>
                    <div className="flex gap-2">
                      {(['bulk', 'maintain', 'cut'] as const).map((phase) => (
                        <button
                          key={phase}
                          type="button"
                          onClick={() => {
                            setTrainingPhase(phase)
                            setSaved(false)
                          }}
                          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                            trainingPhase === phase
                              ? 'bg-white text-black'
                              : 'bg-white/5 text-white/60 hover:bg-white/10'
                          }`}
                        >
                          {phase}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/80">Intensity</Label>
                    <div className="flex gap-2">
                      {(['mild', 'aggressive'] as const).map((intensity) => (
                        <button
                          key={intensity}
                          type="button"
                          onClick={() => {
                            setTrainingIntensity(intensity)
                            setSaved(false)
                          }}
                          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                            trainingIntensity === intensity
                              ? 'bg-white text-black'
                              : 'bg-white/5 text-white/60 hover:bg-white/10'
                          }`}
                        >
                          {intensity}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={saving} className="bg-white text-black hover:bg-white/90">
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                {saved && <span className="text-white/40 text-sm">Saved</span>}
              </div>
            </form>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
