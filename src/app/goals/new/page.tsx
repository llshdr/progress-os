'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import GoalFormFields from '@/components/goals/goal-form-fields'
import type { ActionItemStatus, GoalScope } from '@/lib/goals'
import { getLocalDateString } from '@/lib/date'

export default function NewGoalPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(getLocalDateString())
  const [targetDate, setTargetDate] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [status, setStatus] = useState<ActionItemStatus>('active')
  const [scope, setScope] = useState<GoalScope | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const isValid = title.trim().length > 0

  const handleCreate = async () => {
    if (!isValid) return

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setLoading(true)

    const { error } = await supabase.from('goals').insert({
      user_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      start_date: startDate || null,
      target_date: targetDate || null,
      next_action: nextAction.trim() || null,
      status,
      scope,
    })

    if (error) {
      console.error('Error creating goal:', error)
      setLoading(false)
    } else {
      router.push('/goals')
    }
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/goals" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 block">
          ← Back
        </Link>

        <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-2">Add Goal</h1>
        <p className="text-lapis-text-tertiary text-sm mb-8">A longer-term outcome you're working toward</p>

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

          <Button
            onClick={handleCreate}
            disabled={loading || !isValid}
            className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 h-auto py-4 text-base font-medium"
          >
            {loading ? 'Creating...' : 'Create Goal'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
