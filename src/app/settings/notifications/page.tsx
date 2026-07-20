'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function NotificationsSettingsPage() {
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

    const { data } = await supabase
      .from('user_settings')
      .select('show_today_suggestions')
      .eq('user_id', user.id)
      .maybeSingle()

    if (typeof data?.show_today_suggestions === 'boolean') {
      setShowTodaySuggestions(data.show_today_suggestions)
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
      },
      { onConflict: 'user_id' }
    )

    setSaving(false)
    if (!error) {
      setSaved(true)
    } else {
      console.error('Error saving notification settings:', error)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/settings" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back to Settings
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight text-white mb-8">Notifications</h1>

        <div className="max-w-md">
          {loading ? (
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
              <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
                <h2 className="text-lg font-medium text-white mb-1">Today&apos;s Suggestions</h2>
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
                      showTodaySuggestions ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
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
                      !showTodaySuggestions ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    Hide
                  </button>
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
