'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ActionItemStatus } from '@/lib/goals'

interface GoalOption {
  id: string
  title: string
}

interface MilestoneFormFieldsProps {
  title: string
  onTitleChange: (value: string) => void
  description: string
  onDescriptionChange: (value: string) => void
  nextAction: string
  onNextActionChange: (value: string) => void
  dueDate: string
  onDueDateChange: (value: string) => void
  status: ActionItemStatus
  onStatusChange: (value: ActionItemStatus) => void
  goalId: string | null
  onGoalIdChange: (value: string | null) => void
  goalOptions: GoalOption[]
}

const NO_GOAL_VALUE = 'none'

// Shared by goals/milestones/new and goals/milestones/[id]/edit - same
// fields, same shape, so the two forms can't quietly drift from each other.
export default function MilestoneFormFields({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  nextAction,
  onNextActionChange,
  dueDate,
  onDueDateChange,
  status,
  onStatusChange,
  goalId,
  onGoalIdChange,
  goalOptions,
}: MilestoneFormFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="milestone-title" className="text-lapis-text-secondary">
          Title *
        </Label>
        <Input
          id="milestone-title"
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Build base mileage to 10k"
          className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="milestone-description" className="text-lapis-text-secondary">
          Description (optional)
        </Label>
        <Textarea
          id="milestone-description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Scope, context, anything worth remembering..."
          rows={3}
          className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled resize-none"
        />
      </div>

      {goalOptions.length > 0 && (
        <div className="space-y-2">
          <Label className="text-lapis-text-secondary">Linked goal (optional)</Label>
          <Select
            value={goalId ?? NO_GOAL_VALUE}
            onValueChange={(value) => onGoalIdChange(value === NO_GOAL_VALUE ? null : value)}
          >
            <SelectTrigger className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-lapis-bg border-lapis-border-subtle">
              <SelectItem value={NO_GOAL_VALUE}>No linked goal</SelectItem>
              {goalOptions.map((goal) => (
                <SelectItem key={goal.id} value={goal.id}>
                  {goal.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="milestone-next-action" className="text-lapis-text-secondary">
          Next action
        </Label>
        <Input
          id="milestone-next-action"
          type="text"
          value={nextAction}
          onChange={(e) => onNextActionChange(e.target.value)}
          placeholder="What's the single next concrete step?"
          className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
        />
        <p className="text-lapis-text-tertiary text-xs">
          You set this manually for now — the app isn&apos;t trying to infer it yet.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="milestone-due-date" className="text-lapis-text-secondary">
          Due date (optional)
        </Label>
        <Input
          id="milestone-due-date"
          type="date"
          value={dueDate}
          onChange={(e) => onDueDateChange(e.target.value)}
          className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-lapis-text-secondary">Status</Label>
        <Select value={status} onValueChange={(value) => onStatusChange(value as ActionItemStatus)}>
          <SelectTrigger className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-lapis-bg border-lapis-border-subtle">
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  )
}
