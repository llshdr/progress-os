'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User } from '@supabase/supabase-js'

interface DashboardClientProps {
  user: User
}

export default function DashboardClient({ user }: DashboardClientProps) {
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth'
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-white">Progress OS</h1>
            <Button
              onClick={handleSignOut}
              variant="ghost"
              className="text-neutral-400 hover:text-white"
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            What should I do next?
          </h2>
          <p className="text-neutral-400">
            Welcome back, {user.email}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <a href="/goals">
            <Card className="bg-neutral-900 border-neutral-800 hover:border-neutral-700 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="text-white">Weekly Goals</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-400 text-sm">
                  Set and track your weekly objectives
                </p>
              </CardContent>
            </Card>
          </a>

          <a href="/weight">
            <Card className="bg-neutral-900 border-neutral-800 hover:border-neutral-700 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="text-white">Weight Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-400 text-sm">
                  Monitor your body composition progress
                </p>
              </CardContent>
            </Card>
          </a>
        </div>
      </main>
    </div>
  )
}
