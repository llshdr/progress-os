'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2 } from 'lucide-react'
import { defaultChecklistItems } from '@/lib/race-plan/race-day-prep'
import type { RaceCategory } from '@/lib/race-plan/self-assessment'

interface ChecklistItem {
  id: string
  category: 'gear' | 'test'
  title: string
  doneAt: string | null
  displayOrder: number
}

interface Props {
  raceId: string
  category: RaceCategory
}

const SECTIONS: { key: 'gear' | 'test'; label: string; addPlaceholder: string }[] = [
  { key: 'gear', label: 'Gear to pack/buy', addPlaceholder: 'Add a gear item...' },
  { key: 'test', label: 'Test beforehand', addPlaceholder: 'Add something to test...' },
]

// A real, trackable version of the static Packing List content
// (race-day-prep.ts) - replaces that read-only card. Self-contained
// (own fetch/CRUD via race_checklist_items, see migration 065) rather
// than props-fed from the parent page, same pattern TravelPrepDialog
// already uses for a race/calendar-adjacent feature. A race with no
// items yet gets an explicit "Populate from packing list" seed action
// (real, useful defaults from PACKING_LISTS/TEST_CHECKLIST_ITEMS) but
// the per-section add-item inputs are always available too, so a fully
// custom checklist works just as well as a seeded one.
export default function RaceChecklistCard({ raceId, category }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitles, setNewTitles] = useState<Record<'gear' | 'test', string>>({ gear: '', test: '' })
  const [seeding, setSeeding] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceId])

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from('race_checklist_items')
      .select('id, category, title, done_at, display_order')
      .eq('race_id', raceId)
      .order('category', { ascending: true })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching race checklist items:', error)
    } else {
      setItems(
        (data ?? []).map((r) => ({
          id: r.id,
          category: r.category,
          title: r.title,
          doneAt: r.done_at,
          displayOrder: r.display_order,
        }))
      )
    }
    setLoading(false)
  }

  const handleSeed = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setSeeding(true)
    const seedItems = defaultChecklistItems(category)
    const { error } = await supabase.from('race_checklist_items').insert(
      seedItems.map((item, i) => ({
        user_id: user.id,
        race_id: raceId,
        category: item.category,
        title: item.title,
        display_order: i,
      }))
    )
    setSeeding(false)
    if (error) {
      console.error('Error seeding race checklist items:', error)
      return
    }
    fetchItems()
  }

  const toggleDone = async (item: ChecklistItem) => {
    const { error } = await supabase
      .from('race_checklist_items')
      .update({ done_at: item.doneAt ? null : new Date().toISOString() })
      .eq('id', item.id)

    if (error) {
      console.error('Error toggling race checklist item:', error)
      return
    }
    fetchItems()
  }

  const handleAdd = async (sectionCategory: 'gear' | 'test') => {
    const title = newTitles[sectionCategory].trim()
    if (!title) return

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const nextOrder = items.filter((i) => i.category === sectionCategory).length
    const { error } = await supabase.from('race_checklist_items').insert({
      user_id: user.id,
      race_id: raceId,
      category: sectionCategory,
      title,
      display_order: nextOrder,
    })

    if (error) {
      console.error('Error adding race checklist item:', error)
      return
    }
    setNewTitles((prev) => ({ ...prev, [sectionCategory]: '' }))
    fetchItems()
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('race_checklist_items').delete().eq('id', id)
    if (error) {
      console.error('Error deleting race checklist item:', error)
      return
    }
    fetchItems()
  }

  if (loading) return null

  return (
    <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-medium text-lapis-text-primary">Race Prep Checklist</h2>
        {items.length === 0 && (
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="text-xs text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors underline underline-offset-2 disabled:opacity-50"
          >
            {seeding ? 'Populating...' : 'Populate from packing list'}
          </button>
        )}
      </div>

      <div className="space-y-6">
        {SECTIONS.map((section) => {
          const sectionItems = items.filter((i) => i.category === section.key)
          return (
            <div key={section.key}>
              <p className="text-xs text-lapis-text-tertiary uppercase tracking-wide mb-2">{section.label}</p>
              {sectionItems.length > 0 && (
                <ul className="space-y-1.5 mb-2">
                  {sectionItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-2.5 group">
                      <button
                        onClick={() => toggleDone(item)}
                        className={`w-4 h-4 shrink-0 rounded-lapis-sm border flex items-center justify-center transition-colors ${
                          item.doneAt ? 'bg-lapis-jade border-lapis-jade' : 'border-lapis-border-strong hover:border-lapis-text-tertiary'
                        }`}
                      >
                        {item.doneAt && <div className="w-1.5 h-1.5 rounded-[1px] bg-lapis-bg" />}
                      </button>
                      <span
                        className={`text-sm flex-1 min-w-0 ${
                          item.doneAt ? 'text-lapis-text-tertiary line-through' : 'text-lapis-text-secondary'
                        }`}
                      >
                        {item.title}
                      </span>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 text-lapis-text-disabled hover:text-lapis-garnet transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newTitles[section.key]}
                  onChange={(e) => setNewTitles((prev) => ({ ...prev, [section.key]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd(section.key)}
                  placeholder={section.addPlaceholder}
                  className="flex-1 min-w-0 bg-lapis-surface-2 border border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled rounded-lapis-sm px-2.5 py-1.5 text-sm"
                />
                <button
                  onClick={() => handleAdd(section.key)}
                  className="shrink-0 p-1.5 rounded-lapis-sm hover:bg-lapis-surface-2 text-lapis-text-tertiary transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
