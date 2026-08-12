'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ThumbsUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { LoadErrorBanner } from '@/components/ui/load-error-banner'
import { PRIMARY_LIFTS, PRIMARY_LIFT_LABELS, type PrimaryLift } from '@/lib/exercise-constants'

type PublicProfile = {
  user_id: string
  display_name: string
  avatar_url: string | null
}

type PublicLiftRecord = {
  user_id: string
  bench_estimated_1rm: number | null
  bench_tested_1rm: number | null
  squat_estimated_1rm: number | null
  squat_tested_1rm: number | null
  deadlift_estimated_1rm: number | null
  deadlift_tested_1rm: number | null
  ohp_estimated_1rm: number | null
  ohp_tested_1rm: number | null
}

// Maps a PrimaryLift key to its pair of columns on public_lift_records -
// keeps the column-name string literals in exactly one place.
const LIFT_COLUMNS: Record<PrimaryLift, { estimated: keyof PublicLiftRecord; tested: keyof PublicLiftRecord }> = {
  bench_press: { estimated: 'bench_estimated_1rm', tested: 'bench_tested_1rm' },
  back_squat: { estimated: 'squat_estimated_1rm', tested: 'squat_tested_1rm' },
  deadlift: { estimated: 'deadlift_estimated_1rm', tested: 'deadlift_tested_1rm' },
  overhead_press: { estimated: 'ohp_estimated_1rm', tested: 'ohp_tested_1rm' },
}

type LeaderboardRow = {
  userId: string
  displayName: string
  avatarUrl: string | null
  estimated: number | null
  tested: number | null
}

type Reaction = { targetUserId: string; lift: PrimaryLift; reactorUserId: string }

// A real, numeric leaderboard - deliberately a separate page from
// /profile/compare, whose own copy promises "nothing here but names,
// tiers, and pictures." Reading real 1RM numbers into that page would
// contradict what it already tells the user about itself, so this gets
// its own honestly-labeled space instead, linked from there.
//
// Sourced from public_lift_records (migration 081) - exactly 4 tracked
// lifts x 2 values each (an auto-computed Epley estimate from real
// logged sets, or an optional self-entered "tested" max via the
// existing manual-PR flow), joined against public_profiles for identity.
// Nothing else about any other user is fetched or shown here.
export default function LeaderboardPage() {
  const [profiles, setProfiles] = useState<PublicProfile[]>([])
  const [liftRecords, setLiftRecords] = useState<PublicLiftRecord[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [ownUserId, setOwnUserId] = useState<string | null>(null)
  const [activeLift, setActiveLift] = useState<PrimaryLift>('bench_press')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) setOwnUserId(user.id)

    const [{ data: profileRows, error: profileError }, { data: liftRows, error: liftError }] = await Promise.all([
      supabase.from('public_profiles').select('user_id, display_name, avatar_url'),
      supabase
        .from('public_lift_records')
        .select(
          'user_id, bench_estimated_1rm, bench_tested_1rm, squat_estimated_1rm, squat_tested_1rm, deadlift_estimated_1rm, deadlift_tested_1rm, ohp_estimated_1rm, ohp_tested_1rm'
        ),
    ])

    if (profileError) console.error('Error fetching profiles:', profileError)
    if (liftError) console.error('Error fetching lift records:', liftError)
    if (profileError || liftError) setLoadError(true)

    setProfiles(profileRows ?? [])
    setLiftRecords(liftRows ?? [])
    await fetchReactions()
    setLoading(false)
  }

  // Separate from fetchAll so toggling a reaction doesn't need to
  // refetch profiles/lift records too. All lifts fetched at once (this
  // table stays small) rather than refetching on every tab switch.
  const fetchReactions = async () => {
    const { data, error } = await supabase.from('leaderboard_reactions').select('target_user_id, lift, reactor_user_id')
    if (error) {
      console.error('Error fetching leaderboard reactions:', error)
      return
    }
    setReactions((data ?? []).map((r) => ({ targetUserId: r.target_user_id, lift: r.lift as PrimaryLift, reactorUserId: r.reactor_user_id })))
  }

  // Toggle - insert if not yet reacted, delete if already reacted. The
  // DB's own UNIQUE/CHECK constraints are the real guard (one reaction
  // per person per lift per target, never on your own row); this is
  // just deciding which of insert/delete to attempt.
  const handleToggleReaction = async (targetUserId: string) => {
    if (!ownUserId || targetUserId === ownUserId) return

    const alreadyReacted = reactions.some((r) => r.targetUserId === targetUserId && r.lift === activeLift && r.reactorUserId === ownUserId)

    if (alreadyReacted) {
      const { error } = await supabase
        .from('leaderboard_reactions')
        .delete()
        .eq('target_user_id', targetUserId)
        .eq('lift', activeLift)
        .eq('reactor_user_id', ownUserId)
      if (error) {
        console.error('Error removing reaction:', error)
        return
      }
    } else {
      const { error } = await supabase
        .from('leaderboard_reactions')
        .insert({ target_user_id: targetUserId, lift: activeLift, reactor_user_id: ownUserId })
      if (error) {
        console.error('Error adding reaction:', error)
        return
      }
    }
    fetchReactions()
  }

  const profileById = new Map(profiles.map((p) => [p.user_id, p]))
  const columns = LIFT_COLUMNS[activeLift]

  const rows: LeaderboardRow[] = liftRecords
    .map((record): LeaderboardRow | null => {
      const profile = profileById.get(record.user_id)
      if (!profile) return null
      const estimated = record[columns.estimated] as number | null
      const tested = record[columns.tested] as number | null
      if (estimated == null && tested == null) return null
      return { userId: record.user_id, displayName: profile.display_name, avatarUrl: profile.avatar_url, estimated, tested }
    })
    .filter((r): r is LeaderboardRow => r !== null)
    .sort((a, b) => Math.max(b.tested ?? -Infinity, b.estimated ?? -Infinity) - Math.max(a.tested ?? -Infinity, a.estimated ?? -Infinity))

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/profile/compare" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-1">Strength Leaderboard</h1>
        <p className="text-lapis-text-tertiary text-sm mb-8">
          Bench, squat, deadlift, and overhead press - nothing else about anyone else is shown here.
        </p>

        {loading ? (
          <PageSkeleton />
        ) : (
          <>
            {loadError && <LoadErrorBanner message="Couldn't load the leaderboard. Try refreshing." />}
            <div className="flex flex-wrap gap-2 mb-8">
              {PRIMARY_LIFTS.map((lift) => (
                <button
                  key={lift}
                  onClick={() => setActiveLift(lift)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    activeLift === lift
                      ? 'bg-lapis-accent-500 text-lapis-text-primary'
                      : 'bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-subtle hover:bg-lapis-surface-2'
                  }`}
                >
                  {PRIMARY_LIFT_LABELS[lift]}
                </button>
              ))}
            </div>

            {rows.length === 0 ? (
              <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-8 text-center">
                <p className="text-lapis-text-tertiary">Nobody has a {PRIMARY_LIFT_LABELS[activeLift]} on the board yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map((row, i) => (
                  <div
                    key={row.userId}
                    className={`border rounded-lapis-lg p-4 flex items-center gap-3 ${
                      row.userId === ownUserId
                        ? 'border-lapis-border-strong bg-lapis-accent-500/[0.05]'
                        : 'border-lapis-border-subtle bg-lapis-surface-1'
                    }`}
                  >
                    <span className="font-data text-lapis-text-disabled text-sm w-5 shrink-0 text-right">{i + 1}</span>
                    {row.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.avatarUrl}
                        alt={row.displayName}
                        className="w-12 h-12 rounded-full object-cover border border-lapis-border-subtle"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-lapis-surface-2 border border-lapis-border-subtle flex items-center justify-center text-lapis-text-tertiary">
                        {row.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-lapis-text-primary font-medium">
                        {row.displayName}
                        {row.userId === ownUserId && <span className="text-lapis-text-tertiary font-normal"> (you)</span>}
                      </p>
                      <p className="text-lapis-text-tertiary text-sm">
                        {row.tested != null && `Tested: ${Math.round(row.tested)} kg`}
                        {row.tested != null && row.estimated != null && ' · '}
                        {row.estimated != null && `Estimated: ${Math.round(row.estimated)} kg`}
                      </p>
                    </div>
                    {(() => {
                      const rowReactions = reactions.filter((r) => r.targetUserId === row.userId && r.lift === activeLift)
                      const reactorNames = rowReactions
                        .map((r) => profileById.get(r.reactorUserId)?.display_name)
                        .filter((n): n is string => Boolean(n))
                      const titleText = reactorNames.length > 0 ? reactorNames.join(', ') : undefined

                      // Own row: a plain count (if any), no button - can't
                      // kudos yourself, same rule the DB itself enforces.
                      if (row.userId === ownUserId) {
                        return (
                          rowReactions.length > 0 && (
                            <span
                              title={titleText}
                              className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-tertiary border border-lapis-border-subtle"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                              {rowReactions.length}
                            </span>
                          )
                        )
                      }

                      const hasReacted = rowReactions.some((r) => r.reactorUserId === ownUserId)
                      return (
                        <button
                          onClick={() => handleToggleReaction(row.userId)}
                          title={titleText ?? 'Give kudos'}
                          className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs border transition-colors ${
                            hasReacted
                              ? 'bg-lapis-accent-500 text-lapis-text-primary border-lapis-border'
                              : 'bg-lapis-surface-2 text-lapis-text-tertiary border-lapis-border-subtle hover:bg-lapis-surface-2 hover:text-lapis-text-primary'
                          }`}
                        >
                          <ThumbsUp className={`w-3.5 h-3.5 ${hasReacted ? 'fill-current' : ''}`} />
                          {rowReactions.length > 0 && rowReactions.length}
                        </button>
                      )
                    })()}
                  </div>
                ))}
              </div>
            )}

            <p className="text-lapis-text-disabled text-xs mt-6">
              Estimated = Epley formula from real logged sets. Tested = a self-entered 1-rep PR. Both are shown so
              nobody has to guess which kind of number they're being ranked against.
            </p>
          </>
        )}
      </div>
    </AppLayout>
  )
}
