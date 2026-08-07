'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import MilestoneFormFields from '@/components/goals/milestone-form-fields'
import type { ActionItemStatus } from '@/lib/goals'
import { PageSkeleton } from '@/components/ui/page-skeleton'

export default function NewMilestonePage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <PageSkeleton />
        </AppLayout>
      }
    >
      <NewMilestonePageInner />
    </Suspense>
  )
}

function NewMilestonePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const presetGoalId = searchParams.get('goalId')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<ActionItemStatus>('active')
  const [goalId, setGoalId] = useState<string | null>(presetGoalId)
  const [goalOptions, setGoalOptions] = useState<{ id: string; title: string }[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchGoalOptions()
  }, [])

  const fetchGoalOptions = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('goals')
      .select('id, title')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('title', { ascending: true })

    setGoalOptions(data || [])
  }

  const isValid = title.trim().length > 0

  const handleCreate = async () => {
    if (!isValid) return

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setLoading(true)

    const { error } = await supabase.from('milestones').insert({
      user_id: user.id,
      goal_id: goalId,
      title: title.trim(),
      description: description.trim() || null,
      next_action: nextAction.trim() || null,
      due_date: dueDate || null,
      status,
    })

    if (error) {
      console.error('Error creating milestone:', error)
      setLoading(false)
    } else {
      router.push(goalId ? `/goals/${goalId}` : '/goals')
    }
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href={presetGoalId ? `/goals/${presetGoalId}` : '/goals'}
          className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 block"
        >
          ← Back
        </Link>

        <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-2">Add Milestone</h1>
        <p className="text-lapis-text-tertiary text-sm mb-8">A concrete step, optionally in service of a goal</p>

        <div className="max-w-2xl space-y-6">
          <MilestoneFormFields
            title={title}
            onTitleChange={setTitle}
            description={description}
            onDescriptionChange={setDescription}
            nextAction={nextAction}
            onNextActionChange={setNextAction}
            dueDate={dueDate}
            onDueDateChange={setDueDate}
            status={status}
            onStatusChange={setStatus}
            goalId={goalId}
            onGoalIdChange={setGoalId}
            goalOptions={goalOptions}
          />

          <Button
            onClick={handleCreate}
            disabled={loading || !isValid}
            className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 h-auto py-4 text-base font-medium"
          >
            {loading ? 'Creating...' : 'Create Milestone'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
