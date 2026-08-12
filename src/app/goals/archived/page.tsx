'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Archive, ArrowLeft, RotateCcw, Trash2 } from 'lucide-react'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { LoadErrorBanner } from '@/components/ui/load-error-banner'

type ArchivedGoal = {
  id: string
  title: string
  description: string | null
  target_date: string | null
  updated_at: string
}

// A dedicated, focused view of archived goals only (never done ones -
// those already have their own toggle on the main Goals page) - browsing
// years of old, deliberately-set-aside goals is a different task than
// "what's active right now," so it gets its own page rather than another
// filter bolted onto the main list.
export default function ArchivedGoalsPage() {
  const [goals, setGoals] = useState<ArchivedGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [yearFilter, setYearFilter] = useState<number | null>(null)
  const [itemToDelete, setItemToDelete] = useState<ArchivedGoal | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchArchivedGoals()
  }, [])

  const fetchArchivedGoals = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('goals')
      .select('id, title, description, target_date, updated_at')
      .eq('user_id', user.id)
      .eq('status', 'archived')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching archived goals:', error)
      setLoadError(true)
    } else {
      setGoals(data ?? [])
    }
    setLoading(false)
  }

  const handleReactivate = async (id: string) => {
    const { error } = await supabase.from('goals').update({ status: 'active' }).eq('id', id)
    if (error) {
      console.error('Error reactivating goal:', error)
      return
    }
    fetchArchivedGoals()
  }

  const handleDelete = async () => {
    if (!itemToDelete) return
    const { error } = await supabase.from('goals').delete().eq('id', itemToDelete.id)
    if (error) console.error('Error deleting goal:', error)
    setItemToDelete(null)
    fetchArchivedGoals()
  }

  // updated_at is the same "last touched" timestamp the rest of this app
  // already treats as the archive signal (there's no dedicated
  // archived_at column) - an approximation, called out below rather than
  // presented as an exact archive date.
  const years = Array.from(new Set(goals.map((g) => new Date(g.updated_at).getFullYear()))).sort((a, b) => b - a)
  const filteredGoals = yearFilter == null ? goals : goals.filter((g) => new Date(g.updated_at).getFullYear() === yearFilter)

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/goals" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Goals
        </Link>

        <div className="flex items-center gap-4 mb-8 mt-6">
          <div className="p-3 rounded-lapis-lg bg-lapis-surface-2 border border-lapis-border-subtle">
            <Archive className="w-8 h-8 text-lapis-text-secondary" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-1">Archived Goals</h1>
            <p className="text-lapis-text-tertiary text-sm">Goals you set aside, not marked done</p>
          </div>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : (
          <>
            {loadError && <LoadErrorBanner message="Couldn't load your archived goals. Try refreshing." />}
            {goals.length === 0 ? (
          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-12 text-center">
            <Archive className="w-10 h-10 text-lapis-text-disabled mx-auto mb-4" />
            <p className="text-lapis-text-tertiary">No archived goals yet</p>
          </div>
        ) : (
          <>
            {years.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-8">
                <button
                  onClick={() => setYearFilter(null)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    yearFilter === null
                      ? 'bg-lapis-accent-500 text-lapis-text-primary'
                      : 'bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-subtle hover:bg-lapis-surface-2'
                  }`}
                >
                  All
                </button>
                {years.map((year) => (
                  <button
                    key={year}
                    onClick={() => setYearFilter(year)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      yearFilter === year
                        ? 'bg-lapis-accent-500 text-lapis-text-primary'
                        : 'bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-subtle hover:bg-lapis-surface-2'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}

            <div className="grid gap-3">
              {filteredGoals.map((goal) => (
                <div
                  key={goal.id}
                  className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 hover:bg-lapis-surface-2 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-medium text-lapis-text-primary">{goal.title}</h3>
                      {goal.description && <p className="text-lapis-text-secondary text-sm mt-1">{goal.description}</p>}
                      <p className="text-lapis-text-disabled text-xs mt-2">
                        Archived around {new Date(goal.updated_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleReactivate(goal.id)}
                        className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 transition-colors"
                        title="Reactivate"
                      >
                        <RotateCcw className="w-5 h-5 text-lapis-text-tertiary" />
                      </button>
                      <button
                        onClick={() => setItemToDelete(goal)}
                        className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5 text-lapis-text-tertiary" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
          </>
        )}
      </div>

      <ConfirmationModal
        open={itemToDelete !== null}
        onOpenChange={(open) => !open && setItemToDelete(null)}
        title="Delete Goal"
        description="Are you sure you want to delete this goal? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
        destructive
      />
    </AppLayout>
  )
}
