import Header from '@/components/Header'
import MatchCard from '@/components/MatchCard'
import Leaderboard from '@/components/Leaderboard'
import { createClient } from '@/lib/supabase/server'
import { getTodaysMatches } from '@/lib/football-api'
import { UserScore } from '@/types/football'

export const dynamic = 'force-dynamic'

async function getLeaderboard(): Promise<UserScore[]> {
  const supabase = await createClient()
  
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
  
  if (!profiles) return []

  // For now, return profiles with 0 points
  // Full scoring calculation would be done here
  return profiles.map(profile => ({
    userId: profile.id,
    displayName: profile.display_name,
    totalPoints: 0,
    groupStagePoints: 0,
    groupBonusPoints: 0,
    knockoutPoints: 0,
  }))
}

export default async function HomePage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    profile = data
  }

  let matches: Awaited<ReturnType<typeof getTodaysMatches>> = []
  try {
    matches = await getTodaysMatches()
  } catch (error) {
    console.error('Failed to fetch matches:', error)
  }

  const leaderboard = await getLeaderboard()

  return (
    <div className="min-h-screen">
      <Header user={profile} />

      <main className="container mx-auto px-4 py-8">
        {/* Today's Matches */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">
            {matches.length > 0 ? "Today's Matches" : 'Upcoming Matches'}
          </h2>
          
          {matches.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
              <p className="text-lg">No matches scheduled</p>
              <p className="text-sm mt-2">Check back when the World Cup begins!</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {matches.map(match => (
                <MatchCard key={match.id} match={match} showDate />
              ))}
            </div>
          )}
        </section>

        {/* Leaderboard */}
        <section>
          <Leaderboard scores={leaderboard} currentUserId={user?.id} />
        </section>
      </main>

      <footer className="bg-gray-800 text-white py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-sm">
          <p>WorldCupProde - FIFA World Cup 2026 Predictions</p>
          <p className="text-gray-400 mt-1">Not a real betting application</p>
        </div>
      </footer>
    </div>
  )
}
