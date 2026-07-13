'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Plus, Archive, MoreVertical, Copy, Trash2 } from 'lucide-react'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'

type Template = {
  id: string
  name: string
  description: string | null
  display_order: number
  archived: boolean
  exercise_count?: number
}

export default function WorkoutTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [showDeleteTemplateModal, setShowDeleteTemplateModal] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('workout_templates')
      .select('*, workout_template_exercises(count)')
      .eq('user_id', user.id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching templates:', error)
    } else {
      const templatesWithCount = (data || []).map((template: any) => ({
        ...template,
        exercise_count: template.workout_template_exercises?.[0]?.count || 0,
      }))
      setTemplates(templatesWithCount)
    }
    setLoading(false)
  }

  const toggleArchive = async (templateId: string, currentArchived: boolean) => {
    const { error } = await supabase
      .from('workout_templates')
      .update({ archived: !currentArchived })
      .eq('id', templateId)

    if (error) {
      console.error('Error toggling archive:', error)
    } else {
      fetchTemplates()
    }
  }

  const duplicateTemplate = async (templateId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // Fetch the original template
    const { data: originalTemplate, error: fetchError } = await supabase
      .from('workout_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (fetchError) {
      console.error('Error fetching template:', fetchError)
      return
    }

    // Create duplicate
    const { data: newTemplate, error: createError } = await supabase
      .from('workout_templates')
      .insert({
        user_id: user.id,
        name: `${originalTemplate.name} (Copy)`,
        description: originalTemplate.description,
        display_order: templates.length,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error duplicating template:', createError)
      return
    }

    // Copy exercises
    const { data: templateExercises, error: exercisesError } = await supabase
      .from('workout_template_exercises')
      .select('*')
      .eq('template_id', templateId)

    if (!exercisesError && templateExercises) {
      await supabase.from('workout_template_exercises').insert(
        templateExercises.map((ex: any) => ({
          template_id: newTemplate.id,
          exercise_library_id: ex.exercise_library_id,
          exercise_order: ex.exercise_order,
          target_sets: ex.target_sets,
          target_rep_range_min: ex.target_rep_range_min,
          target_rep_range_max: ex.target_rep_range_max,
          notes: ex.notes,
        }))
      )
    }

    fetchTemplates()
  }

  const deleteTemplate = async () => {
    if (!templateToDelete) return

    const { error } = await supabase
      .from('workout_templates')
      .delete()
      .eq('id', templateToDelete)

    if (error) {
      console.error('Error deleting template:', error)
    } else {
      fetchTemplates()
    }
    setTemplateToDelete(null)
  }

  const openDeleteTemplateModal = (templateId: string) => {
    setTemplateToDelete(templateId)
    setShowDeleteTemplateModal(true)
  }

  const filteredTemplates = showArchived
    ? templates
    : templates.filter(t => !t.archived)

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
              Workout Templates
            </h1>
            <p className="text-white/50 text-sm">
              Your custom workout routines
            </p>
          </div>
          <Link href="/gym/templates/new">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-white/90 transition-colors">
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">New Template</span>
            </button>
          </Link>
        </div>

        {/* Archive Toggle */}
        <div className="mb-6">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showArchived
                ? 'bg-white/10 text-white border-white/20'
                : 'bg-white/5 text-white/60 border-white/10'
            } border`}
          >
            <Archive className="w-4 h-4" />
            <span className="text-sm">Show Archived</span>
          </button>
        </div>

        {/* Templates List */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-white/40">Loading...</div>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center">
            <p className="text-white/40 mb-4">
              {showArchived ? 'No archived templates' : 'No templates yet'}
            </p>
            {!showArchived && (
              <Link href="/gym/templates/new">
                <button className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-colors">
                  Create your first template
                </button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <Link href={`/gym/templates/${template.id}/edit`} className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-medium text-white">
                        {template.name}
                      </h3>
                      {template.archived && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10">
                          Archived
                        </span>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-white/40 text-sm mb-2">
                        {template.description}
                      </p>
                    )}
                    <p className="text-white/30 text-sm">
                      {template.exercise_count} exercises
                    </p>
                  </Link>
                  <div className="flex gap-2">
                    <button
                      onClick={() => duplicateTemplate(template.id)}
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                      title="Duplicate"
                    >
                      <Copy className="w-4 h-4 text-white/40" />
                    </button>
                    <button
                      onClick={() => toggleArchive(template.id, template.archived)}
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                      title={template.archived ? 'Unarchive' : 'Archive'}
                    >
                      <Archive className="w-4 h-4 text-white/40" />
                    </button>
                    <button
                      onClick={() => openDeleteTemplateModal(template.id)}
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-white/40" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Template Confirmation Modal */}
      <ConfirmationModal
        open={showDeleteTemplateModal}
        onOpenChange={setShowDeleteTemplateModal}
        title="Delete Template"
        description="Are you sure you want to delete this template? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={deleteTemplate}
        destructive
      />
    </AppLayout>
  )
}
