'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import GoalFormFields from '@/components/projects/goal-form-fields'
import type { ActionItemStatus } from '@/lib/projects'

export default function NewGoalPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [status, setStatus] = useState<ActionItemStatus>('active')
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
      target_date: targetDate || null,
      next_action: nextAction.trim() || null,
      status,
    })

    if (error) {
      console.error('Error creating goal:', error)
      setLoading(false)
    } else {
      router.push('/projects/goals')
    }
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/projects/goals" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">Add Goal</h1>
        <p className="text-white/50 text-sm mb-8">A longer-term outcome you're working toward</p>

        <div className="max-w-2xl space-y-6">
          <GoalFormFields
            title={title}
            onTitleChange={setTitle}
            description={description}
            onDescriptionChange={setDescription}
            targetDate={targetDate}
            onTargetDateChange={setTargetDate}
            nextAction={nextAction}
            onNextActionChange={setNextAction}
            status={status}
            onStatusChange={setStatus}
          />

          <Button
            onClick={handleCreate}
            disabled={loading || !isValid}
            className="w-full bg-white text-black hover:bg-white/90 h-auto py-4 text-base font-medium"
          >
            {loading ? 'Creating...' : 'Create Goal'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
