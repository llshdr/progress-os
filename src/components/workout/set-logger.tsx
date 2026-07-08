'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, X } from 'lucide-react'

interface SetLoggerProps {
  exerciseId: string
  exerciseName: string
  onComplete?: () => void
}

interface PreviousSet {
  weight: number
  reps: number
  date: string
}

export default function SetLogger({ exerciseId, exerciseName, onComplete }: SetLoggerProps) {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [currentSetNumber, setCurrentSetNumber] = useState(1)
  const [previousSet, setPreviousSet] = useState<PreviousSet | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  // Fetch the last set for this exercise to suggest weight/reps
  useEffect(() => {
    fetchPreviousSet()
  }, [exerciseId])

  const fetchPreviousSet = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // Get the most recent completed set for this exercise
    const { data, error } = await supabase
      .from('sets')
      .select('weight, reps, created_at')
      .eq('exercise_id', exerciseId)
      .eq('completed', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data && !error) {
      setPreviousSet({
        weight: data.weight,
        reps: data.reps,
        date: data.created_at,
      })
      // Pre-fill weight from last set
      setWeight(data.weight.toString())
    }
  }

  const handleSaveSet = async () => {
    if (!weight || !reps) return

    setLoading(true)

    const { error } = await supabase.from('sets').insert({
      exercise_id: exerciseId,
      weight: parseFloat(weight),
      reps: parseInt(reps),
      completed: true,
      set_order: currentSetNumber,
    })

    if (error) {
      console.error('Error saving set:', error)
      alert('Failed to save set')
      setLoading(false)
      return
    }

    // Prepare for next set
    setCurrentSetNumber(prev => prev + 1)
    setReps('')
    // Keep the same weight for next set (common pattern)
    setLoading(false)
  }

  const handleSkipSet = () => {
    setCurrentSetNumber(prev => prev + 1)
    setReps('')
  }

  const handleFinishExercise = () => {
    if (onComplete) onComplete()
  }

  return (
    <div className="space-y-6">
      {/* Exercise Header */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-white mb-1">
          {exerciseName}
        </h2>
        {previousSet && (
          <div className="text-white/40 text-sm">
            Last: {previousSet.weight} × {previousSet.reps}
          </div>
        )}
      </div>

      {/* Current Set */}
      <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
        <div className="text-white/40 text-sm mb-4">
          Set {currentSetNumber}
        </div>

        <div className="space-y-4">
          {/* Weight Input */}
          <div className="space-y-2">
            <label className="text-white/60 text-sm">Weight (kg)</label>
            <Input
              type="number"
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="82.5"
              className="bg-white/5 border-white/10 text-white text-2xl font-semibold h-16 text-center placeholder:text-white/20"
              autoFocus
            />
          </div>

          {/* Reps Input */}
          <div className="space-y-2">
            <label className="text-white/60 text-sm">Reps</label>
            <Input
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              placeholder="8"
              className="bg-white/5 border-white/10 text-white text-2xl font-semibold h-16 text-center placeholder:text-white/20"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSaveSet}
              disabled={loading || !weight || !reps}
              className="flex-1 bg-white text-black hover:bg-white/90 h-14 text-base font-medium"
            >
              {loading ? (
                'Saving...'
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Save Set
                </>
              )}
            </Button>
            <Button
              onClick={handleSkipSet}
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5 h-14 px-4"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Finish Button */}
      <Button
        onClick={handleFinishExercise}
        variant="outline"
        className="w-full border-white/10 text-white hover:bg-white/5 h-12"
      >
        Finish Exercise
      </Button>
    </div>
  )
}
