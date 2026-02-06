'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import { createClient } from '@/lib/supabase/client'
import { Profile, InviteCode, TournamentSettings } from '@/types/database'
import { format } from 'date-fns'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [settings, setSettings] = useState<TournamentSettings | null>(null)
  const [inviteCodes, setInviteCodes] = useState<(InviteCode & { used_by_profile?: Profile | null })[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError || !profileData) {
        router.push('/')
        return
      }

      const typedProfile = profileData as unknown as Profile
      if (!typedProfile.is_admin) {
        router.push('/')
        return
      }

      setProfile(typedProfile)

      // Load settings
      const { data: settingsData } = await supabase
        .from('tournament_settings')
        .select('*')
        .single()
      setSettings(settingsData as unknown as TournamentSettings | null)

      // Load invite codes
      const { data: codesData } = await supabase
        .from('invite_codes')
        .select('*')
        .order('created_at', { ascending: false })

      const typedCodes = (codesData || []) as unknown as InviteCode[]
      
      // Get used_by profiles
      const usedByIds = typedCodes.filter(c => c.used_by).map(c => c.used_by) as string[]
      const { data: usedByProfiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', usedByIds)

      const typedUsedByProfiles = (usedByProfiles || []) as unknown as Profile[]
      const profileMap = new Map(typedUsedByProfiles.map(p => [p.id, p]))
      setInviteCodes(
        typedCodes.map(c => ({
          ...c,
          used_by_profile: c.used_by ? profileMap.get(c.used_by) : null
        }))
      )

      setLoading(false)
    }

    loadData()
  }, [supabase, router])

  const handleGenerateCode = async () => {
    if (!profile) return
    setGenerating(true)

    const code = generateCode()
    const { data, error } = await supabase
      .from('invite_codes')
      .insert({
        code,
        created_by: profile.id,
      })
      .select()
      .single()

    if (!error && data) {
      setInviteCodes([{ ...data, used_by_profile: null }, ...inviteCodes])
    }

    setGenerating(false)
  }

  const handleUpdateSettings = async (updates: Partial<TournamentSettings>) => {
    const { error } = await supabase
      .from('tournament_settings')
      .update(updates)
      .eq('id', 1)

    if (!error) {
      setSettings(prev => prev ? { ...prev, ...updates } : null)
    }
  }

  const handleGenerateRandomResults = async (stage: 'group' | 'knockout') => {
    const confirmed = confirm(`Generate random ${stage} stage results? This is for testing only.`)
    if (!confirmed) return

    const res = await fetch('/api/admin/generate-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    })

    if (res.ok) {
      alert('Random results generated!')
    } else {
      alert('Failed to generate results')
    }
  }

  const handleResetTournament = async () => {
    const confirmed = confirm('Reset tournament state? This will unlock all predictions.')
    if (!confirmed) return

    await handleUpdateSettings({
      group_stage_locked: false,
      knockout_stage_open: false,
      knockout_stage_locked: false,
    })

    alert('Tournament state reset!')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Header user={profile} />

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>

        {/* Invite Codes */}
        <section className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Invite Codes</h2>
            <button
              onClick={handleGenerateCode}
              disabled={generating}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate New Code'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Code</th>
                  <th className="text-left py-2 px-4">Created</th>
                  <th className="text-left py-2 px-4">Used By</th>
                  <th className="text-left py-2 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {inviteCodes.map(code => (
                  <tr key={code.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 font-mono font-bold">{code.code}</td>
                    <td className="py-2 px-4">
                      {format(new Date(code.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="py-2 px-4">
                      {code.used_by_profile?.display_name || code.used_by_profile?.email || '-'}
                    </td>
                    <td className="py-2 px-4">
                      {code.used_by ? (
                        <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs">
                          Used
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                          Available
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Tournament Controls */}
        <section className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Tournament Controls</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h3 className="font-medium">Group Stage</h3>
                <p className="text-sm text-gray-500">
                  {settings?.group_stage_locked ? 'Locked - predictions visible' : 'Open - accepting predictions'}
                </p>
              </div>
              <button
                onClick={() => handleUpdateSettings({ group_stage_locked: !settings?.group_stage_locked })}
                className={`px-4 py-2 rounded-lg transition ${
                  settings?.group_stage_locked
                    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                {settings?.group_stage_locked ? 'Unlock' : 'Lock Group Stage'}
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h3 className="font-medium">Knockout Stage</h3>
                <p className="text-sm text-gray-500">
                  {settings?.knockout_stage_locked
                    ? 'Locked - predictions visible'
                    : settings?.knockout_stage_open
                    ? 'Open - accepting predictions'
                    : 'Closed - not yet open'}
                </p>
              </div>
              <div className="flex gap-2">
                {!settings?.knockout_stage_open && (
                  <button
                    onClick={() => handleUpdateSettings({ knockout_stage_open: true })}
                    className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                  >
                    Open Knockout
                  </button>
                )}
                {settings?.knockout_stage_open && !settings?.knockout_stage_locked && (
                  <button
                    onClick={() => handleUpdateSettings({ knockout_stage_locked: true })}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                  >
                    Lock Knockout Stage
                  </button>
                )}
                {settings?.knockout_stage_locked && (
                  <button
                    onClick={() => handleUpdateSettings({ knockout_stage_locked: false })}
                    className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"
                  >
                    Unlock
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Testing Tools */}
        <section className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Testing Tools</h2>
          <p className="text-sm text-gray-500 mb-4">
            These tools are for testing purposes only. Use with caution.
          </p>

          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => handleGenerateRandomResults('group')}
              className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
            >
              Generate Random Group Results
            </button>
            <button
              onClick={() => handleGenerateRandomResults('knockout')}
              className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
            >
              Generate Random Knockout Results
            </button>
            <button
              onClick={handleResetTournament}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
            >
              Reset Tournament State
            </button>
          </div>
        </section>
      </main>

      <footer className="bg-gray-800 text-white py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-sm">
          <p>WorldCupProde - Admin Panel</p>
        </div>
      </footer>
    </div>
  )
}
