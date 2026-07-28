'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import GoalFormFields from '@/components/projects/goal-form-fields'
import type { ActionItemStatus, GoalScope } from '@/lib/projects'

type LinkedProject = {
  id: string
  title: string
  description: string | null
  next_action: string | null
  status: ActionItemStatus
}

export default function EditGoalPage() {
  const params = useParams()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [status, setStatus] = useState<ActionItemStatus>('active')
  const [scope, setScope] = useState<GoalScope | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [linkedProjects, setLinkedProjects] = useState<LinkedProject[]>([])
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
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
    setScope(data.scope ?? null)

    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, title, description, next_action, status')
      .eq('goal_id', params.id)
      .order('created_at', { ascending: true })

    if (projectsError) {
      console.error('Error fetching linked projects:', projectsError)
    } else {
      setLinkedProjects(projects || [])
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
      } else if (data.status === 'already_has_plan') {
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
            scope={scope}
            onScopeChange={setScope}
          />

          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-white/40" />
              <h2 className="text-lg font-medium text-white">Plan</h2>
            </div>

            {linkedProjects.length === 0 ? (
              <div className="space-y-3">
                <p className="text-white/40 text-sm">
                  Break this goal down into a few concrete milestones to work toward it.
                </p>
                <Button
                  type="button"
                  onClick={handleGeneratePlan}
                  disabled={generatingPlan}
                  variant="outline"
                  className="border-white/10 text-white hover:bg-white/5"
                >
                  {generatingPlan ? 'Generating...' : 'Generate a plan'}
                </Button>
                {planError && <p className="text-sm text-red-400">{planError}</p>}
              </div>
            ) : (
              <div className="space-y-3">
                {linkedProjects.map((project) => (
                  <div key={project.id} className="border border-white/10 rounded-xl bg-white/[0.02] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-medium text-sm">{project.title}</h3>
                          <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10">
                            {project.status}
                          </span>
                        </div>
                        {project.description && (
                          <p className="text-white/40 text-xs mb-1">{project.description}</p>
                        )}
                        <p className="text-white/70 text-xs">
                          <span className="text-white/40">Next: </span>
                          {project.next_action || <span className="text-white/30 italic">not set</span>}
                        </p>
                      </div>
                      <Link
                        href={`/projects/all/${project.id}/edit`}
                        className="text-white/40 hover:text-white/60 text-xs shrink-0"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
