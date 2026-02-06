'use client'

import { UserScore } from '@/types/football'
import Link from 'next/link'

interface LeaderboardProps {
  scores: UserScore[]
  currentUserId?: string
}

export default function Leaderboard({ scores, currentUserId }: LeaderboardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="bg-gradient-to-r from-green-700 to-green-600 text-white px-4 py-3">
        <h2 className="text-lg font-bold">🏆 Leaderboard</h2>
      </div>
      
      <div className="divide-y">
        {scores.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No predictions yet
          </div>
        ) : (
          scores.map((score, index) => {
            const isCurrentUser = score.userId === currentUserId
            const position = index + 1
            
            let positionBadge = ''
            if (position === 1) positionBadge = '🥇'
            else if (position === 2) positionBadge = '🥈'
            else if (position === 3) positionBadge = '🥉'

            return (
              <Link
                key={score.userId}
                href={`/user/${score.userId}`}
                className={`flex items-center px-4 py-3 hover:bg-gray-50 transition ${
                  isCurrentUser ? 'bg-green-50' : ''
                }`}
              >
                <div className="w-8 text-center font-bold text-gray-600">
                  {positionBadge || position}
                </div>
                <div className="flex-1 ml-3">
                  <span className={`font-medium ${isCurrentUser ? 'text-green-700' : ''}`}>
                    {score.displayName}
                  </span>
                  {isCurrentUser && (
                    <span className="ml-2 text-xs text-green-600">(you)</span>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">{score.totalPoints}</div>
                  <div className="text-xs text-gray-500">points</div>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
