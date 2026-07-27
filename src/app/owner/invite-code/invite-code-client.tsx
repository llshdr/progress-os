'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import Link from 'next/link'

type InviteCode = {
  id: string
  code: string
  updated_at: string
} | null

function generateCode() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
}

// The exact seed value migration 038 inserts before the owner ever rotates
// it - a real, working signup credential that also sits in plain text in a
// version-controlled migration file, so it's worth nudging the owner to
// replace it rather than leaving it silently in place.
const UNROTATED_SEED_CODE = 'changeme-rotate-me'

export default function InviteCodeClient({ inviteCode }: { inviteCode: InviteCode }) {
  const [code, setCode] = useState(inviteCode?.code ?? '')
  const [updatedAt, setUpdatedAt] = useState(inviteCode?.updated_at ?? null)
  const [showRotateModal, setShowRotateModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const supabase = createClient()

  const handleRotate = async () => {
    if (!inviteCode) return
    const newCode = generateCode()

    const { error } = await supabase
      .from('invite_codes')
      .update({ code: newCode, updated_at: new Date().toISOString() })
      .eq('id', inviteCode.id)

    if (error) {
      console.error('Error rotating invite code:', error)
    } else {
      setCode(newCode)
      setUpdatedAt(new Date().toISOString())
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/settings" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
            Invite Code
          </h1>
          <p className="text-white/50 text-sm">
            Share this code with anyone you want to be able to create an account.
            Rotating it invalidates the old code immediately.
          </p>
        </div>

        {code === UNROTATED_SEED_CODE && (
          <div className="border border-white/20 rounded-2xl bg-white/[0.04] p-4 mb-6">
            <p className="text-white text-sm font-medium mb-1">Still on the default code</p>
            <p className="text-white/50 text-xs">
              This is the placeholder code from setup, visible in the project&apos;s migration history.
              Generate a real code below before sharing signup with anyone.
            </p>
          </div>
        )}

        <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
          <p className="text-white/40 text-xs mb-2">Current code</p>
          <p className="text-2xl font-mono tracking-wider text-white mb-4">{code}</p>
          {updatedAt && (
            <p className="text-white/30 text-xs mb-6">
              Last rotated {new Date(updatedAt).toLocaleString()}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              onClick={handleCopy}
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5"
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              onClick={() => setShowRotateModal(true)}
              className="bg-white text-black hover:bg-white/90"
            >
              Generate new code
            </Button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        open={showRotateModal}
        onOpenChange={setShowRotateModal}
        title="Generate new invite code?"
        description="The current code will stop working immediately. Anyone who hasn't signed up yet will need the new code."
        confirmText="Generate"
        cancelText="Cancel"
        onConfirm={handleRotate}
      />
    </AppLayout>
  )
}
