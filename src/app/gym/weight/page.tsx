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

type WeightEntry = {
  id: string
  weight: number
  body_fat_percentage: number | null
  notes: string | null
  recorded_at: string
}

export default function WeightPage() {
  const [entries, setEntries] = useState<WeightEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newEntry, setNewEntry] = useState({
    weight: '',
    body_fat_percentage: '',
    notes: '',
  })
  const supabase = createClient()

  useEffect(() => {
    fetchEntries()
  }, [])

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
      weight: parseFloat(newEntry.weight),
      body_fat_percentage: newEntry.body_fat_percentage
        ? parseFloat(newEntry.body_fat_percentage)
        : null,
      notes: newEntry.notes || null,
    })

    if (error) {
      console.error('Error adding entry:', error)
      alert('Failed to add entry')
    } else {
      setNewEntry({ weight: '', body_fat_percentage: '', notes: '' })
      setIsDialogOpen(false)
      fetchEntries()
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    const { error } = await supabase
      .from('weight_entries')
      .delete()
      .eq('id', entryId)

    if (error) {
      console.error('Error deleting entry:', error)
    } else {
      fetchEntries()
    }
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
    const change = current - previous
    return change
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
                  <Label htmlFor="weight" className="text-white/80">Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    value={newEntry.weight}
                    onChange={(e) =>
                      setNewEntry({ ...newEntry, weight: e.target.value })
                    }
                    required
                    placeholder="75.5"
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
          </p>
        </div>

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
                        {entry.weight}
                        <span className="text-lg font-normal text-white/40 ml-1">
                          kg
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
                            {weightChange.toFixed(1)} kg
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteEntry(entry.id)}
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
    </AppLayout>
  )
}
