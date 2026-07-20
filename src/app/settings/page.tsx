'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings } from 'lucide-react'
import { displayToKg, kgToDisplay, WeightUnit } from '@/lib/weight'
import packageJson from '../../../package.json'

type TrainingPhase = 'bulk' | 'cut' | 'maintain'
type TrainingIntensity = 'mild' | 'aggressive'

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [weeklyWorkoutGoal, setWeeklyWorkoutGoal] = useState('5')
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg')
  const [goalWeight, setGoalWeight] = useState('')
  const [trainingPhase, setTrainingPhase] = useState<TrainingPhase>('maintain')
  const [trainingIntensity, setTrainingIntensity] = useState<TrainingIntensity>('mild')
  const [showTodaySuggestions, setShowTodaySuggestions] = useState(true)
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

    setEmail(user.email ?? '')

    const [{ data }, { data: profile }] = await Promise.all([
      supabase
        .from('user_settings')
        .select(
          'weekly_workout_goal, weight_unit, goal_weight, training_phase, training_intensity, show_today_suggestions'
        )
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    ])

    setDisplayName(profile?.full_name ?? '')

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
    if (typeof data?.show_today_suggestions === 'boolean') {
      setShowTodaySuggestions(data.show_today_suggestions)
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

    const [{ error: settingsError }, { error: profileError }] = await Promise.all([
      supabase.from('user_settings').upsert(
        {
          user_id: user.id,
          weekly_workout_goal: goal,
          weight_unit: weightUnit,
          goal_weight: goalWeightKg,
          training_phase: trainingPhase,
          training_intensity: trainingIntensity,
          show_today_suggestions: showTodaySuggestions,
        },
        { onConflict: 'user_id' }
      ),
      supabase.from('profiles').upsert(
        {
          id: user.id,
          full_name: displayName.trim() || null,
        },
        { onConflict: 'id' }
      ),
    ])

    setSaving(false)
    if (!settingsError && !profileError) {
      setSaved(true)
    } else {
      console.error('Error saving settings:', settingsError || profileError)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <Settings className="w-8 h-8 text-white/80" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">Settings</h1>
            <p className="text-white/50 text-sm">Customize your experience</p>
          </div>
        </div>

        <div className="space-y-10 max-w-md">
          {loading ? (
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
              <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-10">
              {/* Account */}
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">Account</h2>
                <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="display-name" className="text-white/80">
                      Display name
                    </Label>
                    <Input
                      id="display-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => {
                        setDisplayName(e.target.value)
                        setSaved(false)
                      }}
                      placeholder="Your name"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                    <p className="text-white/40 text-xs">
                      Shown in your dashboard greeting. Falls back to your email prefix if left blank.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/80">Email</Label>
                    <p className="text-white/50 text-sm">{email}</p>
                  </div>
                </div>
              </section>

              {/* Training */}
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">Training</h2>
                <div className="space-y-6">
                  <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
                    <h3 className="text-lg font-medium text-white mb-1">Weekly Workout Target</h3>
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
                    <h3 className="text-lg font-medium text-white mb-1">Weight Tracking</h3>
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
                    <h3 className="text-lg font-medium text-white mb-1">Training Phase</h3>
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
                </div>
              </section>

              {/* Notifications */}
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">Notifications</h2>
                <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
                  <h3 className="text-lg font-medium text-white mb-1">Today&apos;s Suggestions</h3>
                  <p className="text-white/40 text-sm mb-4">
                    Show the AI-generated suggestions panel on your dashboard.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowTodaySuggestions(true)
                        setSaved(false)
                      }}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        showTodaySuggestions
                          ? 'bg-white text-black'
                          : 'bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      Show
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowTodaySuggestions(false)
                        setSaved(false)
                      }}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        !showTodaySuggestions
                          ? 'bg-white text-black'
                          : 'bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      Hide
                    </button>
                  </div>
                </div>
              </section>

              {/* About */}
              <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">About</h2>
                <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
                  <p className="text-white font-medium">L.A.P.I.S</p>
                  <p className="text-white/40 text-sm mt-1">Version {packageJson.version}</p>
                </div>
              </section>

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-white text-black hover:bg-white/90"
                >
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
