import AppLayout from '@/components/app-layout'
import { Dumbbell } from 'lucide-react'
import Link from 'next/link'

export default function TrainPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/gym" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <Dumbbell className="w-8 h-8 text-white/80" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">
              Train
            </h1>
            <p className="text-white/50 text-sm">
              What to do today and your training history
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/gym/workouts" className="group">
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/15 transition-all duration-200">
              <h2 className="text-lg font-medium text-white mb-2">Workouts</h2>
              <p className="text-white/40 text-sm">
                Track your training sessions
              </p>
            </div>
          </Link>

          <Link href="/gym/schedule" className="group">
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/15 transition-all duration-200">
              <h2 className="text-lg font-medium text-white mb-2">Schedule</h2>
              <p className="text-white/40 text-sm">
                An optional rotation, plus weekly volume per muscle
              </p>
            </div>
          </Link>
        </div>
      </div>
    </AppLayout>
  )
}
