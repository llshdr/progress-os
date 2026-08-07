import AppLayout from '@/components/app-layout'
import { TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default function GymProgressPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/gym" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 block">
          ← Back
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-lapis-lg bg-lapis-surface-2 border border-lapis-border-subtle">
            <TrendingUp className="w-8 h-8 text-lapis-text-secondary" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-1">
              Progress
            </h1>
            <p className="text-lapis-text-tertiary text-sm">
              How you&apos;re trending over time
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link href="/gym/records" className="group">
            <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 hover:bg-lapis-surface-2 hover:border-lapis-border/15 transition-all duration-200">
              <h2 className="text-lg font-medium text-lapis-text-primary mb-2">Personal Records</h2>
              <p className="text-lapis-text-tertiary text-sm">
                Your best lifts and runs, all in one place
              </p>
            </div>
          </Link>

          <Link href="/gym/weight" className="group">
            <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 hover:bg-lapis-surface-2 hover:border-lapis-border/15 transition-all duration-200">
              <h2 className="text-lg font-medium text-lapis-text-primary mb-2">Weight Tracking</h2>
              <p className="text-lapis-text-tertiary text-sm">
                Monitor your body composition progress
              </p>
            </div>
          </Link>

          <Link href="/gym/progress/races" className="group">
            <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 hover:bg-lapis-surface-2 hover:border-lapis-border/15 transition-all duration-200">
              <h2 className="text-lg font-medium text-lapis-text-primary mb-2">Races</h2>
              <p className="text-lapis-text-tertiary text-sm">
                Your race history and what&apos;s next
              </p>
            </div>
          </Link>

          <Link href="/gym/sleep" className="group">
            <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 hover:bg-lapis-surface-2 hover:border-lapis-border/15 transition-all duration-200">
              <h2 className="text-lg font-medium text-lapis-text-primary mb-2">Sleep</h2>
              <p className="text-lapis-text-tertiary text-sm">
                Hours slept and bedroom temperature, trended over time
              </p>
            </div>
          </Link>
        </div>
      </div>
    </AppLayout>
  )
}
