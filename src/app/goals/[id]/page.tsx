'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Sparkles, Trash2 } from 'lucide-react'
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

export default function GoalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [status, setStatus] = useState<ActionItemStatus>('active')
  const [scope, setScope] = useState<GoalScope | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [linkedMilestones, setLinkedMilestones] = useState<LinkedMilestone[]>([])
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchGoal()
  }, [params.id])

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

    setLoading(false)
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

    const { error } = await supabase
      .from('goals')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        start_date: startDate || null,
        target_date: targetDate || null,
        next_action: nextAction.trim() || null,
        status,
        scope,
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

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
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

        <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-2">Edit Goal</h1>
        <p className="text-lapis-text-tertiary text-sm mb-8">
          Updating the next action bumps this goal's "last touched" time.
        </p>

        <div className="max-w-2xl space-y-6">
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
          />

          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-lapis-text-tertiary" />
                <h2 className="text-lg font-medium text-lapis-text-primary">Milestones</h2>
              </div>
              <Link
                href={`/goals/milestones/new?goalId=${params.id}`}
                className="text-lapis-text-tertiary hover:text-lapis-text-secondary text-xs"
              >
                + Add manually
              </Link>
            </div>

            {linkedMilestones.length === 0 && (
              <p className="text-lapis-text-tertiary text-sm mb-3">
                Break this goal down into a few concrete milestones to work toward it.
              </p>
            )}

            {linkedMilestones.length > 0 && (
              <div className="space-y-3 mb-4">
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
                        {milestone.description && (
                          <p className="text-lapis-text-tertiary text-xs mb-1">{milestone.description}</p>
                        )}
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
            )}

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
                  ? 'Generate a plan'
                  : 'Add more milestones'}
            </Button>
            {planError && <p className="text-sm text-lapis-garnet mt-2">{planError}</p>}
          </div>

          <Button
            onClick={handleUpdate}
            disabled={saving || !isValid}
            className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 h-auto py-4 text-base font-medium"
          >
            {saving ? 'Saving...' : 'Update Goal'}
          </Button>
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
