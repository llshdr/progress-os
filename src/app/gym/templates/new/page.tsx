'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NewTemplatePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleCreateTemplate = async () => {
    if (!name) {
      alert('Please enter a template name')
      return
    }

    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('workout_templates')
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        display_order: 0,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating template:', error)
      alert('Failed to create template')
      setLoading(false)
    } else {
      router.push(`/gym/templates/${data.id}/edit`)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/gym/templates" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
          New Workout Template
        </h1>
        <p className="text-white/50 text-sm mb-8">
          Create a custom workout routine
        </p>

        <div className="max-w-2xl space-y-6">
          {/* Template Name */}
          <div>
            <label className="text-white/60 text-sm mb-2 block">Template Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Chest & Shoulders"
              className="w-full bg-white/5 border-white/10 text-white rounded-xl px-4 py-3 placeholder:text-white/30"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-white/60 text-sm mb-2 block">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Focus on compound movements..."
              rows={3}
              className="w-full bg-white/5 border-white/10 text-white rounded-xl px-4 py-3 placeholder:text-white/30 resize-none"
            />
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreateTemplate}
            disabled={loading || !name}
            className="w-full bg-white text-black hover:bg-white/90 rounded-xl px-4 py-4 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating...' : 'Create Template'}
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
