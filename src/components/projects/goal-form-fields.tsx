'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ActionItemStatus } from '@/lib/projects'

interface GoalFormFieldsProps {
  title: string
  onTitleChange: (value: string) => void
  description: string
  onDescriptionChange: (value: string) => void
  targetDate: string
  onTargetDateChange: (value: string) => void
  nextAction: string
  onNextActionChange: (value: string) => void
  status: ActionItemStatus
  onStatusChange: (value: ActionItemStatus) => void
}

// Shared by projects/goals/new and projects/goals/[id]/edit - same fields,
// same shape, so the two forms can't quietly drift from each other.
export default function GoalFormFields({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  targetDate,
  onTargetDateChange,
  nextAction,
  onNextActionChange,
  status,
  onStatusChange,
}: GoalFormFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="goal-title" className="text-white/80">
          Title *
        </Label>
        <Input
          id="goal-title"
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Launch the new website"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="goal-description" className="text-white/80">
          Description (optional)
        </Label>
        <Textarea
          id="goal-description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Why this matters, what done looks like..."
          rows={3}
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="goal-target-date" className="text-white/80">
          Target date (optional)
        </Label>
        <Input
          id="goal-target-date"
          type="date"
          value={targetDate}
          onChange={(e) => onTargetDateChange(e.target.value)}
          className="bg-white/5 border-white/10 text-white"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="goal-next-action" className="text-white/80">
          Next action
        </Label>
        <Input
          id="goal-next-action"
          type="text"
          value={nextAction}
          onChange={(e) => onNextActionChange(e.target.value)}
          placeholder="What's the single next concrete step?"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
        <p className="text-white/40 text-xs">
          You set this manually for now — the app isn&apos;t trying to infer it yet.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-white/80">Status</Label>
        <Select value={status} onValueChange={(value) => onStatusChange(value as ActionItemStatus)}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-black border-white/10">
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  )
}
