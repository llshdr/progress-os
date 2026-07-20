'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import GoalFormFields from '@/components/projects/goal-form-fields'
import type { ActionItemStatus } from '@/lib/projects'

export default function EditGoalPage() {
  const params = useParams()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [status, setStatus] = useState<ActionItemStatus>('active')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
    setTargetDate(data.target_date || '')
    setNextAction(data.next_action || '')
    setStatus(data.status)
    setLoading(false)
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
        target_date: targetDate || null,
        next_action: nextAction.trim() || null,
        status,
      })
      .eq('id', params.id)

    if (error) {
      console.error('Error updating goal:', error)
      setSaving(false)
    } else {
      router.push('/projects/goals')
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-white/40">Loading...</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/projects/goals" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">Edit Goal</h1>
        <p className="text-white/50 text-sm mb-8">
          Updating the next action bumps this goal's "last touched" time.
        </p>

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
            onClick={handleUpdate}
            disabled={saving || !isValid}
            className="w-full bg-white text-black hover:bg-white/90 h-auto py-4 text-base font-medium"
          >
            {saving ? 'Saving...' : 'Update Goal'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
