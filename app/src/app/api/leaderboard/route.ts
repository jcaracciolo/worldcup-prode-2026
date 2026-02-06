import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get all profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name')

    if (!profiles) {
      return NextResponse.json({ scores: [] })
    }

    // Get tournament settings
    const { data: settings } = await supabase
      .from('tournament_settings')
      .select('*')
      .single()

    const groupLocked = settings?.group_stage_locked || false
    const knockoutLocked = settings?.knockout_stage_locked || false

    // If nothing is locked, return profiles with 0 points
    if (!groupLocked && !knockoutLocked) {
      return NextResponse.json({
        scores: profiles.map(p => ({
          userId: p.id,
          displayName: p.display_name,
          totalPoints: 0,
          groupStagePoints: 0,
          groupBonusPoints: 0,
          knockoutPoints: 0,
        })),
      })
    }

    // TODO: Implement full scoring calculation
    // For now, return placeholder scores
    const scores = profiles.map(p => ({
      userId: p.id,
      displayName: p.display_name,
      totalPoints: Math.floor(Math.random() * 100), // Placeholder
      groupStagePoints: 0,
      groupBonusPoints: 0,
      knockoutPoints: 0,
    }))

    // Sort by total points
    scores.sort((a, b) => b.totalPoints - a.totalPoints)

    return NextResponse.json({ scores })
  } catch (error) {
    console.error('Error calculating leaderboard:', error)
    return NextResponse.json({ error: 'Failed to calculate leaderboard', scores: [] }, { status: 500 })
  }
}
