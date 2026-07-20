'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ActionItemStatus } from '@/lib/projects'

interface GoalOption {
  id: string
  title: string
}

interface ProjectFormFieldsProps {
  title: string
  onTitleChange: (value: string) => void
  description: string
  onDescriptionChange: (value: string) => void
  nextAction: string
  onNextActionChange: (value: string) => void
  status: ActionItemStatus
  onStatusChange: (value: ActionItemStatus) => void
  goalId: string | null
  onGoalIdChange: (value: string | null) => void
  goalOptions: GoalOption[]
}

const NO_GOAL_VALUE = 'none'

// Shared by projects/all/new and projects/all/[id]/edit - same fields, same
// shape, so the two forms can't quietly drift from each other.
export default function ProjectFormFields({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  nextAction,
  onNextActionChange,
  status,
  onStatusChange,
  goalId,
  onGoalIdChange,
  goalOptions,
}: ProjectFormFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="project-title" className="text-white/80">
          Title *
        </Label>
        <Input
          id="project-title"
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Redesign onboarding flow"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-description" className="text-white/80">
          Description (optional)
        </Label>
        <Textarea
          id="project-description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Scope, context, anything worth remembering..."
          rows={3}
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
        />
      </div>

      {goalOptions.length > 0 && (
        <div className="space-y-2">
          <Label className="text-white/80">Linked goal (optional)</Label>
          <Select
            value={goalId ?? NO_GOAL_VALUE}
            onValueChange={(value) => onGoalIdChange(value === NO_GOAL_VALUE ? null : value)}
          >
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/10">
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
        <Label htmlFor="project-next-action" className="text-white/80">
          Next action
        </Label>
        <Input
          id="project-next-action"
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
