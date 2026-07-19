'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { displayToKg, formatWeight, kgToDisplay, type WeightUnit } from '@/lib/weight'
import WeightChart from '@/components/weight/weight-chart'
import WeightInsightCard from '@/components/weight/weight-insight-card'

type WeightEntry = {
  id: string
  weight: number
  body_fat_percentage: number | null
  notes: string | null
  recorded_at: string
}

const MIN_ENTRIES_FOR_TREND = 3

export default function WeightPage() {
  const [entries, setEntries] = useState<WeightEntry[]>([])
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg')
  const [goalWeightKg, setGoalWeightKg] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newEntry, setNewEntry] = useState({
    weight: '',
    body_fat_percentage: '',
    notes: '',
  })
  const [showDeleteEntryModal, setShowDeleteEntryModal] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null)
  // Bumped after an entry is added/deleted so the (server-cached) AI insight
  // refetches — it only actually regenerates if the underlying data changed.
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

    const { data } = await supabase
      .from('user_settings')
      .select('weight_unit, goal_weight')
      .eq('user_id', user.id)
      .maybeSingle()

    setWeightUnit(data?.weight_unit === 'lbs' ? 'lbs' : 'kg')
    setGoalWeightKg(data?.goal_weight ?? null)
  }

  const fetchEntries = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('weight_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false })

    if (error) {
      console.error('Error fetching entries:', error)
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

    const { error } = await supabase.from('weight_entries').insert({
      user_id: user.id,
      weight: displayToKg(parseFloat(newEntry.weight), weightUnit),
      body_fat_percentage: newEntry.body_fat_percentage
        ? parseFloat(newEntry.body_fat_percentage)
        : null,
      notes: newEntry.notes || null,
    })

    if (error) {
      console.error('Error adding entry:', error)
    } else {
      setNewEntry({ weight: '', body_fat_percentage: '', notes: '' })
      setIsDialogOpen(false)
      fetchEntries()
      setInsightRefreshKey((k) => k + 1)
    }
  }

  const handleDeleteEntry = async () => {
    if (!entryToDelete) return

    const { error } = await supabase
      .from('weight_entries')
      .delete()
      .eq('id', entryToDelete)

    if (error) {
      console.error('Error deleting entry:', error)
    } else {
      fetchEntries()
      setInsightRefreshKey((k) => k + 1)
    }
    setEntryToDelete(null)
  }

  const openDeleteEntryModal = (entryId: string) => {
    setEntryToDelete(entryId)
    setShowDeleteEntryModal(true)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getWeightChange = (index: number) => {
    if (index >= entries.length - 1) return null
    const current = entries[index].weight
    const previous = entries[index + 1].weight
    // Convert the kg delta once — a linear unit conversion, so this is
    // equivalent to converting both values first and then subtracting.
    return kgToDisplay(current - previous, weightUnit)
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-white/40">Loading...</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/gym" className="text-white/40 hover:text-white/60 transition-colors">
            ← Back
          </Link>
          <div className="flex-1" />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger>
              <Button className="bg-white text-black hover:bg-white/90 text-sm">
                Log Weight
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black border-white/10 text-white">
              <DialogHeader>
                <DialogTitle>Log Weight Entry</DialogTitle>
                <DialogDescription className="text-white/40">
                  Record your current weight and body composition
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddEntry} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="weight" className="text-white/80">Weight ({weightUnit})</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    value={newEntry.weight}
                    onChange={(e) =>
                      setNewEntry({ ...newEntry, weight: e.target.value })
                    }
                    required
                    placeholder={weightUnit === 'kg' ? '75.5' : '165.0'}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body_fat_percentage" className="text-white/80">
                    Body Fat % (optional)
                  </Label>
                  <Input
                    id="body_fat_percentage"
                    type="number"
                    step="0.1"
                    value={newEntry.body_fat_percentage}
                    onChange={(e) =>
                      setNewEntry({
                        ...newEntry,
                        body_fat_percentage: e.target.value,
                      })
                    }
                    placeholder="15.5"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-white/80">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={newEntry.notes}
                    onChange={(e) =>
                      setNewEntry({ ...newEntry, notes: e.target.value })
                    }
                    placeholder="Any additional notes..."
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-white text-black hover:bg-white/90"
                >
                  Save Entry
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
            Weight History
          </h1>
          <p className="text-white/50 text-sm">
            {entries.length} entries recorded
            {goalWeightKg != null && (
              <> · Goal: {formatWeight(goalWeightKg, weightUnit)} {weightUnit}</>
            )}
          </p>
        </div>

        {entries.length >= MIN_ENTRIES_FOR_TREND ? (
          <div className="grid gap-4 mb-6 lg:grid-cols-2">
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
              <h3 className="text-lg font-medium text-white mb-4">Trend</h3>
              <WeightChart
                entries={entries.map((e) => ({ weight: e.weight, recordedAt: e.recorded_at }))}
                unit={weightUnit}
                goalWeightKg={goalWeightKg}
              />
            </div>
            <WeightInsightCard refreshKey={insightRefreshKey} />
          </div>
        ) : entries.length > 0 ? (
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 mb-6">
            <p className="text-white/40 text-sm">
              Log {MIN_ENTRIES_FOR_TREND - entries.length} more weigh-in
              {MIN_ENTRIES_FOR_TREND - entries.length === 1 ? '' : 's'} to see your trend and an AI insight.
            </p>
          </div>
        ) : null}

        {entries.length === 0 ? (
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center">
            <p className="text-white/40 mb-4">No weight entries yet</p>
            <Button
              onClick={() => setIsDialogOpen(true)}
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5"
            >
              Log your first entry
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {entries.map((entry, index) => {
              const weightChange = getWeightChange(index)
              return (
                <div
                  key={entry.id}
                  className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl font-semibold text-white">
                        {formatWeight(entry.weight, weightUnit)}
                        <span className="text-lg font-normal text-white/40 ml-1">
                          {weightUnit}
                        </span>
                      </div>
                      {entry.body_fat_percentage && (
                        <div className="text-sm text-white/40">
                          {entry.body_fat_percentage}% body fat
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-white font-medium">
                          {formatDate(entry.recorded_at)}
                        </div>
                        {weightChange !== null && (
                          <div
                            className={`text-sm ${
                              weightChange > 0
                                ? 'text-red-400'
                                : weightChange < 0
                                ? 'text-green-400'
                                : 'text-white/40'
                            }`}
                          >
                            {weightChange > 0 ? '+' : ''}
                            {weightChange.toFixed(1)} {weightUnit}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openDeleteEntryModal(entry.id)}
                        className="text-white/40 hover:text-white/60 hover:bg-white/5"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  {entry.notes && (
                    <p className="text-white/40 text-sm mt-4">
                      {entry.notes}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete Entry Confirmation Modal */}
      <ConfirmationModal
        open={showDeleteEntryModal}
        onOpenChange={setShowDeleteEntryModal}
        title="Delete Weight Entry"
        description="Are you sure you want to delete this weight entry? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteEntry}
        destructive
      />
    </AppLayout>
  )
}
