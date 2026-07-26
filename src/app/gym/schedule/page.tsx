'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { CalendarDays, ArrowLeft, ArrowUp, ArrowDown, Trash2, Plus } from 'lucide-react'
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
import VolumeInsightCard from '@/components/gym/volume-insight-card'
import { fetchScheduleSlots, computeNextSlot, computeSlotMuscles, slotDisplayName, type ScheduleSlot } from '@/lib/gym-schedule'

type TemplateOption = { id: string; name: string }

export default function SchedulePage() {
  const [slots, setSlots] = useState<ScheduleSlot[]>([])
  const [slotMuscles, setSlotMuscles] = useState<Record<string, string[]>>({})
  const [nextSlotId, setNextSlotId] = useState<string | null>(null)
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([])
  const [loading, setLoading] = useState(true)
  const [volumeRefreshKey, setVolumeRefreshKey] = useState(0)

  const [showAddModal, setShowAddModal] = useState(false)
  const [addMode, setAddMode] = useState<'template' | 'custom'>('template')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [customLabel, setCustomLabel] = useState('')
  const [saving, setSaving] = useState(false)

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

    const [fetchedSlots, { data: templates }, { data: lastWorkout }] = await Promise.all([
      fetchScheduleSlots(supabase, user.id),
      supabase
        .from('workout_templates')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('archived', false)
        .order('display_order', { ascending: true }),
      supabase
        .from('workouts')
        .select('template_id')
        .eq('user_id', user.id)
        .not('completed_at', 'is', null)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    setSlots(fetchedSlots)
    setTemplateOptions(templates ?? [])

    const next = computeNextSlot(fetchedSlots, lastWorkout?.template_id ?? null)
    setNextSlotId(next?.id ?? null)

    const muscleEntries = await Promise.all(
      fetchedSlots
        .filter((s) => s.templateId)
        .map(async (s) => [s.id, await computeSlotMuscles(supabase, s.templateId as string)] as const)
    )
    setSlotMuscles(Object.fromEntries(muscleEntries))

    setLoading(false)
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

    const nextOrder = slots.length > 0 ? Math.max(...slots.map((s) => s.slotOrder)) + 1 : 0

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

  const handleRemoveSlot = async (id: string) => {
    const { error } = await supabase.from('workout_schedule_slots').delete().eq('id', id)
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

        <div className="flex items-center justify-between gap-4 mb-8 mt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <CalendarDays className="w-8 h-8 text-white/80" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">Schedule</h1>
              <p className="text-white/50 text-sm">
                An optional rotation — repeats as you go, not locked to calendar days
              </p>
            </div>
          </div>

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
                  Add a template to the rotation, or a custom slot like "Rest Day" with no template.
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
                  {saving ? 'Adding...' : 'Add to Rotation'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-10">
          {slots.length === 0 ? (
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center">
              <p className="text-white/40 mb-4">No rotation set up yet — entirely optional.</p>
              <p className="text-white/30 text-sm">
                Add a slot to start one, or ignore this page completely — nothing else in the app depends on it.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {slots.map((slot, index) => (
                <div
                  key={slot.id}
                  className={`border rounded-2xl bg-white/[0.02] p-6 transition-all duration-200 ${
                    slot.id === nextSlotId ? 'border-white/30' : 'border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-medium text-white">{slotDisplayName(slot)}</h3>
                        {slot.id === nextSlotId && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-white text-black font-medium">
                            Next
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
                      <button
                        onClick={() => swapSlots(index, index - 1)}
                        disabled={index === 0}
                        className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
                        title="Move up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => swapSlots(index, index + 1)}
                        disabled={index === slots.length - 1}
                        className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
                        title="Move down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveSlot(slot.id)}
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
      </div>
    </AppLayout>
  )
}
