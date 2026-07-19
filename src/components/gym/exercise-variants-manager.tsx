'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { X } from 'lucide-react'

interface Variant {
  id: string
  label: string
}

// Saves immediately on add/remove (like the Favorite/Archive toggles
// elsewhere) rather than being bundled into the exercise's own save button —
// this list is independent metadata, not part of the exercise form itself.
export default function ExerciseVariantsManager({ exerciseLibraryId }: { exerciseLibraryId: string }) {
  const [variants, setVariants] = useState<Variant[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchVariants()
  }, [exerciseLibraryId])

  const fetchVariants = async () => {
    const { data, error } = await supabase
      .from('exercise_variants')
      .select('id, label')
      .eq('exercise_library_id', exerciseLibraryId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching exercise variants:', error)
    } else {
      setVariants(data || [])
    }
    setLoading(false)
  }

  const handleAddVariant = async () => {
    const label = newLabel.trim()
    if (!label) return

    setSaving(true)
    const { error } = await supabase
      .from('exercise_variants')
      .insert({ exercise_library_id: exerciseLibraryId, label })

    setSaving(false)
    if (error) {
      console.error('Error adding variant:', error)
    } else {
      setNewLabel('')
      fetchVariants()
    }
  }

  const handleRemoveVariant = async (variantId: string) => {
    const { error } = await supabase.from('exercise_variants').delete().eq('id', variantId)

    if (error) {
      console.error('Error removing variant:', error)
    } else {
      fetchVariants()
    }
  }

  if (loading) return null

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-white/80">Equipment Variants (optional)</Label>
        <p className="text-white/40 text-xs mt-1">
          For machines/cables where the same weight number isn&apos;t directly comparable across
          brands or ratios — e.g. &quot;Hammer Strength&quot;, &quot;Life Fitness&quot;, &quot;1:1&quot;, &quot;2:1&quot;.
        </p>
      </div>

      {variants.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {variants.map((variant) => (
            <span
              key={variant.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-white/5 border border-white/10 text-white"
            >
              {variant.label}
              <button
                type="button"
                onClick={() => handleRemoveVariant(variant.id)}
                className="text-white/40 hover:text-white/70 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAddVariant()
            }
          }}
          placeholder="e.g. Hammer Strength"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
        <Button
          type="button"
          onClick={handleAddVariant}
          disabled={saving || !newLabel.trim()}
          variant="outline"
          className="border-white/10 text-white hover:bg-white/5 shrink-0"
        >
          Add
        </Button>
      </div>
    </div>
  )
}
