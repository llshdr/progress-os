'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings } from 'lucide-react'

export default function SettingsPage() {
  const [weeklyWorkoutGoal, setWeeklyWorkoutGoal] = useState('5')
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
      .select('weekly_workout_goal')
      .eq('user_id', user.id)
      .maybeSingle()

    if (data?.weekly_workout_goal) {
      setWeeklyWorkoutGoal(String(data.weekly_workout_goal))
    }
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const goal = parseInt(weeklyWorkoutGoal, 10)
    if (!goal || goal < 1) return

    setSaving(true)
    setSaved(false)

    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, weekly_workout_goal: goal }, { onConflict: 'user_id' })

    setSaving(false)
    if (!error) {
      setSaved(true)
    } else {
      console.error('Error saving settings:', error)
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

        <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 max-w-md">
          <h2 className="text-lg font-medium text-white mb-1">Weekly Workout Target</h2>
          <p className="text-white/40 text-sm mb-4">
            Used for your dashboard progress and daily suggestions.
          </p>

          {loading ? (
            <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
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
