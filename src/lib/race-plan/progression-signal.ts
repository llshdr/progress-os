import type { RaceCategory } from '@/lib/race-plan/self-assessment'
import type { BenchmarkFlag } from '@/lib/race-plan/benchmark-verification'

// Feeds the rank system's progression bonus (migration 076) - reuses
// assessBenchmarkCompliance's already-computed flags rather than
// reimplementing any plan-compliance logic here. That function only
// ever flags disciplines CURRENTLY running behind (a discipline with
// nothing to report isn't in the list at all) - so this translates
// "how many/how badly flagged, out of how many disciplines" into a
// single 0-1 "on track" ratio. 'behind' counts as a full miss, 'watch'
// as a half-miss (it's explicitly the softer, "not yet a pattern"
// status in benchmark-verification.ts's own framing).
function penaltyRatio(flags: BenchmarkFlag[], disciplineCount: number): number {
  const behindCount = flags.filter((f) => f.status === 'behind').length
  const watchCount = flags.filter((f) => f.status === 'watch').length
  return (behindCount + watchCount * 0.5) / disciplineCount
}

// weeksElapsedSoFar mirrors assessBenchmarkCompliance's own internal
// MIN_WEEKS_FOR_EVIDENCE=4 gate - that function silently returns no
// flags at all both when everything's on track AND when there simply
// isn't enough evaluated history yet, so those two cases are
// indistinguishable from its output alone. This adds the same real gate
// at the call site instead of guessing: no evaluable race category, or
// fewer than 4 weeks of the plan elapsed, returns null (insufficient
// evidence), never a fabricated "perfect" score for a plan that just
// started.
export function computeRacesProgressionSignal(
  category: RaceCategory,
  benchmarkFlags: BenchmarkFlag[],
  weeksElapsedSoFar: number
): number | null {
  if (category !== 'multisport' && category !== 'run') return null
  if (weeksElapsedSoFar < 4) return null

  const disciplineCount = category === 'multisport' ? 3 : 1
  return Math.max(0, Math.min(1, 1 - penaltyRatio(benchmarkFlags, disciplineCount)))
}
