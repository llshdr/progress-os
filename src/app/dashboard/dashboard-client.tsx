'use client'

import { useMemo } from 'react'
import {
  ArrowRight,
  Dumbbell,
  FolderKanban,
  Play,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress-bar'
import { WeeklyProgress } from '@/components/dashboard/weekly-progress'
import { QuickAdd } from '@/components/dashboard/quick-add'
import { User } from '@supabase/supabase-js'

interface DashboardClientProps {
  user: User
}

function greeting(date: Date) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function firstName(user: User) {
  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string }
  const raw = meta.full_name || meta.name || user.email?.split('@')[0] || 'there'
  const first = raw.split(/[\s.]+/)[0]
  return first.charAt(0).toUpperCase() + first.slice(1)
}

const WEEK = [
  { label: 'Mon', value: 0.9 },
  { label: 'Tue', value: 0.75 },
  { label: 'Wed', value: 1 },
  { label: 'Thu', value: 0.6 },
  { label: 'Fri', value: 0.45, today: true },
  { label: 'Sat', value: 0.1 },
  { label: 'Sun', value: 0 },
]

export default function DashboardClient({ user }: DashboardClientProps) {
  const supabase = createClient()
  const name = useMemo(() => firstName(user), [user])
  const hello = useMemo(() => greeting(new Date()), [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth'
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header — quiet, thin, unobtrusive */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <span className="text-sm font-semibold tracking-tight text-foreground/90">
            Progress OS
          </span>
          <Button
            onClick={handleSignOut}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-14 sm:pt-20">
        <div className="animate-rise space-y-12">
          {/* Greeting */}
          <section className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {hello}, {name}.
            </h1>
            <p className="text-base text-muted-foreground">
              One thing at a time. Let&apos;s make today count.
            </p>
          </section>

          {/* Today's Focus — the single most important card */}
          <section
            className="group relative overflow-hidden rounded-3xl border border-border/70 bg-card p-8 shadow-2xl shadow-black/20 transition-all duration-300 hover:border-border sm:p-10"
          >
            <div
              className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-primary/10 blur-3xl transition-opacity duration-500 group-hover:opacity-80"
              aria-hidden
            />
            <div className="relative flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">
                  <span className="size-1.5 rounded-full bg-primary" />
                  Today&apos;s Focus
                </div>
                <h2 className="max-w-md text-2xl font-semibold leading-snug tracking-tight text-foreground sm:text-3xl">
                  Finish editing True Athletics Short
                </h2>
                <div className="flex items-baseline gap-2 text-sm text-muted-foreground">
                  <span>Estimated time</span>
                  <span className="font-medium text-foreground">1h 45m</span>
                </div>
              </div>
              <Button size="xl" className="w-full shrink-0 sm:w-auto">
                <Play className="fill-current" />
                Start
              </Button>
            </div>
          </section>

          {/* Two equal secondary cards */}
          <section className="grid gap-6 sm:grid-cols-2">
            {/* Gym */}
            <div className="flex flex-col justify-between gap-6 rounded-3xl border border-border/70 bg-card p-7 transition-all duration-300 hover:border-border hover:shadow-xl hover:shadow-black/20">
              <div className="space-y-5">
                <div className="flex items-center gap-2.5 text-sm font-medium text-muted-foreground">
                  <Dumbbell className="size-4" />
                  Gym
                </div>
                <div className="space-y-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-semibold tracking-tight text-foreground">
                      67.8
                    </span>
                    <span className="text-sm text-muted-foreground">kg</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Push day · Bench, OHP, Triceps
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Today&apos;s workout</span>
                  <span>3 of 6</span>
                </div>
                <ProgressBar value={50} />
              </div>
            </div>

            {/* Projects */}
            <div className="flex flex-col justify-between gap-6 rounded-3xl border border-border/70 bg-card p-7 transition-all duration-300 hover:border-border hover:shadow-xl hover:shadow-black/20">
              <div className="space-y-5">
                <div className="flex items-center gap-2.5 text-sm font-medium text-muted-foreground">
                  <FolderKanban className="size-4" />
                  Projects
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold tracking-tight text-foreground">
                    True Athletics
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Highest priority this week
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Next action</p>
                  <p className="truncate font-medium text-foreground">
                    Color grade the short
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </div>
            </div>
          </section>

          {/* Weekly Progress */}
          <section className="space-y-6 rounded-3xl border border-border/70 bg-card p-7 sm:p-8">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">
                Weekly Progress
              </h3>
              <span className="text-xs text-muted-foreground">This week</span>
            </div>
            <WeeklyProgress days={WEEK} />
          </section>

          {/* Quick Add */}
          <section>
            <QuickAdd />
          </section>
        </div>
      </main>
    </div>
  )
}
