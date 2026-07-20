'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { FolderKanban, CheckCircle2, Archive, Target, Boxes } from 'lucide-react'
import { fetchActiveActionItems, daysBetween, type ActionItem } from '@/lib/projects'
import { getLocalDateString } from '@/lib/date'

export default function ProjectsDashboardPage() {
  const [items, setItems] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const sorted = await fetchActiveActionItems(supabase, user.id)
    setItems(sorted)
    setLoading(false)
  }

  const setStatus = async (item: ActionItem, status: 'done' | 'archived') => {
    const table = item.kind === 'goal' ? 'goals' : 'projects'
    const { error } = await supabase.from(table).update({ status }).eq('id', item.id)

    if (error) {
      console.error(`Error updating ${item.kind} status:`, error)
    } else {
      fetchItems()
    }
  }

  const today = getLocalDateString()

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <FolderKanban className="w-8 h-8 text-white/80" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">Projects</h1>
              <p className="text-white/50 text-sm">Your single next move on what matters most</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/projects/goals">
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm">
                <Target className="w-4 h-4" />
                Goals
              </button>
            </Link>
            <Link href="/projects/all">
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm">
                <Boxes className="w-4 h-4" />
                Projects
              </button>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-white/40">Loading...</div>
          </div>
        ) : items.length === 0 ? (
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center">
            <p className="text-white/40 mb-4">No active goals or projects yet</p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/projects/goals/new">
                <button className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-colors">
                  Add a goal
                </button>
              </Link>
              <Link href="/projects/all/new">
                <button className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-colors">
                  Add a project
                </button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map((item) => {
              const daysUntilDue = item.targetDate ? daysBetween(item.targetDate, today) : null
              const daysSinceTouched = daysBetween(today, item.updatedAt.slice(0, 10))

              return (
                <div
                  key={`${item.kind}-${item.id}`}
                  className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10">
                          {item.kind === 'goal' ? 'Goal' : 'Project'}
                        </span>
                        {daysUntilDue != null && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10">
                            {daysUntilDue < 0
                              ? `${Math.abs(daysUntilDue)}d overdue`
                              : daysUntilDue === 0
                                ? 'Due today'
                                : `Due in ${daysUntilDue}d`}
                          </span>
                        )}
                        {daysSinceTouched >= 7 && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10">
                            Untouched {daysSinceTouched}d
                          </span>
                        )}
                      </div>
                      <Link href={item.editHref} className="text-lg font-medium text-white hover:text-white/80">
                        {item.title}
                      </Link>
                      <p className="text-white/70 text-sm mt-1">
                        <span className="text-white/40">Next: </span>
                        {item.nextAction || <span className="text-white/30 italic">not set</span>}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setStatus(item, 'done')}
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                        title="Mark done"
                      >
                        <CheckCircle2 className="w-5 h-5 text-white/40" />
                      </button>
                      <button
                        onClick={() => setStatus(item, 'archived')}
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                        title="Archive"
                      >
                        <Archive className="w-5 h-5 text-white/40" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
