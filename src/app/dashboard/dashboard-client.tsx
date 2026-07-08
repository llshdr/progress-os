'use client'

import { createClient } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/utils'
import AppLayout from '@/components/app-layout'
import { User } from '@supabase/supabase-js'
import { LogOut } from 'lucide-react'

interface DashboardClientProps {
  user: User
}

export default function DashboardClient({ user }: DashboardClientProps) {
  const supabase = createClient()

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error signing out:', error)
      alert(`Failed to sign out: ${getErrorMessage(error)}`)
      return
    }
    window.location.href = '/auth'
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
              What should I do next?
            </h1>
            <p className="text-white/50 text-sm">
              Welcome back, {user.email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <a href="/gym" className="group">
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/15 transition-all duration-200">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-white mb-1">Gym</h2>
                <p className="text-white/40 text-sm">
                  Track workouts, goals, and body composition
                </p>
              </div>
            </div>
          </a>

          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 opacity-50">
            <div className="mb-4">
              <h2 className="text-lg font-medium text-white mb-1">Nutrition</h2>
              <p className="text-white/40 text-sm">
                Coming soon
              </p>
            </div>
          </div>

          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 opacity-50">
            <div className="mb-4">
              <h2 className="text-lg font-medium text-white mb-1">Projects</h2>
              <p className="text-white/40 text-sm">
                Coming soon
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
