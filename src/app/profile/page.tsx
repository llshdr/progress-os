'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import { rankTierLabel } from '@/lib/rank'
import { PageSkeleton } from '@/components/ui/page-skeleton'

type PublicProfile = {
  user_id: string
  display_name: string
  avatar_url: string | null
  rank: number
}

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
      checkRankUp(user.id, ownRow.rank)
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

  const checkRankUp = (uid: string, currentRank: number) => {
    const key = `lastSeenRank:${uid}`
    const lastSeen = localStorage.getItem(key)
    const lastSeenRank = lastSeen ? parseInt(lastSeen, 10) : currentRank
    if (currentRank > lastSeenRank) {
      setRankUpTier(currentRank)
    }
    localStorage.setItem(key, String(currentRank))
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

        <h3 className="text-sm font-medium text-lapis-text-tertiary uppercase tracking-wide mb-4">
          Others
        </h3>
        {others.length === 0 ? (
          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-8 text-center text-lapis-text-tertiary">
            No one else here yet
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
