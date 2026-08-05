'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { CalendarDays, ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { getLocalDateString } from '@/lib/date'
import { sortUpcomingEntries, formatEntryWhen, type CalendarEntry } from '@/lib/calendar'

export default function CalendarPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [entries, setEntries] = useState<CalendarEntry[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(getLocalDateString())
  const [isMultiDay, setIsMultiDay] = useState(false)
  const [endDate, setEndDate] = useState(getLocalDateString())
  const [startTime, setStartTime] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const [entryToDelete, setEntryToDelete] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    setUserId(user.id)

    // Upcoming only - a fully-past entry (end_date already gone by) isn't
    // useful clutter in a "what's coming up" list. Still-ongoing multi-day
    // entries (end_date today or later) correctly stay visible.
    const { data, error } = await supabase
      .from('calendar_entries')
      .select('id, title, start_date, end_date, start_time, note')
      .eq('user_id', user.id)
      .gte('end_date', getLocalDateString())
      .order('start_date', { ascending: true })

    if (error) {
      console.error('Error fetching calendar entries:', error)
      setLoading(false)
      return
    }

    const mapped: CalendarEntry[] = (data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      startDate: r.start_date,
      endDate: r.end_date,
      startTime: r.start_time,
      note: r.note,
    }))
    setEntries(sortUpcomingEntries(mapped))
    setLoading(false)
  }

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setStartDate(getLocalDateString())
    setIsMultiDay(false)
    setEndDate(getLocalDateString())
    setStartTime('')
    setNote('')
  }

  const openAddDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEditDialog = (entry: CalendarEntry) => {
    setEditingId(entry.id)
    setTitle(entry.title)
    setStartDate(entry.startDate)
    setIsMultiDay(entry.endDate !== entry.startDate)
    setEndDate(entry.endDate)
    setStartTime(entry.startTime ? entry.startTime.slice(0, 5) : '')
    setNote(entry.note ?? '')
    setDialogOpen(true)
  }

  const canSave = title.trim().length > 0 && startDate.length > 0 && (!isMultiDay || endDate >= startDate)

  const handleSave = async () => {
    if (!canSave || !userId) return
    setSaving(true)

    const payload = {
      user_id: userId,
      title: title.trim(),
      start_date: startDate,
      end_date: isMultiDay ? endDate : startDate,
      start_time: startTime || null,
      note: note.trim() || null,
    }

    const { error } = editingId
      ? await supabase.from('calendar_entries').update(payload).eq('id', editingId)
      : await supabase.from('calendar_entries').insert(payload)

    setSaving(false)
    if (error) {
      console.error('Error saving calendar entry:', error)
      return
    }

    setDialogOpen(false)
    resetForm()
    fetchAll()
  }

  const handleDelete = async () => {
    if (!entryToDelete) return
    const { error } = await supabase.from('calendar_entries').delete().eq('id', entryToDelete)
    setEntryToDelete(null)
    if (error) {
      console.error('Error deleting calendar entry:', error)
      return
    }
    fetchAll()
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
        <Link href="/dashboard" className="text-white/40 hover:text-white/60 transition-colors mb-6 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-4 mb-8 mt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <CalendarDays className="w-8 h-8 text-white/80" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">Calendar</h1>
              <p className="text-white/50 text-sm">Upcoming events and commitments</p>
            </div>
          </div>

          <button
            onClick={openAddDialog}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-white/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Add Entry</span>
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center">
            <p className="text-white/40 mb-1">Nothing scheduled yet</p>
            <p className="text-white/30 text-sm">Add an entry to start keeping track of upcoming events and commitments.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {entries.map((entry) => (
              <div key={entry.id} className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-white mb-1">{entry.title}</h3>
                    <p className="text-white/50 text-sm">{formatEntryWhen(entry)}</p>
                    {entry.note && <p className="text-white/40 text-sm mt-2">{entry.note}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditDialog(entry)}
                      className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEntryToDelete(entry.id)}
                      className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
        <DialogContent className="bg-black border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Entry' : 'Add Entry'}</DialogTitle>
            <DialogDescription className="text-white/40">
              A title and a date is all you need - time and notes are optional.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="entry-title" className="text-white/80">
                Title
              </Label>
              <Input
                id="entry-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Dentist appointment"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entry-start-date" className="text-white/80">
                {isMultiDay ? 'Start date' : 'Date'}
              </Label>
              <Input
                id="entry-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-white/70">
              <input type="checkbox" checked={isMultiDay} onChange={(e) => setIsMultiDay(e.target.checked)} />
              Spans multiple days
            </label>

            {isMultiDay && (
              <div className="space-y-2">
                <Label htmlFor="entry-end-date" className="text-white/80">
                  End date
                </Label>
                <Input
                  id="entry-end-date"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="entry-time" className="text-white/80">
                Time (optional)
              </Label>
              <Input
                id="entry-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-white/5 border-white/10 text-white w-40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entry-note" className="text-white/80">
                Note (optional)
              </Label>
              <Textarea
                id="entry-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Any details worth remembering..."
                rows={3}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
              />
            </div>

            <Button onClick={handleSave} disabled={saving || !canSave} className="w-full bg-white text-black hover:bg-white/90">
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Entry'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={entryToDelete !== null}
        onOpenChange={(open) => !open && setEntryToDelete(null)}
        title="Remove Entry"
        description="Are you sure you want to remove this calendar entry?"
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={handleDelete}
        destructive
      />
    </AppLayout>
  )
}
