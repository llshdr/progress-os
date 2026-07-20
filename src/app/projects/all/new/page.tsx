'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import ProjectFormFields from '@/components/projects/project-form-fields'
import type { ActionItemStatus } from '@/lib/projects'

export default function NewProjectPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [status, setStatus] = useState<ActionItemStatus>('active')
  const [goalId, setGoalId] = useState<string | null>(null)
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

    const { error } = await supabase.from('projects').insert({
      user_id: user.id,
      goal_id: goalId,
      title: title.trim(),
      description: description.trim() || null,
      next_action: nextAction.trim() || null,
      status,
    })

    if (error) {
      console.error('Error creating project:', error)
      setLoading(false)
    } else {
      router.push('/projects/all')
    }
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/projects/all" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">Add Project</h1>
        <p className="text-white/50 text-sm mb-8">A concrete effort, optionally in service of a goal</p>

        <div className="max-w-2xl space-y-6">
          <ProjectFormFields
            title={title}
            onTitleChange={setTitle}
            description={description}
            onDescriptionChange={setDescription}
            nextAction={nextAction}
            onNextActionChange={setNextAction}
            status={status}
            onStatusChange={setStatus}
            goalId={goalId}
            onGoalIdChange={setGoalId}
            goalOptions={goalOptions}
          />

          <Button
            onClick={handleCreate}
            disabled={loading || !isValid}
            className="w-full bg-white text-black hover:bg-white/90 h-auto py-4 text-base font-medium"
          >
            {loading ? 'Creating...' : 'Create Project'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
