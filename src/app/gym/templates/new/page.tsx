'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'

export default function NewTemplatePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleCreateTemplate = async () => {
    if (!name) {
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
          <div className="space-y-2">
            <Label htmlFor="template-name" className="text-white/80">Template Name *</Label>
            <Input
              id="template-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Chest & Shoulders"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description" className="text-white/80">Description (optional)</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Focus on compound movements..."
              rows={3}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
            />
          </div>

          <Button
            onClick={handleCreateTemplate}
            disabled={loading || !name}
            className="w-full bg-white text-black hover:bg-white/90 h-auto py-4 text-base font-medium"
          >
            {loading ? 'Creating...' : 'Create Template'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
