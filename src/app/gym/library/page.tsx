import AppLayout from '@/components/app-layout'
import { BookOpen } from 'lucide-react'
import Link from 'next/link'

export default function LibraryPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/gym" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <BookOpen className="w-8 h-8 text-white/80" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">
              Library
            </h1>
            <p className="text-white/50 text-sm">
              The building blocks your workouts are made of
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/gym/exercises" className="group">
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/15 transition-all duration-200">
              <h2 className="text-lg font-medium text-white mb-2">Exercise Library</h2>
              <p className="text-white/40 text-sm">
                Manage your exercise collection
              </p>
            </div>
          </Link>

          <Link href="/gym/templates" className="group">
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/15 transition-all duration-200">
              <h2 className="text-lg font-medium text-white mb-2">Templates</h2>
              <p className="text-white/40 text-sm">
                Manage your workout routines
              </p>
            </div>
          </Link>
        </div>
      </div>
    </AppLayout>
  )
}
