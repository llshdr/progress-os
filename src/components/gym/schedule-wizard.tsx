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
import { buildWizardRotationRows, buildWizardCalendarRows } from '@/lib/gym-schedule'

type TemplateOption = { id: string; name: string }

interface ScheduleWizardProps {
  templateOptions: TemplateOption[]
  existingSlotCount: number
  scheduleMode: 'rotation' | 'calendar'
  onComplete: () => void
}

// Friendlier front-end for the exact same workout_schedule_slots rows the
// manual "Add Slot" flow writes to - not a new data model. In rotation
// mode, slot_order is just a cycle position (computeNextSlot()'s existing
// rotation-not-calendar design, unchanged). In calendar mode, the same
// column instead means a fixed weekday index, and the wizard spreads the
// chosen templates across the week automatically via buildWizardCalendarRows.
export default function ScheduleWizard({ templateOptions, existingSlotCount, scheduleMode, onComplete }: ScheduleWizardProps) {
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

    const rows =
      scheduleMode === 'calendar'
        ? buildWizardCalendarRows(user.id, templateIds)
        : buildWizardRotationRows(user.id, templateIds)
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
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-lapis-md border border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2 transition-colors">
            <Wand2 className="w-4 h-4" />
            <span className="text-sm font-medium">Quick Setup</span>
          </button>
        </DialogTrigger>
        <DialogContent className="bg-lapis-bg border-lapis-border-subtle text-lapis-text-primary">
          <DialogHeader>
            <DialogTitle>Quick Setup</DialogTitle>
            <DialogDescription className="text-lapis-text-tertiary">
              {scheduleMode === 'calendar'
                ? 'Pick how many days a week you train, then a template for each. They’ll be spread across the week automatically (e.g. Monday/Wednesday/Friday) - you can reassign them to different days afterward.'
                : 'Pick how many days a week you train, then a template for each. The rest of the week fills in as Rest Days automatically.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="days-per-week" className="text-lapis-text-secondary">
                Days per week
              </Label>
              <Input
                id="days-per-week"
                type="number"
                min={1}
                max={7}
                value={daysPerWeek}
                onChange={(e) => handleDaysChange(parseInt(e.target.value, 10) || 1)}
                className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary"
              />
              <p className="text-lapis-text-tertiary text-xs">
                The remaining {restDays} day{restDays === 1 ? '' : 's'} of the cycle become Rest Days.
              </p>
            </div>

            <div className="space-y-3">
              {templateIds.map((id, index) => (
                <div key={index} className="space-y-2">
                  <Label className="text-lapis-text-secondary">Day {index + 1}</Label>
                  <select
                    value={id}
                    onChange={(e) => updateTemplateId(index, e.target.value)}
                    className="w-full bg-lapis-surface-2 border border-lapis-border-subtle text-lapis-text-primary rounded-lapis-sm px-4 py-2.5"
                  >
                    <option value="" className="bg-lapis-bg">
                      Select a template...
                    </option>
                    {templateOptions.map((t) => (
                      <option key={t.id} value={t.id} className="bg-lapis-bg">
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
              className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110"
            >
              {saving ? 'Creating...' : scheduleMode === 'calendar' ? 'Create Schedule' : 'Create Rotation'}
            </Button>
            {templateOptions.length === 0 && (
              <p className="text-lapis-text-disabled text-xs text-center">Create a workout template first.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={showReplaceConfirm}
        onOpenChange={setShowReplaceConfirm}
        title={scheduleMode === 'calendar' ? 'Replace your current schedule?' : 'Replace your current rotation?'}
        description={`This deletes your existing ${existingSlotCount} slot${
          existingSlotCount === 1 ? '' : 's'
        } and replaces them with this new ${scheduleMode === 'calendar' ? 'schedule' : 'rotation'}.`}
        confirmText="Replace"
        cancelText="Cancel"
        onConfirm={handleCreate}
        destructive
      />
    </>
  )
}
