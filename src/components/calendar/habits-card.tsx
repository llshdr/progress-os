'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { WEEKDAY_NAMES } from '@/lib/gym-schedule'
import type { Habit } from '@/lib/habits'

interface Props {
  habits: Habit[]
  onChanged: () => void
}

// Simple, fully optional habit definitions (name + optional weekday
// schedule + optional usual time) - never mandatory, no streak-breaking
// mechanic anywhere. Logging a habit done happens directly from the day
// view's timed block/all-day pill (see calendar/page.tsx), not here -
// this card is only for defining what a habit is, same split as
// DisruptionDeclaration (declare) vs. the Calendar day view (act).
export default function HabitsCard({ habits, onChanged }: Props) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [hasSchedule, setHasSchedule] = useState(false)
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [hasTime, setHasTime] = useState(false)
  const [usualTime, setUsualTime] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setHasSchedule(false)
    setWeekdays([])
    setHasTime(false)
    setUsualTime('')
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) resetForm()
  }

  const openEditDialog = (habit: Habit) => {
    setEditingId(habit.id)
    setName(habit.name)
    setHasSchedule(!!habit.recurrenceWeekdays && habit.recurrenceWeekdays.length > 0)
    setWeekdays(habit.recurrenceWeekdays ?? [])
    setHasTime(habit.usualTime != null)
    setUsualTime(habit.usualTime ? habit.usualTime.slice(0, 5) : '')
    setOpen(true)
  }

  const toggleWeekday = (weekday: number) => {
    setWeekdays((prev) => (prev.includes(weekday) ? prev.filter((d) => d !== weekday) : [...prev, weekday].sort()))
  }

  const canSave = name.trim().length > 0 && (!hasSchedule || weekdays.length > 0) && (!hasTime || usualTime.length > 0)

  const handleSave = async () => {
    if (!canSave) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setSaving(true)
    const payload = {
      user_id: user.id,
      name: name.trim(),
      recurrence_weekdays: hasSchedule ? weekdays : null,
      usual_time: hasTime ? usualTime : null,
    }

    const { error } = editingId
      ? await supabase.from('habits').update(payload).eq('id', editingId)
      : await supabase.from('habits').insert(payload)

    setSaving(false)
    if (error) {
      console.error('Error saving habit:', error)
      return
    }
    setOpen(false)
    resetForm()
    onChanged()
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('habits').delete().eq('id', id)
    if (error) {
      console.error('Error deleting habit:', error)
      return
    }
    onChanged()
  }

  return (
    <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-medium text-white">Habits</h2>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger>
            <button className="text-xs text-white/40 hover:text-white/60 transition-colors underline underline-offset-2">Add a habit</button>
          </DialogTrigger>
          <DialogContent className="bg-black border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit habit' : 'Add a habit'}</DialogTitle>
              <DialogDescription className="text-white/40">
                Fully optional - a name is all you need. Skip the schedule and time if this doesn&apos;t have a fixed rhythm.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="habit-name" className="text-white/80">
                  Name
                </Label>
                <Input
                  id="habit-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Read, stretch, sleep by 11..."
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-white/70">
                <input type="checkbox" checked={hasSchedule} onChange={(e) => setHasSchedule(e.target.checked)} />
                Only on certain days
              </label>

              {hasSchedule && (
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_NAMES.map((wname, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleWeekday(i)}
                      className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                        weekdays.includes(i) ? 'bg-white text-black' : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {wname.slice(0, 3)}
                    </button>
                  ))}
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-white/70">
                <input type="checkbox" checked={hasTime} onChange={(e) => setHasTime(e.target.checked)} />
                Has a usual time
              </label>

              {hasTime && (
                <div className="space-y-2">
                  <Label htmlFor="habit-time" className="text-white/80">
                    Usual time
                  </Label>
                  <Input
                    id="habit-time"
                    type="time"
                    value={usualTime}
                    onChange={(e) => setUsualTime(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              )}

              <Button onClick={handleSave} disabled={saving || !canSave} className="w-full bg-white text-black hover:bg-white/90">
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add habit'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {habits.length === 0 ? (
        <p className="text-white/40 text-sm">None yet.</p>
      ) : (
        <div className="space-y-3">
          {habits.map((habit) => (
            <div key={habit.id} className="border border-white/10 rounded-xl p-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-white text-sm">{habit.name}</p>
                <p className="text-white/40 text-xs mt-0.5">
                  {habit.recurrenceWeekdays && habit.recurrenceWeekdays.length > 0
                    ? habit.recurrenceWeekdays.map((d) => WEEKDAY_NAMES[d].slice(0, 3)).join(', ')
                    : 'Every day'}
                  {habit.usualTime && ` · ${habit.usualTime.slice(0, 5)}`}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => openEditDialog(habit)} className="text-white/30 hover:text-white/60 text-xs transition-colors">
                  Edit
                </button>
                <button onClick={() => handleDelete(habit.id)} className="text-white/30 hover:text-white/60 text-xs transition-colors">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
