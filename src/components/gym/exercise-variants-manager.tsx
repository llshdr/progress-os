'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { X } from 'lucide-react'

interface Variant {
  id: string
  label: string
}

// Saves immediately on add/remove (like the Favorite/Archive toggles
// elsewhere) rather than being bundled into the exercise's own save button —
// this list is independent metadata, not part of the exercise form itself.
//
// Adding a variant is hidden for Dumbbell exercises specifically - a
// dumbbell's weight is already directly comparable across brands/gyms,
// unlike a machine/cable's stack or a cable's pulley ratio, so there's
// nothing meaningful to record here. Existing variants (from before this
// restriction, or a since-changed equipment type) still display and stay
// removable - this only hides the ability to add MORE, never destroys
// data that already exists.
export default function ExerciseVariantsManager({
  exerciseLibraryId,
  equipmentType,
}: {
  exerciseLibraryId: string
  equipmentType: string
}) {
  const canAddVariant = equipmentType !== 'Dumbbell'
  const [variants, setVariants] = useState<Variant[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [variantToRemove, setVariantToRemove] = useState<string | null>(null)
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

  const handleRemoveVariant = async () => {
    if (!variantToRemove) return

    const { error } = await supabase.from('exercise_variants').delete().eq('id', variantToRemove)
    setVariantToRemove(null)

    if (error) {
      console.error('Error removing variant:', error)
    } else {
      fetchVariants()
    }
  }

  if (loading) return null
  // Nothing to add and nothing existing to manage - render nothing at all
  // rather than an empty, pointless card.
  if (!canAddVariant && variants.length === 0) return null

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-lapis-text-secondary">Equipment Variants (optional)</Label>
        {canAddVariant ? (
          <p className="text-lapis-text-tertiary text-xs mt-1">
            For machines/cables where the same weight number isn&apos;t directly comparable across
            brands or ratios — e.g. &quot;Hammer Strength&quot;, &quot;Life Fitness&quot;, &quot;1:1&quot;, &quot;2:1&quot;.
          </p>
        ) : (
          <p className="text-lapis-text-tertiary text-xs mt-1">
            Not applicable for dumbbells — the weight is already directly comparable across gyms.
          </p>
        )}
      </div>

      {variants.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {variants.map((variant) => (
            <span
              key={variant.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-lapis-surface-2 border border-lapis-border-subtle text-lapis-text-primary"
            >
              {variant.label}
              <button
                type="button"
                onClick={() => setVariantToRemove(variant.id)}
                className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {canAddVariant && (
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
            className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
          />
          <Button
            type="button"
            onClick={handleAddVariant}
            disabled={saving || !newLabel.trim()}
            variant="outline"
            className="border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2 shrink-0"
          >
            Add
          </Button>
        </div>
      )}

      <ConfirmationModal
        open={variantToRemove !== null}
        onOpenChange={(open) => !open && setVariantToRemove(null)}
        title="Remove Variant"
        description="Are you sure you want to remove this variant? Sets already logged under it keep their existing label."
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={handleRemoveVariant}
        destructive
      />
    </div>
  )
}
