'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { signInAction, signUpAction } from './actions'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isSignUp) {
        const { data: codeValid, error: codeError } = await supabase.rpc(
          'check_invite_code',
          { input: inviteCode }
        )
        if (codeError) throw codeError
        if (!codeValid) {
          setError('Invalid invite code')
          return
        }

        const { error: signUpError } = await signUpAction(email, password, inviteCode)
        if (signUpError) {
          console.error('Auth error:', signUpError)
          setError('Signup failed — check your invite code')
          return
        }
      } else {
        const { error: signInError } = await signInAction(email, password)
        if (signInError) throw new Error(signInError)
      }
      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('Auth error:', error)
      setError('Something went wrong — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-lapis-bg p-4">
      <div className="w-full max-w-md border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-8">
        <div className="space-y-1 mb-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-lapis-text-primary">
            {isSignUp ? 'Create account' : 'Welcome back'}
          </h1>
          <p className="text-lapis-text-tertiary text-sm">
            {isSignUp
              ? 'Enter your details to get started'
              : 'Enter your credentials to access your account'}
          </p>
        </div>
        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-lapis-text-secondary">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-lapis-text-secondary">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
            />
          </div>
          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="inviteCode" className="text-lapis-text-secondary">
                Invite code
              </Label>
              <Input
                id="inviteCode"
                type="text"
                placeholder="Enter your invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
              />
            </div>
          )}
          {error && (
            <p className="text-sm text-lapis-garnet">{error}</p>
          )}
          <Button
            type="submit"
            className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110"
            disabled={loading}
          >
            {loading ? 'Loading...' : isSignUp ? 'Sign up' : 'Sign in'}
          </Button>
        </form>
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError(null)
            }}
            className="text-sm text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors"
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  )
}
