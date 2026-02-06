import Header from '@/components/Header'
import { createClient } from '@/lib/supabase/server'
import { getMatch } from '@/lib/football-api'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ matchId: string }>
}

export default async function MatchDetailPage({ params }: PageProps) {
  const { matchId } = await params
  const supabase = await createClient()

  // Get current user
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

  // Get match
  const match = await getMatch(parseInt(matchId))
  if (!match) {
    notFound()
  }

  // Get user's prediction for this match
  let prediction = null
  if (user) {
    const { data } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.id)
      .eq('match_id', matchId)
      .single()
    prediction = data
  }

  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED'
  const isFinished = match.status === 'FINISHED'
  const matchDate = new Date(match.utcDate)

  // Calculate points for this match
  let pointsEarned = 0
  const pointsBreakdown: string[] = []

  if (isFinished && prediction && prediction.home_goals !== null && prediction.away_goals !== null) {
    const actualHome = match.score.fullTime.home
    const actualAway = match.score.fullTime.away

    if (actualHome !== null && actualAway !== null) {
      const predictedResult = prediction.home_goals > prediction.away_goals ? 'home' :
        prediction.away_goals > prediction.home_goals ? 'away' : 'draw'
      const actualResult = actualHome > actualAway ? 'home' :
        actualAway > actualHome ? 'away' : 'draw'

      if (predictedResult === actualResult) {
        pointsEarned += 2
        pointsBreakdown.push(`+2 Correct result (${actualResult === 'home' ? match.homeTeam.tla + ' win' : actualResult === 'away' ? match.awayTeam.tla + ' win' : 'Draw'})`)
      }

      if (prediction.home_goals === actualHome) {
        pointsEarned += 1
        pointsBreakdown.push(`+1 Correct ${match.homeTeam.tla} goals (${actualHome})`)
      }

      if (prediction.away_goals === actualAway) {
        pointsEarned += 1
        pointsBreakdown.push(`+1 Correct ${match.awayTeam.tla} goals (${actualAway})`)
      }
    }
  }

  return (
    <div className="min-h-screen">
      <Header user={profile} />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Match Header */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-green-700 to-green-600 text-white p-6">
              <div className="flex items-center justify-center gap-8">
                {/* Home Team */}
                <div className="text-center">
                  {match.homeTeam.crest && (
                    <img
                      src={match.homeTeam.crest}
                      alt={match.homeTeam.name}
                      className="w-16 h-16 mx-auto object-contain mb-2"
                    />
                  )}
                  <div className="font-bold text-lg">{match.homeTeam.name}</div>
                </div>

                {/* Score */}
                <div className="text-center">
                  {isFinished || isLive ? (
                    <div className="text-5xl font-bold">
                      {match.score.fullTime.home} - {match.score.fullTime.away}
                    </div>
                  ) : (
                    <div className="text-3xl font-bold">vs</div>
                  )}
                  <div className="mt-2">
                    {isLive ? (
                      <span className="px-3 py-1 bg-red-500 rounded animate-pulse text-sm">
                        LIVE
                      </span>
                    ) : isFinished ? (
                      <span className="px-3 py-1 bg-gray-600 rounded text-sm">
                        FULL TIME
                      </span>
                    ) : (
                      <span className="text-green-200">
                        {format(matchDate, 'HH:mm')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Away Team */}
                <div className="text-center">
                  {match.awayTeam.crest && (
                    <img
                      src={match.awayTeam.crest}
                      alt={match.awayTeam.name}
                      className="w-16 h-16 mx-auto object-contain mb-2"
                    />
                  )}
                  <div className="font-bold text-lg">{match.awayTeam.name}</div>
                </div>
              </div>
            </div>

            {/* Match Info */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-gray-600">
                <span>📅</span>
                <span>{format(matchDate, 'EEEE, MMMM d, yyyy - h:mm a')}</span>
              </div>
              
              {match.venue && (
                <div className="flex items-center gap-2 text-gray-600">
                  <span>📍</span>
                  <span>{match.venue}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-gray-600">
                <span>🏆</span>
                <span>{match.group || match.stage.replace(/_/g, ' ')} - Matchday {match.matchday}</span>
              </div>
            </div>

            {/* User's Prediction & Points */}
            {user && prediction && (
              <div className="border-t p-6">
                <h3 className="font-bold text-lg mb-4">Your Prediction</h3>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-center gap-4 text-xl font-bold mb-4">
                    <span>{match.homeTeam.tla}</span>
                    <span className="px-4 py-2 bg-white rounded shadow">
                      {prediction.home_goals ?? '-'} - {prediction.away_goals ?? '-'}
                    </span>
                    <span>{match.awayTeam.tla}</span>
                  </div>

                  {isFinished && (
                    <div className="border-t pt-4 mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">Points Earned</span>
                        <span className="text-2xl font-bold text-green-600">
                          {pointsEarned} / 4
                        </span>
                      </div>
                      {pointsBreakdown.length > 0 ? (
                        <ul className="text-sm text-gray-600 space-y-1">
                          {pointsBreakdown.map((item, i) => (
                            <li key={i} className="text-green-600">{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500">No points earned from this match</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!user && (
              <div className="border-t p-6 text-center text-gray-500">
                <a href="/login" className="text-green-600 hover:underline">
                  Log in
                </a>{' '}
                to see your prediction for this match
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-gray-800 text-white py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-sm">
          <p>WorldCupProde - FIFA World Cup 2026 Predictions</p>
        </div>
      </footer>
    </div>
  )
}
