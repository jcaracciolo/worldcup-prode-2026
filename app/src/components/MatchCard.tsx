'use client'

import { Match } from '@/types/football'
import { format } from 'date-fns'
import Link from 'next/link'

interface MatchCardProps {
  match: Match
  showDate?: boolean
}

export default function MatchCard({ match, showDate = false }: MatchCardProps) {
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED'
  const isFinished = match.status === 'FINISHED'
  const matchDate = new Date(match.utcDate)

  const getStatusBadge = () => {
    if (isLive) {
      return (
        <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded animate-pulse">
          LIVE
        </span>
      )
    }
    if (isFinished) {
      return (
        <span className="px-2 py-1 bg-gray-500 text-white text-xs font-bold rounded">
          FT
        </span>
      )
    }
    return (
      <span className="text-gray-500 text-sm">
        {format(matchDate, 'HH:mm')}
      </span>
    )
  }

  return (
    <Link href={`/match/${match.id}`}>
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-4 cursor-pointer border border-gray-100">
        {showDate && (
          <div className="text-center text-sm text-gray-500 mb-2">
            {format(matchDate, 'EEEE, MMM d, yyyy')}
          </div>
        )}
        
        <div className="flex items-center justify-between">
          {/* Home Team */}
          <div className="flex-1 flex items-center justify-end gap-2">
            <span className="font-medium text-right">{match.homeTeam.shortName}</span>
            {match.homeTeam.crest && (
              <img
                src={match.homeTeam.crest}
                alt={match.homeTeam.name}
                className="w-8 h-8 object-contain"
              />
            )}
          </div>

          {/* Score */}
          <div className="mx-4 flex flex-col items-center min-w-[80px]">
            {isFinished || isLive ? (
              <div className="text-2xl font-bold">
                {match.score.fullTime.home} - {match.score.fullTime.away}
              </div>
            ) : (
              <div className="text-2xl font-bold text-gray-300">vs</div>
            )}
            {getStatusBadge()}
          </div>

          {/* Away Team */}
          <div className="flex-1 flex items-center gap-2">
            {match.awayTeam.crest && (
              <img
                src={match.awayTeam.crest}
                alt={match.awayTeam.name}
                className="w-8 h-8 object-contain"
              />
            )}
            <span className="font-medium">{match.awayTeam.shortName}</span>
          </div>
        </div>

        {/* Group/Stage info */}
        <div className="text-center text-xs text-gray-400 mt-2">
          {match.group || match.stage.replace(/_/g, ' ')}
        </div>
      </div>
    </Link>
  )
}
