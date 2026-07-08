'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { WORKOUT_TYPES } from '@/lib/gym-constants'

export default function NewWorkoutPage() {
  const router = useRouter()
  const [workoutType, setWorkoutType] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleCreateWorkout = async () => {
    if (!workoutType) return

    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('workouts')
      .insert({
        user_id: user.id,
        workout_type: workoutType,
        notes: notes || null,
        date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating workout:', error)
      alert('Failed to create workout')
      setLoading(false)
    } else {
      router.push(`/gym/workouts/${data.id}`)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/gym/workouts" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
          New Workout
        </h1>
        <p className="text-white/50 text-sm mb-8">
          Choose your workout type to get started
        </p>

        {/* Workout Type Selection */}
        <div className="mb-8">
          <label className="text-white/60 text-sm mb-3 block">Workout Type</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {WORKOUT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setWorkoutType(type)}
                className={`p-4 rounded-xl border transition-all duration-200 text-center ${
                  workoutType === type
                    ? 'bg-white text-black border-white'
                    : 'bg-white/[0.02] border-white/10 text-white hover:bg-white/[0.04] hover:border-white/20'
                }`}
              >
                <span className="font-medium">{type}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Notes (Optional) */}
        <div className="mb-8">
          <label className="text-white/60 text-sm mb-3 block">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes for this workout..."
            rows={3}
            className="w-full bg-white/5 border-white/10 text-white rounded-xl px-4 py-3 placeholder:text-white/30 resize-none"
          />
        </div>

        {/* Create Button */}
        <button
          onClick={handleCreateWorkout}
          disabled={!workoutType || loading}
          className="w-full bg-white text-black hover:bg-white/90 rounded-xl px-4 py-4 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Creating...' : 'Start Workout'}
        </button>
      </div>
    </AppLayout>
  )
}
