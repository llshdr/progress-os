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
        <Link href="/settings" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 block">
          ← Back to Settings
        </Link>

        <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-8">Nutrition</h1>

        <div className="max-w-md">
          {loading ? (
            <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
              <div className="h-10 bg-lapis-surface-2 rounded-lapis-sm animate-pulse" />
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
                <h2 className="text-lg font-medium text-lapis-text-primary mb-1">Maintenance Calories</h2>
                <p className="text-lapis-text-tertiary text-sm mb-4">
                  Your baseline daily calories. Manually entered for now — auto-calculation from
                  your stats is a future enhancement. Combined with your training phase/intensity
                  (set under Training) and any logged daily activity to compute each day&apos;s target.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="maintenance-calories" className="text-lapis-text-secondary">
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
