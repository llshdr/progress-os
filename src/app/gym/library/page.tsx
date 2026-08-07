import AppLayout from '@/components/app-layout'
import { BookOpen } from 'lucide-react'
import Link from 'next/link'

export default function LibraryPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/gym" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 block">
          ← Back
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-lapis-lg bg-lapis-surface-2 border border-lapis-border-subtle">
            <BookOpen className="w-8 h-8 text-lapis-text-secondary" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-1">
              Library
            </h1>
            <p className="text-lapis-text-tertiary text-sm">
              The building blocks your workouts are made of
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/gym/exercises" className="group">
            <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 hover:bg-lapis-surface-2 hover:border-lapis-border/15 transition-all duration-200">
              <h2 className="text-lg font-medium text-lapis-text-primary mb-2">Exercise Library</h2>
              <p className="text-lapis-text-tertiary text-sm">
                Manage your exercise collection
              </p>
            </div>
          </Link>

          <Link href="/gym/templates" className="group">
            <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 hover:bg-lapis-surface-2 hover:border-lapis-border/15 transition-all duration-200">
              <h2 className="text-lg font-medium text-lapis-text-primary mb-2">Templates</h2>
              <p className="text-lapis-text-tertiary text-sm">
                Manage your workout routines
              </p>
            </div>
          </Link>
        </div>
      </div>
    </AppLayout>
  )
}
