'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import MilestoneFormFields from '@/components/goals/milestone-form-fields'
import type { ActionItemStatus } from '@/lib/goals'

export default function EditMilestonePage() {
  const params = useParams()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<ActionItemStatus>('active')
  const [goalId, setGoalId] = useState<string | null>(null)
  const [goalOptions, setGoalOptions] = useState<{ id: string; title: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchMilestone()
  }, [params.id])

  const fetchMilestone = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase.from('milestones').select('*').eq('id', params.id).single()

    if (error) {
      console.error('Error fetching milestone:', error)
      setLoading(false)
      return
    }

    setTitle(data.title)
    setDescription(data.description || '')
    setNextAction(data.next_action || '')
    setDueDate(data.due_date || '')
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
      .from('milestones')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        next_action: nextAction.trim() || null,
        due_date: dueDate || null,
        status,
        goal_id: goalId,
      })
      .eq('id', params.id)

    if (error) {
      console.error('Error updating milestone:', error)
      setSaving(false)
    } else {
      router.push(goalId ? `/goals/${goalId}` : '/goals')
    }
  }

  const handleDelete = async () => {
    const { error } = await supabase.from('milestones').delete().eq('id', params.id)

    if (error) {
      console.error('Error deleting milestone:', error)
      return
    }
    router.push(goalId ? `/goals/${goalId}` : '/goals')
  }

  const backHref = goalId ? `/goals/${goalId}` : '/goals'

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-lapis-text-tertiary">Loading...</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <Link href={backHref} className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors">
            ← Back
          </Link>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-5 h-5 text-lapis-text-tertiary" />
          </button>
        </div>

        <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-2">Edit Milestone</h1>
        <p className="text-lapis-text-tertiary text-sm mb-8">
          Updating the next action bumps this milestone's "last touched" time.
        </p>

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
            onClick={handleUpdate}
            disabled={saving || !isValid}
            className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 h-auto py-4 text-base font-medium"
          >
            {saving ? 'Saving...' : 'Update Milestone'}
          </Button>
        </div>
      </div>

      <ConfirmationModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title="Delete Milestone"
        description="Are you sure you want to delete this milestone? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
        destructive
      />
    </AppLayout>
  )
}
