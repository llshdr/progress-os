'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
import { Wand2 } from 'lucide-react'
import { buildWizardRotationRows } from '@/lib/gym-schedule'

type TemplateOption = { id: string; name: string }

interface ScheduleWizardProps {
  templateOptions: TemplateOption[]
  existingSlotCount: number
  onComplete: () => void
}

// Friendlier front-end for the exact same workout_schedule_slots rotation
// the manual "Add Slot" flow writes to - not a new data model. "Days per
// week" just picks a cycle length; slot_order still has no calendar
// semantics, matching computeNextSlot()'s existing rotation-not-calendar
// design.
export default function ScheduleWizard({ templateOptions, existingSlotCount, onComplete }: ScheduleWizardProps) {
  const [open, setOpen] = useState(false)
  const [daysPerWeek, setDaysPerWeek] = useState(3)
  const [templateIds, setTemplateIds] = useState<string[]>(['', '', ''])
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const fetchDefaultDaysPerWeek = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('user_settings')
      .select('weekly_workout_goal')
      .eq('user_id', user.id)
      .maybeSingle()

    const goal = data?.weekly_workout_goal
    const initial = goal && goal >= 1 && goal <= 7 ? goal : 3
    setDaysPerWeek(initial)
    setTemplateIds(Array(initial).fill(''))
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) fetchDefaultDaysPerWeek()
  }

  const handleDaysChange = (value: number) => {
    const clamped = Math.min(7, Math.max(1, value))
    setDaysPerWeek(clamped)
    setTemplateIds((prev) => {
      const next = prev.slice(0, clamped)
      while (next.length < clamped) next.push('')
      return next
    })
  }

  const updateTemplateId = (index: number, id: string) => {
    setTemplateIds((prev) => {
      const next = [...prev]
      next[index] = id
      return next
    })
  }

  const canCreate = templateIds.length === daysPerWeek && templateIds.every((id) => id)

  const handleCreateClick = () => {
    if (!canCreate) return
    if (existingSlotCount > 0) {
      setShowReplaceConfirm(true)
    } else {
      handleCreate()
    }
  }

  const handleCreate = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setSaving(true)

    const { error: deleteError } = await supabase
      .from('workout_schedule_slots')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error clearing existing rotation:', deleteError)
      setSaving(false)
      return
    }

    const rows = buildWizardRotationRows(user.id, templateIds)
    const { error: insertError } = await supabase.from('workout_schedule_slots').insert(rows)

    if (insertError) {
      console.error('Error creating rotation:', insertError)
      setSaving(false)
      return
    }

    setSaving(false)
    setOpen(false)
    onComplete()
  }

  const restDays = 7 - daysPerWeek

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-colors">
            <Wand2 className="w-4 h-4" />
            <span className="text-sm font-medium">Quick Setup</span>
          </button>
        </DialogTrigger>
        <DialogContent className="bg-black border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Quick Setup</DialogTitle>
            <DialogDescription className="text-white/40">
              Pick how many days a week you train, then a template for each. The rest of the week fills in as
              Rest Days automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="days-per-week" className="text-white/80">
                Days per week
              </Label>
              <Input
                id="days-per-week"
                type="number"
                min={1}
                max={7}
                value={daysPerWeek}
                onChange={(e) => handleDaysChange(parseInt(e.target.value, 10) || 1)}
                className="bg-white/5 border-white/10 text-white"
              />
              <p className="text-white/40 text-xs">
                The remaining {restDays} day{restDays === 1 ? '' : 's'} of the cycle become Rest Days.
              </p>
            </div>

            <div className="space-y-3">
              {templateIds.map((id, index) => (
                <div key={index} className="space-y-2">
                  <Label className="text-white/80">Day {index + 1}</Label>
                  <select
                    value={id}
                    onChange={(e) => updateTemplateId(index, e.target.value)}
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
              ))}
            </div>

            <Button
              onClick={handleCreateClick}
              disabled={saving || !canCreate || templateOptions.length === 0}
              className="w-full bg-white text-black hover:bg-white/90"
            >
              {saving ? 'Creating...' : 'Create Rotation'}
            </Button>
            {templateOptions.length === 0 && (
              <p className="text-white/30 text-xs text-center">Create a workout template first.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={showReplaceConfirm}
        onOpenChange={setShowReplaceConfirm}
        title="Replace your current rotation?"
        description={`This deletes your existing ${existingSlotCount} slot${
          existingSlotCount === 1 ? '' : 's'
        } and replaces them with this new rotation.`}
        confirmText="Replace"
        cancelText="Cancel"
        onConfirm={handleCreate}
        destructive
      />
    </>
  )
}
