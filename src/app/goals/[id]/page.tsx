'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'
import { Sparkles, Trash2, Lock, ChevronDown, ChevronRight, History } from 'lucide-react'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import GoalFormFields from '@/components/goals/goal-form-fields'
import type { ActionItemStatus, GoalScope } from '@/lib/goals'
import { PageSkeleton } from '@/components/ui/page-skeleton'

type LinkedMilestone = {
  id: string
  title: string
  description: string | null
  next_action: string | null
  due_date: string | null
  status: ActionItemStatus
}

type Checkin = {
  id: string
  focus: string
  ai_suggestion: string | null
  created_at: string
}

function formatCheckinDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function GoalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [savingNextAction, setSavingNextAction] = useState(false)
  const [status, setStatus] = useState<ActionItemStatus>('active')
  const [scope, setScope] = useState<GoalScope | null>(null)
  const [autoBlockBeforeDeadline, setAutoBlockBeforeDeadline] = useState(false)
  const [dependsOnGoalId, setDependsOnGoalId] = useState<string | null>(null)
  const [availableGoals, setAvailableGoals] = useState<{ id: string; title: string }[]>([])
  const [prerequisite, setPrerequisite] = useState<{ title: string; status: ActionItemStatus } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [linkedMilestones, setLinkedMilestones] = useState<LinkedMilestone[]>([])
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // What I'm trying / check-ins - the lightweight, iterative core of this
  // redesign (see goal_checkins, migration 082). Real history for free:
  // the "current focus" is just the most recent row, no separate mutable
  // field to keep in sync.
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [newCheckinText, setNewCheckinText] = useState('')
  const [loggingCheckin, setLoggingCheckin] = useState(false)
  const [gettingIdea, setGettingIdea] = useState(false)
  const [ideaError, setIdeaError] = useState<string | null>(null)

  const [showDetails, setShowDetails] = useState(false)
  // null = no explicit user choice yet - defaults to expanded only when
  // this goal already has real milestones, so existing content is never
  // hidden, but a goal with none starts collapsed behind "+ Want a fuller
  // plan?" per the lighter default philosophy. Once the user explicitly
  // toggles it, their choice wins for the rest of the session.
  const [milestonesOverride, setMilestonesOverride] = useState<boolean | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchGoal()
  }, [params.id])

  const fetchCheckins = async () => {
    const { data, error } = await supabase
      .from('goal_checkins')
      .select('id, focus, ai_suggestion, created_at')
      .eq('goal_id', params.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching check-ins:', error)
    } else {
      setCheckins(data ?? [])
    }
  }

  const fetchGoal = async () => {
    const { data, error } = await supabase.from('goals').select('*').eq('id', params.id).single()

    if (error) {
      console.error('Error fetching goal:', error)
      setLoading(false)
      return
    }

    setTitle(data.title)
    setDescription(data.description || '')
    setStartDate(data.start_date || '')
    setTargetDate(data.target_date || '')
    setNextAction(data.next_action || '')
    setStatus(data.status)
    setScope(data.scope ?? null)
    setAutoBlockBeforeDeadline(data.auto_block_before_deadline ?? false)
    setDependsOnGoalId(data.depends_on_goal_id ?? null)

    const { data: goalsList } = await supabase
      .from('goals')
      .select('id, title')
      .eq('user_id', data.user_id)
      .neq('status', 'archived')
      .neq('id', params.id as string)
    setAvailableGoals(goalsList ?? [])

    if (data.depends_on_goal_id) {
      const { data: prereq } = await supabase.from('goals').select('title, status').eq('id', data.depends_on_goal_id).maybeSingle()
      setPrerequisite(prereq ? { title: prereq.title, status: prereq.status } : null)
    } else {
      setPrerequisite(null)
    }

    const { data: milestones, error: milestonesError } = await supabase
      .from('milestones')
      .select('id, title, description, next_action, due_date, status')
      .eq('goal_id', params.id)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })

    if (milestonesError) {
      console.error('Error fetching linked milestones:', milestonesError)
    } else {
      setLinkedMilestones(milestones || [])
    }

    await fetchCheckins()
    setLoading(false)
  }

  const handleSaveNextAction = async (value: string) => {
    setSavingNextAction(true)
    const trimmed = value.trim()
    const { error } = await supabase.from('goals').update({ next_action: trimmed || null }).eq('id', params.id)
    if (error) {
      console.error('Error saving next action:', error)
    } else {
      setNextAction(trimmed)
    }
    setSavingNextAction(false)
  }

  const handleLogCheckin = async () => {
    if (!newCheckinText.trim()) return
    setLoggingCheckin(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoggingCheckin(false)
      return
    }

    const { error } = await supabase.from('goal_checkins').insert({
      user_id: user.id,
      goal_id: params.id,
      focus: newCheckinText.trim(),
    })

    if (error) {
      console.error('Error logging check-in:', error)
      setLoggingCheckin(false)
      return
    }

    setNewCheckinText('')
    setLoggingCheckin(false)
    await fetchCheckins()
  }

  // force=true bypasses the route's cache (the button reads "Get another
  // idea" once one already exists for the latest check-in) - otherwise a
  // repeat click just returns whatever's already saved, no new Gemini call.
  const handleGetIdea = async (force: boolean) => {
    setGettingIdea(true)
    setIdeaError(null)

    try {
      const res = await fetch('/api/ai-coach/goal-next-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId: params.id, force }),
      })
      const data = await res.json()

      if (data.status === 'ok') {
        await fetchCheckins()
      } else if (data.status === 'not_enough_context') {
        setIdeaError("Log what you're trying first, then get an idea.")
      } else {
        setIdeaError('Could not get an idea right now — try again later.')
      }
    } catch (err) {
      console.error('Error getting next-step idea:', err)
      setIdeaError('Could not get an idea right now — try again later.')
    } finally {
      setGettingIdea(false)
    }
  }

  const handleGeneratePlan = async () => {
    setGeneratingPlan(true)
    setPlanError(null)

    try {
      const res = await fetch('/api/ai-coach/goal-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId: params.id }),
      })
      const data = await res.json()

      if (data.status === 'ok') {
        await fetchGoal()
      } else {
        setPlanError('Could not generate a plan right now — try again later.')
      }
    } catch (err) {
      console.error('Error generating goal plan:', err)
      setPlanError('Could not generate a plan right now — try again later.')
    } finally {
      setGeneratingPlan(false)
    }
  }

  const isValid = title.trim().length > 0

  const handleUpdate = async () => {
    if (!isValid) return

    setSaving(true)

    // next_action is deliberately NOT included here - the hero above has
    // its own dedicated, immediately-saving editor for that column now,
    // so this form never resaves a possibly-stale copy of it.
    const { error } = await supabase
      .from('goals')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        start_date: startDate || null,
        target_date: targetDate || null,
        status,
        scope,
        auto_block_before_deadline: autoBlockBeforeDeadline,
        depends_on_goal_id: dependsOnGoalId,
      })
      .eq('id', params.id)

    if (error) {
      console.error('Error updating goal:', error)
      setSaving(false)
    } else {
      router.push('/goals')
    }
  }

  const handleDeleteGoal = async () => {
    const { error } = await supabase.from('goals').delete().eq('id', params.id)

    if (error) {
      console.error('Error deleting goal:', error)
      return
    }
    router.push('/goals')
  }

  if (loading) {
    return (
      <AppLayout>
        <PageSkeleton />
      </AppLayout>
    )
  }

  const latestSuggestion = checkins[0]?.ai_suggestion ?? null
  const milestonesExpanded = milestonesOverride ?? linkedMilestones.length > 0
  const doneMilestoneCount = linkedMilestones.filter((m) => m.status === 'done').length

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <Link href="/goals" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors">
            ← Back
          </Link>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 transition-colors"
            title="Delete goal"
          >
            <Trash2 className="w-5 h-5 text-lapis-text-tertiary" />
          </button>
        </div>

        <div className="mb-6">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-1">{title}</h1>
          {description && <p className="text-lapis-text-tertiary text-sm max-w-xl">{description}</p>}
        </div>

        {prerequisite && prerequisite.status !== 'done' && (
          <div className="flex items-center gap-3 border border-lapis-border-strong rounded-lapis-md bg-lapis-surface-2 p-4 mb-6">
            <Lock className="w-4 h-4 text-lapis-text-tertiary shrink-0" />
            <p className="text-lapis-text-secondary text-sm">
              Blocked until <span className="text-lapis-text-primary font-medium">&ldquo;{prerequisite.title}&rdquo;</span> is done.
            </p>
          </div>
        )}

        {/* Hero - the single most important thing on this page. What's
            next is always visible and always the first real content,
            editable right here with its own immediate save - no
            scrolling to a buried form field to change the one thing
            that actually matters day to day. */}
        <div className="border border-lapis-border-strong rounded-lapis-xl bg-lapis-surface-1 p-6 mb-6">
          <p className="font-data text-[10px] tracking-[0.14em] uppercase text-lapis-text-tertiary mb-3">What&apos;s Next</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="What's the single next thing to do?"
              className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary text-lg placeholder:text-lapis-text-disabled flex-1"
            />
            <Button
              onClick={() => handleSaveNextAction(nextAction)}
              disabled={savingNextAction}
              variant="outline"
              className="border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2 shrink-0"
            >
              {savingNextAction ? 'Saving...' : 'Save'}
            </Button>
          </div>

          {latestSuggestion && (
            <div className="mt-4 flex items-start gap-2.5 border border-lapis-gold-500/40 rounded-lapis-md bg-lapis-gold-500/[0.06] p-3">
              <Sparkles className="w-4 h-4 text-lapis-gold-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-lapis-text-primary text-sm">{latestSuggestion}</p>
                <button
                  onClick={() => handleSaveNextAction(latestSuggestion)}
                  className="text-lapis-gold-500 hover:brightness-125 text-xs font-medium mt-1.5 transition-all"
                >
                  Use this as my next step
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => handleGetIdea(latestSuggestion != null)}
              disabled={gettingIdea || checkins.length === 0}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-subtle hover:bg-lapis-surface-2 hover:text-lapis-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {gettingIdea ? 'Thinking...' : latestSuggestion ? 'Get another idea' : 'Get an idea'}
            </button>
            {checkins.length === 0 && (
              <p className="text-lapis-text-disabled text-xs">Log what you&apos;re trying below first</p>
            )}
          </div>
          {ideaError && <p className="text-lapis-garnet text-xs mt-2">{ideaError}</p>}
        </div>

        {/* What I've tried - a low-friction log, not a form. Logging a
            check-in is the one thing this page asks you to do regularly;
            everything else is secondary and tucked away below. */}
        <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-lapis-text-tertiary" />
            <h2 className="text-lg font-medium text-lapis-text-primary">What I&apos;ve Tried</h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <Textarea
              value={newCheckinText}
              onChange={(e) => setNewCheckinText(e.target.value)}
              placeholder="What are you trying right now?"
              rows={2}
              className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled resize-none flex-1"
            />
            <Button
              onClick={handleLogCheckin}
              disabled={loggingCheckin || !newCheckinText.trim()}
              className="bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 shrink-0 self-start"
            >
              {loggingCheckin ? 'Logging...' : 'Log it'}
            </Button>
          </div>

          {checkins.length === 0 ? (
            <p className="text-lapis-text-tertiary text-sm">Nothing logged yet - what are you trying first?</p>
          ) : (
            <div className="space-y-3">
              {checkins.map((checkin) => (
                <div key={checkin.id} className="border-l-2 border-lapis-border-subtle pl-4">
                  <p className="text-lapis-text-primary text-sm">{checkin.focus}</p>
                  <p className="text-lapis-text-disabled text-xs mt-0.5">{formatCheckinDate(checkin.created_at)}</p>
                  {checkin.ai_suggestion && (
                    <p className="text-lapis-text-tertiary text-xs mt-1.5 flex items-start gap-1.5">
                      <Sparkles className="w-3 h-3 text-lapis-gold-500 shrink-0 mt-0.5" />
                      {checkin.ai_suggestion}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Milestones - the heavier, optional path. Collapsed by default
            for a goal that doesn't have any yet (this redesign's default
            is the lightweight flow above); a goal that already has real
            milestones keeps them expanded - existing content is never
            hidden. */}
        <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 mb-6">
          <button
            onClick={() => setMilestonesOverride(!milestonesExpanded)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              {milestonesExpanded ? (
                <ChevronDown className="w-4 h-4 text-lapis-text-tertiary" />
              ) : (
                <ChevronRight className="w-4 h-4 text-lapis-text-tertiary" />
              )}
              <span className="text-lapis-text-primary font-medium">
                {linkedMilestones.length > 0 ? 'Milestones' : 'Want a fuller milestone plan?'}
              </span>
            </div>
            {linkedMilestones.length > 0 && (
              <span className="text-lapis-text-tertiary text-xs">
                {doneMilestoneCount} of {linkedMilestones.length} done
              </span>
            )}
          </button>

          {milestonesExpanded && (
            <div className="mt-4">
              <p className="text-lapis-text-tertiary text-sm mb-4">
                Optional, heavier structure for goals with real dated deliverables - most goals do fine with just
                What&apos;s Next above.
              </p>

              {linkedMilestones.length > 0 && (
                <div className="mb-4">
                  <div className="w-full bg-lapis-surface-3 rounded-full h-2 mb-4">
                    <div
                      className="bg-lapis-accent-500 rounded-full h-2 transition-all duration-300"
                      style={{ width: `${Math.round((doneMilestoneCount / linkedMilestones.length) * 100)}%` }}
                    />
                  </div>
                  <div className="space-y-3">
                    {linkedMilestones.map((milestone) => (
                      <div key={milestone.id} className="border border-lapis-border-subtle rounded-lapis-md bg-lapis-surface-1 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lapis-text-primary font-medium text-sm">{milestone.title}</h3>
                              <span className="px-2 py-0.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-tertiary border border-lapis-border-subtle">
                                {milestone.status}
                              </span>
                              {milestone.due_date && (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-tertiary border border-lapis-border-subtle">
                                  Due {new Date(milestone.due_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            {milestone.description && <p className="text-lapis-text-tertiary text-xs mb-1">{milestone.description}</p>}
                            <p className="text-lapis-text-secondary text-xs">
                              <span className="text-lapis-text-tertiary">Next: </span>
                              {milestone.next_action || <span className="text-lapis-text-disabled italic">not set</span>}
                            </p>
                          </div>
                          <Link
                            href={`/goals/milestones/${milestone.id}/edit`}
                            className="text-lapis-text-tertiary hover:text-lapis-text-secondary text-xs shrink-0"
                          >
                            Edit
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  type="button"
                  onClick={handleGeneratePlan}
                  disabled={generatingPlan}
                  variant="outline"
                  className="border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2"
                >
                  {generatingPlan
                    ? 'Generating...'
                    : linkedMilestones.length === 0
                      ? 'Generate a fuller milestone plan'
                      : 'Add more milestones'}
                </Button>
                <Link
                  href={`/goals/milestones/new?goalId=${params.id}`}
                  className="text-lapis-text-tertiary hover:text-lapis-text-secondary text-xs"
                >
                  + Add manually
                </Link>
              </div>
              {planError && <p className="text-sm text-lapis-garnet mt-2">{planError}</p>}
            </div>
          )}
        </div>

        {/* Details - dates, scope, dependencies, calendar auto-block.
            Real, occasionally useful, but not what this page should lead
            with - collapsed by default. */}
        <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 mb-8">
          <button onClick={() => setShowDetails(!showDetails)} className="w-full flex items-center gap-2">
            {showDetails ? (
              <ChevronDown className="w-4 h-4 text-lapis-text-tertiary" />
            ) : (
              <ChevronRight className="w-4 h-4 text-lapis-text-tertiary" />
            )}
            <span className="text-lapis-text-primary font-medium">Details</span>
          </button>

          {showDetails && (
            <div className="mt-4 space-y-6">
              <GoalFormFields
                title={title}
                onTitleChange={setTitle}
                description={description}
                onDescriptionChange={setDescription}
                startDate={startDate}
                onStartDateChange={setStartDate}
                targetDate={targetDate}
                onTargetDateChange={setTargetDate}
                nextAction={nextAction}
                onNextActionChange={setNextAction}
                status={status}
                onStatusChange={setStatus}
                scope={scope}
                onScopeChange={setScope}
                autoBlockBeforeDeadline={autoBlockBeforeDeadline}
                onAutoBlockBeforeDeadlineChange={setAutoBlockBeforeDeadline}
                dependsOnGoalId={dependsOnGoalId}
                onDependsOnGoalIdChange={setDependsOnGoalId}
                availableGoals={availableGoals}
                hideNextAction
              />

              <Button
                onClick={handleUpdate}
                disabled={saving || !isValid}
                className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 h-auto py-4 text-base font-medium"
              >
                {saving ? 'Saving...' : 'Update Goal'}
              </Button>
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title="Delete Goal"
        description={
          linkedMilestones.length > 0
            ? `This permanently deletes this goal and its ${linkedMilestones.length} linked milestone${
                linkedMilestones.length === 1 ? '' : 's'
              }. This cannot be undone.`
            : 'Are you sure you want to delete this goal? This cannot be undone.'
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteGoal}
        destructive
      />
    </AppLayout>
  )
}
