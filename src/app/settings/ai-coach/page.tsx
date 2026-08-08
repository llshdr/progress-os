'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

// Replaces the old Notifications page - Today's Suggestions was always an
// AI Coach setting wearing a "notification" label, and
// ai_coach_include_nutrition (migration 036) was a real, saved setting
// with no home in Settings at all, only reachable by flipping the
// in-context toggle on the exercise coach card / set logger. Both belong
// together under one real "AI Coach" section instead.
export default function AICoachSettingsPage() {
  const [showTodaySuggestions, setShowTodaySuggestions] = useState(true)
  const [includeNutrition, setIncludeNutrition] = useState(true)
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
      .select('show_today_suggestions, ai_coach_include_nutrition')
      .eq('user_id', user.id)
      .maybeSingle()

    if (typeof data?.show_today_suggestions === 'boolean') {
      setShowTodaySuggestions(data.show_today_suggestions)
    }
    if (typeof data?.ai_coach_include_nutrition === 'boolean') {
      setIncludeNutrition(data.ai_coach_include_nutrition)
    }
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setSaving(true)
    setSaved(false)

    const { error } = await supabase.from('user_settings').upsert(
      {
        user_id: user.id,
        show_today_suggestions: showTodaySuggestions,
        ai_coach_include_nutrition: includeNutrition,
      },
      { onConflict: 'user_id' }
    )

    setSaving(false)
    if (!error) {
      setSaved(true)
    } else {
      console.error('Error saving AI Coach settings:', error)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/settings" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 block">
          ← Back to Settings
        </Link>

        <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-8">AI Coach</h1>

        <div className="max-w-md">
          {loading ? (
            <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
              <div className="h-10 bg-lapis-surface-2 rounded-lapis-sm animate-pulse" />
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
                <h2 className="text-lg font-medium text-lapis-text-primary mb-1">Today&apos;s Suggestions</h2>
                <p className="text-lapis-text-tertiary text-sm mb-4">
                  Show the AI-generated suggestions panel on your dashboard.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTodaySuggestions(true)
                      setSaved(false)
                    }}
                    className={`flex-1 px-4 py-2 rounded-lapis-sm text-sm font-medium transition-colors ${
                      showTodaySuggestions ? 'bg-lapis-accent-500 text-lapis-text-primary' : 'bg-lapis-surface-2 text-lapis-text-secondary hover:bg-lapis-surface-2'
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
                    className={`flex-1 px-4 py-2 rounded-lapis-sm text-sm font-medium transition-colors ${
                      !showTodaySuggestions ? 'bg-lapis-accent-500 text-lapis-text-primary' : 'bg-lapis-surface-2 text-lapis-text-secondary hover:bg-lapis-surface-2'
                    }`}
                  >
                    Hide
                  </button>
                </div>
              </div>

              <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
                <h2 className="text-lg font-medium text-lapis-text-primary mb-1">Factor In Nutrition</h2>
                <p className="text-lapis-text-tertiary text-sm mb-4">
                  Let exercise recommendations consider today&apos;s logged nutrition, not just training history. This is
                  the same default the per-exercise toggle on the workout and exercise pages saves back to.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIncludeNutrition(true)
                      setSaved(false)
                    }}
                    className={`flex-1 px-4 py-2 rounded-lapis-sm text-sm font-medium transition-colors ${
                      includeNutrition ? 'bg-lapis-accent-500 text-lapis-text-primary' : 'bg-lapis-surface-2 text-lapis-text-secondary hover:bg-lapis-surface-2'
                    }`}
                  >
                    Include
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIncludeNutrition(false)
                      setSaved(false)
                    }}
                    className={`flex-1 px-4 py-2 rounded-lapis-sm text-sm font-medium transition-colors ${
                      !includeNutrition ? 'bg-lapis-accent-500 text-lapis-text-primary' : 'bg-lapis-surface-2 text-lapis-text-secondary hover:bg-lapis-surface-2'
                    }`}
                  >
                    Exclude
                  </button>
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
