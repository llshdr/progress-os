'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Search } from 'lucide-react'
import { fuzzySearch } from '@/lib/fuzzy-match'
import { CARDIO_TYPE_LABELS, type CardioType } from '@/lib/exercise-constants'

export interface CatalogEntry {
  id: string
  name: string
  muscle_group: string
  equipment_type: string
  category: string
  exercise_type: string
  aliases: string[] | null
  muscle_targets: string[] | null
  is_unilateral: boolean
  cardio_type: string | null
  primary_lift: string | null
}

interface CatalogSearchProps {
  onSelect: (entry: CatalogEntry) => void
}

// Searches the small, shared, read-only exercise_catalog and lets the user
// copy a match's fields into the form below - an explicit prefill, never an
// automatic link. The whole catalog (~100 rows) is fetched once and matched
// client-side; no server round-trip per keystroke.
export default function CatalogSearch({ onSelect }: CatalogSearchProps) {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [query, setQuery] = useState('')
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('exercise_catalog')
      .select('id, name, muscle_group, equipment_type, category, exercise_type, aliases, muscle_targets, is_unilateral, cardio_type, primary_lift')
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching exercise catalog:', error)
          return
        }
        setCatalog(data || [])
      })
  }, [])

  const results = fuzzySearch(catalog, query)

  return (
    <div className="space-y-3">
      <Label className="text-lapis-text-secondary">Search catalog (optional)</Label>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-lapis-text-tertiary" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. bänk, squat, löpning..."
          className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled pl-11"
        />
      </div>
      {results.length > 0 && (
        <div className="border border-lapis-border-subtle rounded-lapis-md bg-lapis-surface-1 divide-y divide-white/5 overflow-hidden">
          {results.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                onSelect(entry)
                setQuery('')
              }}
              className="w-full p-3 text-left hover:bg-lapis-surface-2 transition-colors"
            >
              <div className="font-medium text-lapis-text-primary">{entry.name}</div>
              <div className="text-lapis-text-tertiary text-sm">
                {entry.exercise_type === 'cardio'
                  ? `Cardio${entry.cardio_type ? ` • ${CARDIO_TYPE_LABELS[entry.cardio_type as CardioType]}` : ''} • ${entry.equipment_type}`
                  : `${entry.muscle_group} • ${entry.equipment_type}`}
              </div>
            </button>
          ))}
        </div>
      )}
      <p className="text-lapis-text-tertiary text-xs">
        Pick a match to prefill the fields below — nothing is saved until you create the exercise, and
        you can still edit anything first.
      </p>
    </div>
  )
}
