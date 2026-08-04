import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExperienceLevel } from '@/lib/race-plan/self-assessment'

export interface RaceCourseProfile {
  difficultyFactor: number
  elevationGainM: number | null
  swimNotes: string | null
  bikeNotes: string | null
  runNotes: string | null
}

export interface RaceCourseTimeBand {
  abilityTier: ExperienceLevel
  swimExitSecondsLow: number | null
  swimExitSecondsHigh: number | null
  bikeFinishSecondsLow: number | null
  bikeFinishSecondsHigh: number | null
  totalSecondsLow: number
  totalSecondsHigh: number
}

export type CutoffSegment = 'swim' | 'bike' | 'overall'

export interface RaceCourseCutoff {
  segment: CutoffSegment
  cutoffSecondsFromStart: number
}

// Narrow, targeted selects - no joins, called only for multisport races
// with a course_id. Each returns null/empty gracefully rather than
// throwing when a course has no profile/band/cutoffs seeded yet (most
// courses start with only a generic tier band available - see
// estimateCourseFinishRange in finish-time.ts).

// Qualitative-only, never the raw decimal (would read as fabricated
// precision this app doesn't have) - only speaks up when there's
// something worth saying, same "only flag a real mismatch" precedent as
// summarizeSeasonMismatch (race-day-prep.ts). Shared by the AI prompt
// (route.ts) and the course-notes UI card (page.tsx) so the two can't
// describe the same course's difficulty differently.
export function describeCourseDifficulty(difficultyFactor: number): string | null {
  if (difficultyFactor <= 1.0) return null
  return 'Notably harder than a standard course of this type - factor that into your pacing and finish-time expectations.'
}

export async function fetchCourseProfile(supabase: SupabaseClient, courseId: string): Promise<RaceCourseProfile | null> {
  const { data, error } = await supabase
    .from('race_course_profiles')
    .select('difficulty_factor, elevation_gain_m, swim_notes, bike_notes, run_notes')
    .eq('course_id', courseId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching race course profile:', error)
    return null
  }
  if (!data) return null

  return {
    difficultyFactor: data.difficulty_factor,
    elevationGainM: data.elevation_gain_m,
    swimNotes: data.swim_notes,
    bikeNotes: data.bike_notes,
    runNotes: data.run_notes,
  }
}

export async function fetchCourseTimeBand(supabase: SupabaseClient, courseId: string, tier: ExperienceLevel): Promise<RaceCourseTimeBand | null> {
  const { data, error } = await supabase
    .from('race_course_time_bands')
    .select('ability_tier, swim_exit_seconds_low, swim_exit_seconds_high, bike_finish_seconds_low, bike_finish_seconds_high, total_seconds_low, total_seconds_high')
    .eq('course_id', courseId)
    .eq('ability_tier', tier)
    .maybeSingle()

  if (error) {
    console.error('Error fetching race course time band:', error)
    return null
  }
  if (!data) return null

  return {
    abilityTier: data.ability_tier,
    swimExitSecondsLow: data.swim_exit_seconds_low,
    swimExitSecondsHigh: data.swim_exit_seconds_high,
    bikeFinishSecondsLow: data.bike_finish_seconds_low,
    bikeFinishSecondsHigh: data.bike_finish_seconds_high,
    totalSecondsLow: data.total_seconds_low,
    totalSecondsHigh: data.total_seconds_high,
  }
}

export async function fetchCourseCutoffs(supabase: SupabaseClient, courseId: string): Promise<RaceCourseCutoff[]> {
  const { data, error } = await supabase
    .from('race_course_cutoffs')
    .select('segment, cutoff_seconds_from_start')
    .eq('course_id', courseId)

  if (error) {
    console.error('Error fetching race course cutoffs:', error)
    return []
  }

  return (data ?? []).map((row: any) => ({
    segment: row.segment as CutoffSegment,
    cutoffSecondsFromStart: row.cutoff_seconds_from_start as number,
  }))
}
