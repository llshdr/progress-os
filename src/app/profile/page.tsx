'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import { rankTierLabel, computeRankBreakdown, type RankBreakdown, type ModuleName } from '@/lib/rank'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { Users } from 'lucide-react'

type PublicProfile = {
  user_id: string
  display_name: string
  avatar_url: string | null
  rank: number
}

const MODULE_LABEL: Record<ModuleName, string> = { goals: 'Goals', gym: 'Gym', nutrition: 'Nutrition' }

// Downscale/compress client-side before upload - keeps avatar files small
// without needing any server-side image processing.
function resizeImageFile(file: File, maxSize = 512): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Canvas not supported'))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url)
          if (blob) resolve(blob)
          else reject(new Error('Failed to encode image'))
        },
        'image/jpeg',
        0.85
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [own, setOwn] = useState<PublicProfile | null>(null)
  const [others, setOthers] = useState<PublicProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [rankUpTier, setRankUpTier] = useState<number | null>(null)
  const [breakdown, setBreakdown] = useState<RankBreakdown | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    setUserId(user.id)

    const { data: ownRow, error: ownError } = await supabase
      .from('public_profiles')
      .select('user_id, display_name, avatar_url, rank')
      .eq('user_id', user.id)
      .maybeSingle()

    if (ownError) {
      console.error('Error fetching own profile:', ownError)
    } else if (ownRow) {
      setOwn(ownRow)
      await checkRankUp(user.id, ownRow.rank)
      await fetchBreakdown(user.id)
    }

    const { data: othersRows, error: othersError } = await supabase
      .from('public_profiles')
      .select('user_id, display_name, avatar_url, rank')
      .neq('user_id', user.id)

    if (othersError) {
      console.error('Error fetching other profiles:', othersError)
    } else {
      setOthers(othersRows || [])
    }

    setLoading(false)
  }

  // Persisted server-side (user_settings.last_seen_rank, migration 066)
  // instead of the old browser-localStorage-only marker - survives across
  // devices/browsers instead of re-firing depending on which one last saw it.
  const checkRankUp = async (uid: string, currentRank: number) => {
    const { data } = await supabase.from('user_settings').select('last_seen_rank').eq('user_id', uid).maybeSingle()
    const lastSeenRank = data?.last_seen_rank ?? currentRank
    if (currentRank > lastSeenRank) {
      setRankUpTier(currentRank)
    }
    await supabase.from('user_settings').upsert({ user_id: uid, last_seen_rank: currentRank }, { onConflict: 'user_id' })
  }

  // Client-side mirror of recompute_user_rank (see rank.ts's own caveat on
  // why this is an estimate, not a guaranteed byte-exact one) - so "why is
  // my rank what it is" has a real answer instead of just a bare tier
  // label. Same 90-day-window raw data the SQL function itself reads from,
  // just fetched here instead of computed server-side.
  const fetchBreakdown = async (uid: string) => {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const cutoff = ninetyDaysAgo.toISOString().slice(0, 10)

    const [{ data: goalRows }, { data: workoutRows }, { data: nutritionRows }] = await Promise.all([
      supabase.from('goals').select('created_at, updated_at, status, scope').eq('user_id', uid),
      supabase.from('workouts').select('completed_at').eq('user_id', uid).not('completed_at', 'is', null).gte('completed_at', ninetyDaysAgo.toISOString()),
      supabase.from('nutrition_entries').select('date').eq('user_id', uid).gte('date', cutoff),
    ])

    setBreakdown(
      computeRankBreakdown(
        (goalRows ?? []).map((g) => ({ createdAt: g.created_at, updatedAt: g.updated_at, status: g.status, scope: g.scope })),
        (workoutRows ?? []).map((w) => w.completed_at as string),
        (nutritionRows ?? []).map((n) => n.date as string)
      )
    )
  }

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return

    setUploading(true)
    try {
      const resized = await resizeImageFile(file)
      const path = `${userId}/${Date.now()}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, resized, { contentType: 'image/jpeg', upsert: true })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path)

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({ id: userId, avatar_url: publicUrlData.publicUrl }, { onConflict: 'id' })

      if (updateError) throw updateError

      await fetchProfile()
    } catch (error) {
      console.error('Error uploading avatar:', error)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <PageSkeleton />
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-2">Profile</h1>
          <p className="text-lapis-text-tertiary text-sm">Your rank and the people you're sharing progress with</p>
        </div>

        {rankUpTier !== null && (
          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-2 p-4 mb-6 text-center">
            <p className="text-lapis-text-primary text-sm font-medium">
              You've reached {rankTierLabel(rankUpTier)}
            </p>
          </div>
        )}

        {own && (
          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="relative">
                {own.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={own.avatar_url}
                    alt={own.display_name}
                    className="w-20 h-20 rounded-full object-cover border border-lapis-border-subtle"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-lapis-surface-2 border border-lapis-border-subtle flex items-center justify-center text-lapis-text-tertiary text-2xl">
                    {own.display_name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-medium text-lapis-text-primary">{own.display_name}</h2>
                <p className="text-lapis-text-tertiary text-sm">{rankTierLabel(own.rank)}</p>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarSelect}
                  className="hidden"
                  id="avatar-upload"
                />
                <Button
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2"
                >
                  {uploading ? 'Uploading...' : 'Change photo'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {breakdown && (
          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 mb-8">
            <h3 className="text-sm font-medium text-lapis-text-tertiary uppercase tracking-wide mb-3">Rank Breakdown</h3>
            <p className="text-lapis-text-secondary text-sm mb-4">
              Currently driven by your {MODULE_LABEL[breakdown.drivingModule]} activity
              {breakdown.activeModules >= 2 && ', plus a +1 bonus for staying active across multiple modules'}.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="border border-lapis-border-subtle rounded-lapis-md p-4">
                <p className="text-xs text-lapis-text-tertiary mb-1">Goals</p>
                <p className="text-lapis-text-primary font-medium mb-1">{rankTierLabel(breakdown.goals.tier)}</p>
                <p className="text-lapis-text-tertiary text-xs">
                  {breakdown.goals.doneCount} done
                  {breakdown.goals.completionRate != null && `, ${Math.round(breakdown.goals.completionRate * 100)}% completion rate`}
                </p>
                {breakdown.goals.capTier < 5 && (
                  <p className="text-lapis-text-disabled text-xs mt-1">
                    Capped at {rankTierLabel(breakdown.goals.capTier)} until you have an active or done {breakdown.goals.capTier < 4 ? 'Milestone' : 'Long-term'}-scope goal
                  </p>
                )}
              </div>
              <div className="border border-lapis-border-subtle rounded-lapis-md p-4">
                <p className="text-xs text-lapis-text-tertiary mb-1">Gym</p>
                <p className="text-lapis-text-primary font-medium mb-1">{rankTierLabel(breakdown.gym.tier)}</p>
                <p className="text-lapis-text-tertiary text-xs">{breakdown.gym.consistencyWeeks} consistency weeks (last 90 days)</p>
                {breakdown.gym.nextTierWeeksNeeded != null && (
                  <p className="text-lapis-text-disabled text-xs mt-1">{breakdown.gym.nextTierWeeksNeeded} more to the next tier</p>
                )}
              </div>
              <div className="border border-lapis-border-subtle rounded-lapis-md p-4">
                <p className="text-xs text-lapis-text-tertiary mb-1">Nutrition</p>
                <p className="text-lapis-text-primary font-medium mb-1">{rankTierLabel(breakdown.nutrition.tier)}</p>
                <p className="text-lapis-text-tertiary text-xs">{breakdown.nutrition.consistencyWeeks} consistency weeks (last 90 days)</p>
                {breakdown.nutrition.nextTierWeeksNeeded != null && (
                  <p className="text-lapis-text-disabled text-xs mt-1">{breakdown.nutrition.nextTierWeeksNeeded} more to the next tier</p>
                )}
              </div>
            </div>
            <p className="text-lapis-text-disabled text-xs mt-4">
              An estimate that mirrors the same math your rank is actually computed from - not guaranteed to match exactly right at a week boundary.
            </p>
          </div>
        )}

        <h3 className="text-sm font-medium text-lapis-text-tertiary uppercase tracking-wide mb-4">
          Others
        </h3>
        {others.length === 0 ? (
          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-8 text-center">
            <Users className="w-8 h-8 text-lapis-text-disabled mx-auto mb-3" />
            <p className="text-lapis-text-tertiary">No one else here yet</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {others.map((profile) => (
              <div
                key={profile.user_id}
                className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-4 flex items-center gap-3"
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
                  <p className="text-lapis-text-primary font-medium">{profile.display_name}</p>
                  <p className="text-lapis-text-tertiary text-sm">{rankTierLabel(profile.rank)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
