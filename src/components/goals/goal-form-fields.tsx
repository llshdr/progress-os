'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ActionItemStatus, GoalScope } from '@/lib/goals'
import { SCOPE_LABELS } from '@/lib/rank'

interface GoalFormFieldsProps {
  title: string
  onTitleChange: (value: string) => void
  description: string
  onDescriptionChange: (value: string) => void
  startDate: string
  onStartDateChange: (value: string) => void
  targetDate: string
  onTargetDateChange: (value: string) => void
  nextAction: string
  onNextActionChange: (value: string) => void
  status: ActionItemStatus
  onStatusChange: (value: ActionItemStatus) => void
  scope: GoalScope | null
  onScopeChange: (value: GoalScope | null) => void
}

// Shared by goals/new and the goal detail page - same fields, same shape,
// so the two forms can't quietly drift from each other.
export default function GoalFormFields({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  startDate,
  onStartDateChange,
  targetDate,
  onTargetDateChange,
  nextAction,
  onNextActionChange,
  status,
  onStatusChange,
  scope,
  onScopeChange,
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
        <Label htmlFor="goal-start-date" className="text-white/80">
          Start date (optional)
        </Label>
        <Input
          id="goal-start-date"
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="bg-white/5 border-white/10 text-white"
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
        <p className="text-white/40 text-xs">
          Used to space out a generated plan&apos;s milestone due dates.
        </p>
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

      <div className="space-y-2">
        <Label className="text-white/80">Scope (optional)</Label>
        <Select
          value={scope ?? 'none'}
          onValueChange={(value) => onScopeChange(value === 'none' ? null : (value as GoalScope))}
        >
          <SelectTrigger className="bg-white/5 border-white/10 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-black border-white/10">
            <SelectItem value="none">Not set</SelectItem>
            <SelectItem value="quick_win">{SCOPE_LABELS.quick_win}</SelectItem>
            <SelectItem value="milestone">{SCOPE_LABELS.milestone}</SelectItem>
            <SelectItem value="long_term">{SCOPE_LABELS.long_term}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-white/40 text-xs">
          How big you consider this — affects your rank ceiling, not shown to anyone else.
        </p>
      </div>
    </>
  )
}
