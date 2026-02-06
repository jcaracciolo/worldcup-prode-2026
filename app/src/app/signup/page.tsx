'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const codeFromUrl = searchParams.get('code') || ''

  const [inviteCode, setInviteCode] = useState(codeFromUrl)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [codeValid, setCodeValid] = useState<boolean | null>(null)

  useEffect(() => {
    setInviteCode(codeFromUrl)
  }, [codeFromUrl])

  useEffect(() => {
    const checkCode = async () => {
      if (inviteCode.length < 6) {
        setCodeValid(null)
        return
      }

      const supabase = createClient()
      const { data } = await supabase
        .from('invite_codes')
        .select('id')
        .eq('code', inviteCode)
        .is('used_by', null)
        .single()

      setCodeValid(!!data)
    }

    checkCode()
  }, [inviteCode])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!codeValid) {
      setError('Invalid or already used invite code')
      setLoading(false)
      return
    }

    const supabase = createClient()

    // Sign up the user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (!authData.user) {
      setError('Failed to create account')
      setLoading(false)
      return
    }

    // Mark invite code as used
    const { error: codeError } = await supabase
      .from('invite_codes')
      .update({
        used_by: authData.user.id,
        used_at: new Date().toISOString(),
      })
      .eq('code', inviteCode)
      .is('used_by', null)

    if (codeError) {
      console.error('Failed to mark invite code as used:', codeError)
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <span className="text-5xl">⚽</span>
          <h1 className="text-2xl font-bold mt-4 text-gray-800">Join WorldCupProde</h1>
          <p className="text-gray-500 mt-2">Create your account</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700 mb-1">
              Invite Code
            </label>
            <div className="relative">
              <input
                type="text"
                id="inviteCode"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                  codeValid === true
                    ? 'border-green-500 bg-green-50'
                    : codeValid === false
                    ? 'border-red-500 bg-red-50'
                    : ''
                }`}
                placeholder="Enter your invite code"
                required
              />
              {codeValid !== null && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {codeValid ? '✓' : '✗'}
                </span>
              )}
            </div>
            {codeValid === false && (
              <p className="text-red-500 text-xs mt-1">Invalid or already used code</p>
            )}
          </div>

          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="How others will see you"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !codeValid}
            className="w-full py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center mt-6 text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-green-600 hover:underline font-medium">
            Sign in
          </Link>
        </p>

        <Link
          href="/"
          className="block text-center mt-4 text-gray-500 hover:text-gray-700 text-sm"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-600 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  )
}
