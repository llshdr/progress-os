'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

export default function NutritionSettingsPage() {
  const [maintenanceCalories, setMaintenanceCalories] = useState('')
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
      .select('maintenance_calories')
      .eq('user_id', user.id)
      .maybeSingle()

    if (data?.maintenance_calories) {
      setMaintenanceCalories(String(data.maintenance_calories))
    }
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const value = maintenanceCalories ? parseInt(maintenanceCalories, 10) : null

    setSaving(true)
    setSaved(false)

    const { error } = await supabase.from('user_settings').upsert(
      {
        user_id: user.id,
        maintenance_calories: value,
      },
      { onConflict: 'user_id' }
    )

    setSaving(false)
    if (!error) {
      setSaved(true)
    } else {
      console.error('Error saving nutrition settings:', error)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/settings" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back to Settings
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight text-white mb-8">Nutrition</h1>

        <div className="max-w-md">
          {loading ? (
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
              <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
                <h2 className="text-lg font-medium text-white mb-1">Maintenance Calories</h2>
                <p className="text-white/40 text-sm mb-4">
                  Your baseline daily calories. Manually entered for now — auto-calculation from
                  your stats is a future enhancement. Combined with your training phase/intensity
                  (set under Training) and any logged daily activity to compute each day&apos;s target.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="maintenance-calories" className="text-white/80">
                    Calories per day
                  </Label>
                  <Input
                    id="maintenance-calories"
                    type="number"
                    min={0}
                    value={maintenanceCalories}
                    onChange={(e) => {
                      setMaintenanceCalories(e.target.value)
                      setSaved(false)
                    }}
                    placeholder="2200"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
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
