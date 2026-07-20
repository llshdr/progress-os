'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Plus, Pencil, CheckCircle2, Archive, RotateCcw } from 'lucide-react'
import type { ActionItemStatus } from '@/lib/projects'

type Project = {
  id: string
  title: string
  description: string | null
  next_action: string | null
  status: ActionItemStatus
  goal_id: string | null
}

export default function ProjectsListPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [goalTitles, setGoalTitles] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching projects:', error)
    } else {
      setProjects(data || [])
    }

    const { data: goals } = await supabase.from('goals').select('id, title').eq('user_id', user.id)
    const titles: Record<string, string> = {}
    for (const goal of goals || []) titles[goal.id] = goal.title
    setGoalTitles(titles)

    setLoading(false)
  }

  const setStatus = async (id: string, status: ActionItemStatus) => {
    const { error } = await supabase.from('projects').update({ status }).eq('id', id)

    if (error) {
      console.error('Error updating project status:', error)
    } else {
      fetchProjects()
    }
  }

  const visibleProjects = projects.filter((p) => showAll || p.status === 'active')

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/projects" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">Projects</h1>
            <p className="text-white/50 text-sm">Concrete efforts, each with one next step</p>
          </div>
          <Link href="/projects/all/new">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-white/90 transition-colors">
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Add Project</span>
            </button>
          </Link>
        </div>

        <div className="mb-8">
          <button
            onClick={() => setShowAll(!showAll)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showAll ? 'bg-white/10 text-white border-white/20' : 'bg-white/5 text-white/60 border-white/10'
            } border`}
          >
            <span className="text-sm">Show done/archived</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-white/40">Loading...</div>
          </div>
        ) : visibleProjects.length === 0 ? (
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center">
            <p className="text-white/40 mb-4">No projects yet</p>
            <Link href="/projects/all/new">
              <button className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-colors">
                Add your first project
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {visibleProjects.map((project) => (
              <div
                key={project.id}
                className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-medium text-white">{project.title}</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10">
                        {project.status}
                      </span>
                      {project.goal_id && goalTitles[project.goal_id] && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10">
                          {goalTitles[project.goal_id]}
                        </span>
                      )}
                    </div>
                    {project.description && <p className="text-white/40 text-sm mb-2">{project.description}</p>}
                    <p className="text-white/70 text-sm">
                      <span className="text-white/40">Next: </span>
                      {project.next_action || <span className="text-white/30 italic">not set</span>}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/projects/all/${project.id}/edit`}
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <Pencil className="w-5 h-5 text-white/40" />
                    </Link>
                    {project.status === 'active' ? (
                      <>
                        <button
                          onClick={() => setStatus(project.id, 'done')}
                          className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                          title="Mark done"
                        >
                          <CheckCircle2 className="w-5 h-5 text-white/40" />
                        </button>
                        <button
                          onClick={() => setStatus(project.id, 'archived')}
                          className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                          title="Archive"
                        >
                          <Archive className="w-5 h-5 text-white/40" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setStatus(project.id, 'active')}
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                        title="Reactivate"
                      >
                        <RotateCcw className="w-5 h-5 text-white/40" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
