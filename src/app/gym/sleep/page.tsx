'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import Link from 'next/link'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { celsiusToDisplay, displayToCelsius, formatTemperature, type TemperatureUnit } from '@/lib/sleep'
import { getLocalDateString } from '@/lib/date'
import SleepChart from '@/components/sleep/sleep-chart'
import SleepInsightCard from '@/components/sleep/sleep-insight-card'

type SleepEntry = {
  id: string
  date: string
  hours_slept: number
  room_temp_c: number | null
}

const MIN_ENTRIES_FOR_TREND = 3

// Reuses weight-tracking's exact proven pattern (log entry -> trend graph
// -> AI insight card) - see /gym/weight/page.tsx.
export default function SleepPage() {
  const [entries, setEntries] = useState<SleepEntry[]>([])
  const [tempUnit, setTempUnit] = useState<TemperatureUnit>('c')
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newEntry, setNewEntry] = useState({
    date: getLocalDateString(),
    hours_slept: '',
    room_temp: '',
  })
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null)
  const [insightRefreshKey, setInsightRefreshKey] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    fetchEntries()
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase.from('user_settings').select('temperature_unit').eq('user_id', user.id).maybeSingle()
    setTempUnit(data?.temperature_unit === 'f' ? 'f' : 'c')
  }

  const fetchEntries = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('sleep_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })

    if (error) {
      console.error('Error fetching sleep entries:', error)
    } else {
      setEntries(data || [])
    }
    setLoading(false)
  }

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('sleep_entries').upsert(
      {
        user_id: user.id,
        date: newEntry.date,
        hours_slept: parseFloat(newEntry.hours_slept),
        room_temp_c: newEntry.room_temp ? displayToCelsius(parseFloat(newEntry.room_temp), tempUnit) : null,
      },
      { onConflict: 'user_id,date' }
    )

    if (error) {
      console.error('Error adding sleep entry:', error)
    } else {
      setNewEntry({ date: getLocalDateString(), hours_slept: '', room_temp: '' })
      setIsDialogOpen(false)
      fetchEntries()
      setInsightRefreshKey((k) => k + 1)
    }
  }

  const handleDeleteEntry = async () => {
    if (!entryToDelete) return

    const { error } = await supabase.from('sleep_entries').delete().eq('id', entryToDelete)

    if (error) {
      console.error('Error deleting sleep entry:', error)
    } else {
      fetchEntries()
      setInsightRefreshKey((k) => k + 1)
    }
    setEntryToDelete(null)
  }

  const openDeleteModal = (entryId: string) => {
    setEntryToDelete(entryId)
    setShowDeleteModal(true)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-lapis-text-tertiary">Loading...</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/gym/progress" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors">
            ← Back
          </Link>
          <div className="flex-1" />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger>
              <Button className="bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 text-sm">Log Sleep</Button>
            </DialogTrigger>
            <DialogContent className="bg-lapis-surface-1 border-lapis-border text-lapis-text-primary">
              <DialogHeader>
                <DialogTitle className="font-display">Log Sleep Entry</DialogTitle>
                <DialogDescription className="text-lapis-text-tertiary">
                  Hours slept and bedroom temperature - both optional except hours.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddEntry} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sleep-date" className="text-lapis-text-secondary">
                    Date
                  </Label>
                  <Input
                    id="sleep-date"
                    type="date"
                    value={newEntry.date}
                    onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                    max={getLocalDateString()}
                    required
                    className="bg-lapis-surface-2 border-lapis-border text-lapis-text-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hours-slept" className="text-lapis-text-secondary">
                    Hours slept
                  </Label>
                  <Input
                    id="hours-slept"
                    type="number"
                    step="0.1"
                    min="0"
                    max="24"
                    value={newEntry.hours_slept}
                    onChange={(e) => setNewEntry({ ...newEntry, hours_slept: e.target.value })}
                    required
                    placeholder="7.5"
                    className="bg-lapis-surface-2 border-lapis-border text-lapis-text-primary placeholder:text-lapis-text-disabled"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="room-temp" className="text-lapis-text-secondary">
                    Bedroom temperature ({tempUnit === 'f' ? '°F' : '°C'}) - optional
                  </Label>
                  <Input
                    id="room-temp"
                    type="number"
                    step="0.1"
                    value={newEntry.room_temp}
                    onChange={(e) => setNewEntry({ ...newEntry, room_temp: e.target.value })}
                    placeholder={tempUnit === 'f' ? '65' : '18'}
                    className="bg-lapis-surface-2 border-lapis-border text-lapis-text-primary placeholder:text-lapis-text-disabled"
                  />
                </div>
                <Button type="submit" className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110">
                  Save Entry
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-6">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-2">Sleep History</h1>
          <p className="text-lapis-text-tertiary text-sm">{entries.length} nights logged</p>
        </div>

        {entries.length >= MIN_ENTRIES_FOR_TREND ? (
          <div className="grid gap-4 mb-6 lg:grid-cols-2">
            <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
              <h3 className="text-lg font-medium text-lapis-text-primary mb-4">Trend</h3>
              <SleepChart entries={entries.map((e) => ({ hoursSlept: e.hours_slept, date: e.date }))} />
            </div>
            <SleepInsightCard refreshKey={insightRefreshKey} />
          </div>
        ) : entries.length > 0 ? (
          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 mb-6">
            <p className="text-lapis-text-tertiary text-sm">
              Log {MIN_ENTRIES_FOR_TREND - entries.length} more night{MIN_ENTRIES_FOR_TREND - entries.length === 1 ? '' : 's'} to see your trend and an
              AI insight.
            </p>
          </div>
        ) : null}

        {entries.length === 0 ? (
          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-12 text-center">
            <p className="text-lapis-text-tertiary mb-4">No sleep entries yet</p>
            <Button onClick={() => setIsDialogOpen(true)} variant="outline" className="border-lapis-border text-lapis-text-primary hover:bg-lapis-surface-2">
              Log your first night
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 hover:bg-lapis-surface-2 transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="font-data text-3xl font-medium tabular-nums text-lapis-text-primary">
                      {entry.hours_slept}
                      <span className="text-lg font-normal text-lapis-text-tertiary ml-1">h</span>
                    </div>
                    {entry.room_temp_c != null && (
                      <div className="font-data text-sm tabular-nums text-lapis-text-tertiary">
                        {formatTemperature(entry.room_temp_c, tempUnit)}
                        {tempUnit === 'f' ? '°F' : '°C'} bedroom
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-lapis-text-primary font-medium">{formatDate(entry.date)}</div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openDeleteModal(entry.id)}
                      className="text-lapis-text-tertiary hover:text-lapis-text-secondary hover:bg-lapis-surface-2"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmationModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title="Delete Sleep Entry"
        description="Are you sure you want to delete this sleep entry? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteEntry}
        destructive
      />
    </AppLayout>
  )
}
