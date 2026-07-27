'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { invite_code: inviteCode } },
        })
        if (signUpError) {
          setError('Signup failed — check your invite code')
          return
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
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
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-md border border-white/10 rounded-2xl bg-white/[0.02] p-8">
        <div className="space-y-1 mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {isSignUp ? 'Create account' : 'Welcome back'}
          </h1>
          <p className="text-white/50 text-sm">
            {isSignUp
              ? 'Enter your details to get started'
              : 'Enter your credentials to access your account'}
          </p>
        </div>
        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/80">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-white/80">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>
          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="inviteCode" className="text-white/80">
                Invite code
              </Label>
              <Input
                id="inviteCode"
                type="text"
                placeholder="Enter your invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
          )}
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          <Button
            type="submit"
            className="w-full bg-white text-black hover:bg-white/90"
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
            className="text-sm text-white/40 hover:text-white/60 transition-colors"
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
