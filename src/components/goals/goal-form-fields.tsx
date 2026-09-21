'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ActionItemStatus, GoalScope } from '@/lib/goals'
import type { WorldStyle } from '@/lib/journey'
import { SCOPE_LABELS } from '@/lib/rank'
import { worldScenery } from '@/lib/world-progress'

interface GoalFormFieldsProps {
  worldStyle: WorldStyle | null
  attention: 'focus' | 'later' | 'paused'
  onAttentionChange: (value: 'focus' | 'later' | 'paused') => void
  onWorldStyleChange: (value: WorldStyle | null) => void
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
  autoBlockBeforeDeadline: boolean
  onAutoBlockBeforeDeadlineChange: (value: boolean) => void
  dependsOnGoalId: string | null
  onDependsOnGoalIdChange: (value: string | null) => void
  availableGoals: { id: string; title: string }[]
  // The goal detail page now has its own prominent, immediately-saving
  // "what's next" editor (see goals/[id]/page.tsx) - hiding the field
  // here avoids two separate places that edit the same column with two
  // separate save paths. goals/new still shows it (there's no detail-
  // page hero yet for a goal that doesn't exist).
  hideNextAction?: boolean
}

// Shared by goals/new and the goal detail page - same fields, same shape,
// so the two forms can't quietly drift from each other.
export default function GoalFormFields({
  worldStyle,
  attention,
  onAttentionChange,
  onWorldStyleChange,
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
  autoBlockBeforeDeadline,
  onAutoBlockBeforeDeadlineChange,
  dependsOnGoalId,
  onDependsOnGoalIdChange,
  availableGoals,
  hideNextAction = false,
}: GoalFormFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="goal-title" className="text-lapis-text-secondary">
          Title *
        </Label>
        <Input
          id="goal-title"
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Launch the new website"
          className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="goal-description" className="text-lapis-text-secondary">
          Description (optional)
        </Label>
        <Textarea
          id="goal-description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Why this matters, what done looks like..."
          rows={3}
          className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="goal-start-date" className="text-lapis-text-secondary">
          Start date (optional)
        </Label>
        <Input
          id="goal-start-date"
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="goal-target-date" className="text-lapis-text-secondary">
          Target date (optional)
        </Label>
        <Input
          id="goal-target-date"
          type="date"
          value={targetDate}
          onChange={(e) => onTargetDateChange(e.target.value)}
          className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary"
        />
        <p className="text-lapis-text-tertiary text-xs">
          Used to space out a generated plan&apos;s milestone due dates.
        </p>
      </div>

      {targetDate && (
        <label className="flex items-center gap-2 text-sm text-lapis-text-secondary">
          <input
            type="checkbox"
            checked={autoBlockBeforeDeadline}
            onChange={(e) => onAutoBlockBeforeDeadlineChange(e.target.checked)}
          />
          Block time on my Calendar a few days before this is due
        </label>
      )}

      {!hideNextAction && (
        <div className="space-y-2">
          <Label htmlFor="goal-next-action" className="text-lapis-text-secondary">
            Next action
          </Label>
          <Input
            id="goal-next-action"
            type="text"
            value={nextAction}
            onChange={(e) => onNextActionChange(e.target.value)}
            placeholder="What's the single next concrete step?"
            className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
          />
          <p className="text-lapis-text-tertiary text-xs">
            You can always add more detail once you&apos;ve created the goal.
          </p>
        </div>
      )}

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

      <div className="space-y-2">
        <Label className="text-lapis-text-secondary">Scope (optional)</Label>
        <Select
          value={scope ?? 'none'}
          onValueChange={(value) => onScopeChange(value === 'none' ? null : (value as GoalScope))}
        >
          <SelectTrigger className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-lapis-bg border-lapis-border-subtle">
            <SelectItem value="none">Not set</SelectItem>
            <SelectItem value="quick_win">{SCOPE_LABELS.quick_win}</SelectItem>
            <SelectItem value="milestone">{SCOPE_LABELS.milestone}</SelectItem>
            <SelectItem value="long_term">{SCOPE_LABELS.long_term}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-lapis-text-tertiary text-xs">
          Choose the scale of this goal. It helps organize your goals and World; it doesn’t limit your Level.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="goal-attention" className="text-lapis-text-secondary">Where this fits right now</Label>
        <select id="goal-attention" value={attention} onChange={e=>onAttentionChange(e.target.value as 'focus'|'later'|'paused')} className="lapis-field"><option value="focus">Focus now</option><option value="later">On the horizon</option><option value="paused">Taking a pause</option></select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="goal-world-style" className="text-lapis-text-secondary">Place in your world</Label>
        <select id="goal-world-style" value={worldStyle ?? 'auto'} onChange={e => onWorldStyleChange(e.target.value === 'auto' ? null : e.target.value as WorldStyle)} className="min-h-12 w-full rounded-xl border border-lapis-border bg-lapis-surface-2 px-3">
          <option value="auto">Automatic</option><option value="summit">Summit — a major ambition</option><option value="basecamp">Basecamp — something you are building</option><option value="trail">Trail — a smaller step</option>
        </select>
        <div className="grid grid-cols-3 gap-2 pt-2">
          {(['summit','trail','basecamp'] as WorldStyle[]).map(style=><button key={style} type="button" aria-label={`Choose ${style} landscape`} aria-pressed={worldStyle===style} onClick={()=>onWorldStyleChange(style)} className={`relative overflow-hidden rounded-xl border ${worldStyle===style?'border-lapis-accent-400':'border-lapis-border'}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Local generated landscape preview. */}
            <img src={worldScenery(style)} alt="" className="h-28 w-full object-cover object-top"/>
            <span className="absolute inset-x-0 bottom-0 bg-slate-950/80 py-2 text-xs capitalize">{style}</span>
          </button>)}
        </div>
        <p className="text-sm text-lapis-text-secondary">Any goal can be a summit. Changing its appearance keeps your milestones and history.</p>
      </div>

      {availableGoals.length > 0 && (
        <div className="space-y-2">
          <Label className="text-lapis-text-secondary">Depends on (optional)</Label>
          <Select
            value={dependsOnGoalId ?? 'none'}
            onValueChange={(value) => onDependsOnGoalIdChange(value === 'none' ? null : value)}
          >
            <SelectTrigger className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-lapis-bg border-lapis-border-subtle">
              <SelectItem value="none">Not blocked by another goal</SelectItem>
              {availableGoals.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-lapis-text-tertiary text-xs">
            If set, this goal is flagged as blocked until that one is marked done.
          </p>
        </div>
      )}
    </>
  )
}
