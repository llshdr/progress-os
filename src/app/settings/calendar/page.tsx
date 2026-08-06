'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import type { TemperatureUnit } from '@/lib/sleep'

// Day Schedule (wake/sleep time) moved here from Training - it's pure
// Calendar-display config (bounds the day view's default scroll
// position), never training-specific, so it never really belonged there.
// Temperature Unit lives here too - a display preference for Sleep
// tracking's bedroom-temperature comparison, grouped with the other
// day-rhythm/environment setting rather than under Training.
export default function CalendarSettingsPage() {
  const [wakeTime, setWakeTime] = useState('06:00')
  const [sleepTime, setSleepTime] = useState('23:00')
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>('c')
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
      .select('wake_time, sleep_time, temperature_unit')
      .eq('user_id', user.id)
      .maybeSingle()

    if (data?.wake_time) setWakeTime(data.wake_time.slice(0, 5))
    if (data?.sleep_time) setSleepTime(data.sleep_time.slice(0, 5))
    setTemperatureUnit(data?.temperature_unit === 'f' ? 'f' : 'c')
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
        wake_time: wakeTime || '06:00',
        sleep_time: sleepTime || '23:00',
        temperature_unit: temperatureUnit,
      },
      { onConflict: 'user_id' }
    )

    setSaving(false)
    if (!error) {
      setSaved(true)
    } else {
      console.error('Error saving calendar settings:', error)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/settings" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back to Settings
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight text-white mb-8">Calendar</h1>

        <div className="max-w-md">
          {loading ? (
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
              <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
                <h2 className="text-lg font-medium text-white mb-1">Day Schedule</h2>
                <p className="text-white/40 text-sm mb-4">
                  Bounds where the Calendar&apos;s day view opens by default - it never hides anything scheduled outside this range, it just decides
                  the default scroll position.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wake-time" className="text-white/80">
                      Wake time
                    </Label>
                    <Input
                      id="wake-time"
                      type="time"
                      value={wakeTime}
                      onChange={(e) => {
                        setWakeTime(e.target.value)
                        setSaved(false)
                      }}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sleep-time" className="text-white/80">
                      Sleep time
                    </Label>
                    <Input
                      id="sleep-time"
                      type="time"
                      value={sleepTime}
                      onChange={(e) => {
                        setSleepTime(e.target.value)
                        setSaved(false)
                      }}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
                <h2 className="text-lg font-medium text-white mb-1">Temperature Unit</h2>
                <p className="text-white/40 text-sm mb-4">Used for bedroom temperature in Sleep tracking.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTemperatureUnit('c')
                      setSaved(false)
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      temperatureUnit === 'c' ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    °C
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTemperatureUnit('f')
                      setSaved(false)
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      temperatureUnit === 'f' ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    °F
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
