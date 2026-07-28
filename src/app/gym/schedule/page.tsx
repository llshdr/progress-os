'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { CalendarDays, ArrowLeft, ArrowUp, ArrowDown, Trash2, Plus, Play } from 'lucide-react'
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
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import VolumeInsightCard from '@/components/gym/volume-insight-card'
import ScheduleWizard from '@/components/gym/schedule-wizard'
import ScheduledVolumeCard from '@/components/gym/scheduled-volume-card'
import {
  fetchScheduleSlots,
  computeNextSlot,
  computeSlotForWeekday,
  getCatchUpSlot,
  computeSlotMuscles,
  slotDisplayName,
  WEEKDAY_NAMES,
  type ScheduleSlot,
} from '@/lib/gym-schedule'
import { getLocalWeekdayIndex } from '@/lib/date'

type TemplateOption = { id: string; name: string }
type ScheduleMode = 'rotation' | 'calendar'

export default function SchedulePage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [slots, setSlots] = useState<ScheduleSlot[]>([])
  const [slotMuscles, setSlotMuscles] = useState<Record<string, string[]>>({})
  const [nextSlotId, setNextSlotId] = useState<string | null>(null)
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('rotation')
  const [catchUpSlot, setCatchUpSlot] = useState<ScheduleSlot | null>(null)
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([])
  const [loading, setLoading] = useState(true)
  const [volumeRefreshKey, setVolumeRefreshKey] = useState(0)

  const [showAddModal, setShowAddModal] = useState(false)
  const [addMode, setAddMode] = useState<'template' | 'custom'>('template')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [customLabel, setCustomLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [slotToRemove, setSlotToRemove] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    setUserId(user.id)

    const [fetchedSlots, { data: templates }, { data: lastWorkout }, { data: settings }] = await Promise.all([
      fetchScheduleSlots(supabase, user.id),
      supabase
        .from('workout_templates')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('archived', false)
        .order('display_order', { ascending: true }),
      supabase
        .from('workouts')
        .select('template_id, schedule_slot_id')
        .eq('user_id', user.id)
        .not('completed_at', 'is', null)
        .order('date', { ascending: false })
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('user_settings').select('schedule_mode').eq('user_id', user.id).maybeSingle(),
    ])

    setSlots(fetchedSlots)
    setTemplateOptions(templates ?? [])

    const mode: ScheduleMode = settings?.schedule_mode === 'calendar' ? 'calendar' : 'rotation'
    setScheduleMode(mode)

    if (mode === 'calendar') {
      const today = computeSlotForWeekday(fetchedSlots, getLocalWeekdayIndex())
      setNextSlotId(today?.id ?? null)
      setCatchUpSlot(await getCatchUpSlot(supabase, user.id, fetchedSlots))
    } else {
      const next = computeNextSlot(
        fetchedSlots,
        lastWorkout ? { templateId: lastWorkout.template_id, scheduleSlotId: lastWorkout.schedule_slot_id } : null
      )
      setNextSlotId(next?.id ?? null)
      setCatchUpSlot(null)
    }

    const muscleEntries = await Promise.all(
      fetchedSlots
        .filter((s) => s.templateId)
        .map(async (s) => [s.id, await computeSlotMuscles(supabase, s.templateId as string)] as const)
    )
    setSlotMuscles(Object.fromEntries(muscleEntries))

    setLoading(false)
  }

  const handleModeChange = async (mode: ScheduleMode) => {
    if (mode === scheduleMode) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setScheduleMode(mode)
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, schedule_mode: mode }, { onConflict: 'user_id' })

    if (error) {
      console.error('Error saving schedule mode:', error)
    }
    fetchAll()
  }

  const resetAddForm = () => {
    setAddMode('template')
    setSelectedTemplateId('')
    setCustomLabel('')
  }

  const canAddSlot = addMode === 'template' ? Boolean(selectedTemplateId) : customLabel.trim().length > 0

  const handleAddSlot = async () => {
    if (!canAddSlot) return

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setSaving(true)

    // Calendar mode: slot_order is a weekday index (0-6), so "add" fills the
    // earliest weekday with no slot yet, rather than appending past Sunday.
    // Rotation mode: append after the current highest position, unchanged.
    let nextOrder: number
    if (scheduleMode === 'calendar') {
      const used = new Set(slots.map((s) => s.slotOrder))
      nextOrder = 6
      for (let day = 0; day < 7; day++) {
        if (!used.has(day)) {
          nextOrder = day
          break
        }
      }
    } else {
      nextOrder = slots.length > 0 ? Math.max(...slots.map((s) => s.slotOrder)) + 1 : 0
    }

    const { error } = await supabase.from('workout_schedule_slots').insert({
      user_id: user.id,
      template_id: addMode === 'template' ? selectedTemplateId : null,
      label: addMode === 'custom' ? customLabel.trim() : null,
      slot_order: nextOrder,
    })

    if (error) {
      console.error('Error adding schedule slot:', error)
      setSaving(false)
      return
    }

    setSaving(false)
    setShowAddModal(false)
    resetAddForm()
    setVolumeRefreshKey((k) => k + 1)
    fetchAll()
  }

  const handleRemoveSlot = async () => {
    if (!slotToRemove) return

    const { error } = await supabase.from('workout_schedule_slots').delete().eq('id', slotToRemove)
    setSlotToRemove(null)
    if (error) {
      console.error('Error removing schedule slot:', error)
      return
    }
    setVolumeRefreshKey((k) => k + 1)
    fetchAll()
  }

  // Persisted swap, not a local-only preference - the rotation itself is
  // real, shared data (drives "what's next" and the muscle-coverage view),
  // unlike the Today page's purely personal suggestion ordering.
  const swapSlots = async (indexA: number, indexB: number) => {
    const a = slots[indexA]
    const b = slots[indexB]
    if (!a || !b) return

    const [{ error: errorA }, { error: errorB }] = await Promise.all([
      supabase.from('workout_schedule_slots').update({ slot_order: b.slotOrder }).eq('id', a.id),
      supabase.from('workout_schedule_slots').update({ slot_order: a.slotOrder }).eq('id', b.id),
    ])

    if (errorA || errorB) {
      console.error('Error reordering schedule slots:', errorA || errorB)
      return
    }

    setVolumeRefreshKey((k) => k + 1)
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
        <Link
          href="/gym"
          className="text-white/40 hover:text-white/60 transition-colors mb-6 inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Gym
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-4 mb-8 mt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <CalendarDays className="w-8 h-8 text-white/80" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">Schedule</h1>
              <p className="text-white/50 text-sm">
                {scheduleMode === 'calendar'
                  ? 'Locked to the calendar — each weekday has its own workout'
                  : 'An optional rotation — repeats as you go, not locked to calendar days'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ScheduleWizard
              templateOptions={templateOptions}
              existingSlotCount={slots.length}
              scheduleMode={scheduleMode}
              onComplete={() => {
                setVolumeRefreshKey((k) => k + 1)
                fetchAll()
              }}
            />
            <Dialog
              open={showAddModal}
              onOpenChange={(open) => {
                setShowAddModal(open)
                if (!open) resetAddForm()
              }}
            >
              <DialogTrigger>
                <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-white/90 transition-colors">
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">Add Slot</span>
                </button>
              </DialogTrigger>
              <DialogContent className="bg-black border-white/10 text-white">
              <DialogHeader>
                <DialogTitle>Add Schedule Slot</DialogTitle>
                <DialogDescription className="text-white/40">
                  {scheduleMode === 'calendar'
                    ? 'Add a template or a custom slot like "Rest Day" - it fills the earliest weekday that has none yet.'
                    : 'Add a template to the rotation, or a custom slot like "Rest Day" with no template.'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAddMode('template')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      addMode === 'template' ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    From Templates
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMode('custom')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      addMode === 'custom' ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    Custom (e.g. Rest Day)
                  </button>
                </div>

                {addMode === 'template' ? (
                  templateOptions.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-white/40 mb-3">No templates yet</p>
                      <Link href="/gym/templates/new" className="text-white hover:text-white/60 text-sm">
                        Create your first template →
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-white/80">Template</Label>
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-4 py-2.5"
                      >
                        <option value="" className="bg-black">
                          Select a template...
                        </option>
                        {templateOptions.map((t) => (
                          <option key={t.id} value={t.id} className="bg-black">
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="slot-label" className="text-white/80">
                      Label
                    </Label>
                    <Input
                      id="slot-label"
                      type="text"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                      placeholder="Rest Day"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                )}

                <Button
                  onClick={handleAddSlot}
                  disabled={saving || !canAddSlot}
                  className="w-full bg-white text-black hover:bg-white/90"
                >
                  {saving ? 'Adding...' : scheduleMode === 'calendar' ? 'Add to Schedule' : 'Add to Rotation'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => handleModeChange('rotation')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              scheduleMode === 'rotation' ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Rotation
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('calendar')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              scheduleMode === 'calendar' ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Calendar
          </button>
        </div>

        {scheduleMode === 'calendar' && catchUpSlot && (
          <div className="border border-white/20 rounded-2xl bg-white/[0.04] p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
            <p className="text-white text-sm">
              You didn&apos;t log <span className="font-medium">{slotDisplayName(catchUpSlot)}</span> on{' '}
              {WEEKDAY_NAMES[catchUpSlot.slotOrder]}.
            </p>
            <Link
              href={`/gym/workouts/new?slot=${catchUpSlot.id}`}
              className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors shrink-0"
            >
              Start catch-up workout
            </Link>
          </div>
        )}

        <div className="mb-10">
          {slots.length === 0 ? (
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center">
              <p className="text-white/40 mb-4">
                {scheduleMode === 'calendar' ? 'No schedule set up yet' : 'No rotation set up yet'} — entirely optional.
              </p>
              <p className="text-white/30 text-sm">
                Add a slot to start one, or ignore this page completely — nothing else in the app depends on it.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {scheduleMode === 'calendar' && slots.length < 7 && (
                <p className="text-white/30 text-xs mb-1">
                  {7 - slots.length} weekday{7 - slots.length === 1 ? '' : 's'} still have no slot assigned — use
                  Quick Setup or Add Slot to fill them in.
                </p>
              )}
              {slots.map((slot, index) => (
                <div
                  key={slot.id}
                  className={`border rounded-2xl bg-white/[0.02] p-6 transition-all duration-200 ${
                    slot.id === nextSlotId ? 'border-white/30' : 'border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      {scheduleMode === 'calendar' && (
                        <p className="text-white/40 text-xs uppercase tracking-wide mb-1">
                          {WEEKDAY_NAMES[slot.slotOrder]}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-medium text-white">{slotDisplayName(slot)}</h3>
                        {slot.id === nextSlotId && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-white text-black font-medium">
                            {scheduleMode === 'calendar' ? 'Today' : 'Next'}
                          </span>
                        )}
                      </div>
                      {slot.templateId && (slotMuscles[slot.id]?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {slotMuscles[slot.id].map((muscle) => (
                            <span
                              key={muscle}
                              className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10"
                            >
                              {muscle}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {slot.templateId && (
                        <Link
                          href={`/gym/workouts/new?slot=${slot.id}`}
                          className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors"
                          title="Start this slot"
                        >
                          <Play className="w-4 h-4" />
                        </Link>
                      )}
                      <button
                        onClick={() => swapSlots(index, index - 1)}
                        disabled={index === 0}
                        className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
                        title={scheduleMode === 'calendar' ? 'Move to previous day' : 'Move up'}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => swapSlots(index, index + 1)}
                        disabled={index === slots.length - 1}
                        className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
                        title={scheduleMode === 'calendar' ? 'Move to next day' : 'Move down'}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setSlotToRemove(slot.id)}
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

        <VolumeInsightCard refreshKey={volumeRefreshKey} />
        {userId && <ScheduledVolumeCard userId={userId} />}
      </div>

      <ConfirmationModal
        open={slotToRemove !== null}
        onOpenChange={(open) => !open && setSlotToRemove(null)}
        title="Remove Slot"
        description="Are you sure you want to remove this slot from the rotation?"
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={handleRemoveSlot}
        destructive
      />
    </AppLayout>
  )
}
