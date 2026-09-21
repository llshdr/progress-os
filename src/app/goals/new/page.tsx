'use client'

import BackLink from '@/components/lapis/back-link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import GoalFormFields from '@/components/goals/goal-form-fields'
import type { WorldStyle } from '@/lib/journey'
import type { ActionItemStatus, GoalScope } from '@/lib/goals'
import { getLocalDateString } from '@/lib/date'
import { changed } from '@/components/lapis/app-provider'

export default function NewGoalPage() {
  const router = useRouter()
  const goalKey = useRef<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(getLocalDateString())
  const [targetDate, setTargetDate] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [status, setStatus] = useState<ActionItemStatus>('active')
  const [worldStyle, setWorldStyle] = useState<WorldStyle | null>(null)
  const [attention, setAttention] = useState<'focus'|'later'|'paused'>('focus')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [scope, setScope] = useState<GoalScope | null>(null)
  const [autoBlockBeforeDeadline, setAutoBlockBeforeDeadline] = useState(false)
  const [dependsOnGoalId, setDependsOnGoalId] = useState<string | null>(null)
  const [availableGoals, setAvailableGoals] = useState<{ id: string; title: string }[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  // Candidates for "depends on" - excludes archived goals, since an
  // archived goal will never become done and would permanently block
  // whatever depends on it.
  useEffect(() => {
    const fetchAvailableGoals = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('goals').select('id, title').eq('user_id', user.id).neq('status', 'archived')
      setAvailableGoals(data ?? [])
    }
    fetchAvailableGoals()
  }, [supabase])

  const isValid = title.trim().length > 0

  const handleCreate = async () => {
    if (!isValid) return

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setLoading(true)
    setSaveError(null)
    goalKey.current ??= crypto.randomUUID()

    const { data, error } = await supabase.from('goals').upsert({
      id: goalKey.current,
      user_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      start_date: startDate || null,
      target_date: targetDate || null,
      next_action: nextAction.trim() || null,
      status,
      scope,
      world_style: worldStyle,
      attention,
      auto_block_before_deadline: autoBlockBeforeDeadline,
      depends_on_goal_id: dependsOnGoalId,
    }, { onConflict: 'id' }).select('id').single()

    if (error) {
      setSaveError('Could not save your goal. Try again. If this persists, check that the latest database migration is installed.')
      console.error('Error creating goal:', error)
      setLoading(false)
    } else {
      changed()
      router.replace(`/goals/${data.id}`)
    }
  }

  return (
    <AppLayout>
      <div className="lapis-page">
        <BackLink fallback="/goals" className="mb-6" />

        <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-2">New destination</h1>
        <p className="text-lapis-text-tertiary text-sm mb-8">Something worth working toward. Give it a place in your world.</p>

        <div className="max-w-2xl space-y-6">
          {saveError && <p role="alert" className="rounded-xl border border-lapis-garnet/40 p-3 text-sm text-lapis-text-primary">{saveError}</p>}
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
            worldStyle={worldStyle}
            attention={attention}
            onAttentionChange={setAttention}
            onWorldStyleChange={setWorldStyle}
            scope={scope}
            onScopeChange={setScope}
            autoBlockBeforeDeadline={autoBlockBeforeDeadline}
            onAutoBlockBeforeDeadlineChange={setAutoBlockBeforeDeadline}
            dependsOnGoalId={dependsOnGoalId}
            onDependsOnGoalIdChange={setDependsOnGoalId}
            availableGoals={availableGoals}
          />

          <Button
            onClick={handleCreate}
            disabled={loading || !isValid}
            className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 h-auto py-4 text-base font-medium"
          >
            {loading ? 'Creating...' : 'Create destination'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
