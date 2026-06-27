'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

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
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a
              href="/"
              className="text-xl font-bold text-white hover:text-neutral-300 transition-colors"
            >
              ← Back
            </a>
            <h1 className="text-xl font-bold text-white">Weight Tracking</h1>
            <div className="w-16" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">
              Weight History
            </h2>
            <p className="text-neutral-400">
              {entries.length} entries recorded
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger>
              <Button className="bg-white text-black hover:bg-neutral-200">
                Log Weight
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-neutral-900 border-neutral-800 text-white">
              <DialogHeader>
                <DialogTitle>Log Weight Entry</DialogTitle>
                <DialogDescription className="text-neutral-400">
                  Record your current weight and body composition
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddEntry} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (kg)</Label>
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
                    className="bg-neutral-800 border-neutral-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body_fat_percentage">
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
                    className="bg-neutral-800 border-neutral-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={newEntry.notes}
                    onChange={(e) =>
                      setNewEntry({ ...newEntry, notes: e.target.value })
                    }
                    placeholder="Any additional notes..."
                    className="bg-neutral-800 border-neutral-700 text-white"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-white text-black hover:bg-neutral-200"
                >
                  Save Entry
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {entries.length === 0 ? (
          <Card className="bg-neutral-900 border-neutral-800">
            <CardContent className="py-12 text-center">
              <p className="text-neutral-400 mb-4">No weight entries yet</p>
              <Button
                onClick={() => setIsDialogOpen(true)}
                variant="outline"
                className="border-neutral-700 text-white hover:bg-neutral-800"
              >
                Log your first entry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {entries.map((entry, index) => {
              const weightChange = getWeightChange(index)
              return (
                <Card
                  key={entry.id}
                  className="bg-neutral-900 border-neutral-800"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-3xl font-bold text-white">
                          {entry.weight}
                          <span className="text-lg font-normal text-neutral-400 ml-1">
                            kg
                          </span>
                        </div>
                        {entry.body_fat_percentage && (
                          <div className="text-sm text-neutral-400">
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
                                  : 'text-neutral-400'
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
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                    {entry.notes && (
                      <p className="text-neutral-400 text-sm mt-4">
                        {entry.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
