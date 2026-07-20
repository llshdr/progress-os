'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import ProjectFormFields from '@/components/projects/project-form-fields'
import type { ActionItemStatus } from '@/lib/projects'

export default function EditProjectPage() {
  const params = useParams()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [status, setStatus] = useState<ActionItemStatus>('active')
  const [goalId, setGoalId] = useState<string | null>(null)
  const [goalOptions, setGoalOptions] = useState<{ id: string; title: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchProject()
  }, [params.id])

  const fetchProject = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase.from('projects').select('*').eq('id', params.id).single()

    if (error) {
      console.error('Error fetching project:', error)
      setLoading(false)
      return
    }

    setTitle(data.title)
    setDescription(data.description || '')
    setNextAction(data.next_action || '')
    setStatus(data.status)
    setGoalId(data.goal_id)

    const { data: goals } = await supabase
      .from('goals')
      .select('id, title')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('title', { ascending: true })

    setGoalOptions(goals || [])
    setLoading(false)
  }

  const isValid = title.trim().length > 0

  const handleUpdate = async () => {
    if (!isValid) return

    setSaving(true)

    const { error } = await supabase
      .from('projects')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        next_action: nextAction.trim() || null,
        status,
        goal_id: goalId,
      })
      .eq('id', params.id)

    if (error) {
      console.error('Error updating project:', error)
      setSaving(false)
    } else {
      router.push('/projects/all')
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
        <Link href="/projects/all" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">Edit Project</h1>
        <p className="text-white/50 text-sm mb-8">
          Updating the next action bumps this project's "last touched" time.
        </p>

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
            onClick={handleUpdate}
            disabled={saving || !isValid}
            className="w-full bg-white text-black hover:bg-white/90 h-auto py-4 text-base font-medium"
          >
            {saving ? 'Saving...' : 'Update Project'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
