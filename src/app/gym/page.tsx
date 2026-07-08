import AppLayout from '@/components/app-layout'
import { Dumbbell } from 'lucide-react'
import Link from 'next/link'

export default function GymPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <Dumbbell className="w-8 h-8 text-white/80" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">
              Gym
            </h1>
            <p className="text-white/50 text-sm">
              Track your fitness journey
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link href="/gym/workouts" className="group">
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/15 transition-all duration-200">
              <h2 className="text-lg font-medium text-white mb-2">Workouts</h2>
              <p className="text-white/40 text-sm">
                Track your training sessions
              </p>
            </div>
          </Link>

          <Link href="/gym/goals" className="group">
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/15 transition-all duration-200">
              <h2 className="text-lg font-medium text-white mb-2">Weekly Goals</h2>
              <p className="text-white/40 text-sm">
                Set and track your weekly fitness objectives
              </p>
            </div>
          </Link>

          <Link href="/gym/weight" className="group">
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/15 transition-all duration-200">
              <h2 className="text-lg font-medium text-white mb-2">Weight Tracking</h2>
              <p className="text-white/40 text-sm">
                Monitor your body composition progress
              </p>
            </div>
          </Link>
        </div>
      </div>
    </AppLayout>
  )
}
