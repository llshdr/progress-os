'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { rankTierLabel } from '@/lib/rank'

type PublicProfile = {
  user_id: string
  display_name: string
  avatar_url: string | null
  rank: number
}

// Deliberately view-scoped flavor text, not touching RANK_TIER_LABELS
// (rank.ts) - that file's own comment says the plain "Tier I-V" labels
// are chosen specifically to keep rank feeling non-gamified everywhere
// else it's shown (own Profile page, Rank Breakdown). This is the one
// explicitly-casual surface where a bit of personality is the point.
const COMPARE_TIER_FLAVOR: Record<number, string> = {
  1: 'Just Getting Started',
  2: 'Building Momentum',
  3: 'In The Groove',
  4: 'Locked In',
  5: 'Absolute Machine',
}

// Same public_profiles data (name, avatar, rank - nothing else) already
// fetched on the main Profile page, just given its own light, casual
// treatment - ordering by rank is the only "comparison" here, no real
// numbers, no activity data, no streaks. Not meant to feel competitive:
// no "leaderboard"/"standings" language anywhere.
export default function CompareProfilesPage() {
  const [profiles, setProfiles] = useState<PublicProfile[]>([])
  const [ownUserId, setOwnUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchProfiles()
  }, [])

  const fetchProfiles = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    setOwnUserId(user.id)

    const { data, error } = await supabase
      .from('public_profiles')
      .select('user_id, display_name, avatar_url, rank')
      .order('rank', { ascending: false })

    if (error) {
      console.error('Error fetching profiles:', error)
    } else {
      setProfiles(data || [])
    }
    setLoading(false)
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/profile" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-1">
          How&apos;s Everyone Doing?
        </h1>
        <p className="text-lapis-text-tertiary text-sm mb-8">Just for fun - nothing here but names, tiers, and pictures.</p>

        {loading ? (
          <PageSkeleton />
        ) : (
          <div className="space-y-3">
            {profiles.map((profile) => (
              <div
                key={profile.user_id}
                className={`border rounded-lapis-lg p-4 flex items-center gap-3 ${
                  profile.user_id === ownUserId
                    ? 'border-lapis-border-strong bg-lapis-accent-500/[0.05]'
                    : 'border-lapis-border-subtle bg-lapis-surface-1'
                }`}
              >
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    className="w-12 h-12 rounded-full object-cover border border-lapis-border-subtle"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-lapis-surface-2 border border-lapis-border-subtle flex items-center justify-center text-lapis-text-tertiary">
                    {profile.display_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-lapis-text-primary font-medium">
                    {profile.display_name}
                    {profile.user_id === ownUserId && <span className="text-lapis-text-tertiary font-normal"> (you)</span>}
                  </p>
                  <p className="text-lapis-text-tertiary text-sm">
                    {rankTierLabel(profile.rank)} · {COMPARE_TIER_FLAVOR[profile.rank] ?? ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
