'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { LoadErrorBanner } from '@/components/ui/load-error-banner'

export default function AccountSettingsPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchAccount()
  }, [])

  const fetchAccount = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    setEmail(user.email ?? '')

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Error fetching profile:', error)
      setLoadError(true)
    }
    setDisplayName(profile?.full_name ?? '')
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setSaving(true)
    setSaved(false)
    setNameError(null)

    const trimmedName = displayName.trim()

    if (trimmedName) {
      // Case-insensitive uniqueness check. A DB-level UNIQUE constraint would
      // be safer long-term, but can't be added blindly without first
      // confirming no duplicates already exist in the live data - not
      // something checkable from here, so this is the safe default for now.
      const { data: existing, error: lookupError } = await supabase
        .from('profiles')
        .select('id')
        .neq('id', user.id)
        .ilike('full_name', trimmedName)
        .maybeSingle()

      if (lookupError) {
        console.error('Error checking display name uniqueness:', lookupError)
      } else if (existing) {
        setNameError('This name is already taken. Try another.')
        setSaving(false)
        return
      }
    }

    const { error } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        full_name: trimmedName || null,
      },
      { onConflict: 'id' }
    )

    setSaving(false)
    if (!error) {
      setSaved(true)
    } else {
      console.error('Error saving account settings:', error)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/settings" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 block">
          ← Back to Settings
        </Link>

        <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-8">Account</h1>

        {loadError && <LoadErrorBanner message="Couldn't load your account details. Try refreshing." />}

        <div className="max-w-md">
          {loading ? (
            <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
              <div className="h-10 bg-lapis-surface-2 rounded-lapis-sm animate-pulse" />
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="display-name" className="text-lapis-text-secondary">
                    Display name
                  </Label>
                  <Input
                    id="display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value)
                      setSaved(false)
                      setNameError(null)
                    }}
                    placeholder="Your name"
                    className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
                  />
                  {nameError ? (
                    <p className="text-lapis-garnet text-xs">{nameError}</p>
                  ) : (
                    <p className="text-lapis-text-tertiary text-xs">
                      Shown in your dashboard greeting. Falls back to your email prefix if left blank.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-lapis-text-secondary">Email</Label>
                  <p className="text-lapis-text-tertiary text-sm">{email}</p>
                </div>
                <div className="border-t border-lapis-border-subtle pt-4">
                  <Link
                    href="/profile"
                    className="flex items-center justify-between text-sm text-lapis-text-secondary hover:text-lapis-text-primary transition-colors"
                  >
                    <span>View your rank &amp; public profile</span>
                    <span className="text-lapis-text-disabled">→</span>
                  </Link>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={saving} className="bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110">
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                {saved && <span className="text-lapis-text-tertiary text-sm">Saved</span>}
              </div>
            </form>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
