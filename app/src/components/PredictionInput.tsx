'use client'

import { Match } from '@/types/football'
import { Prediction } from '@/types/database'

interface PredictionInputProps {
  match: Match
  prediction?: Prediction
  onChange: (matchId: number, homeGoals: number | null, awayGoals: number | null, winnerId?: number | null) => void
  disabled?: boolean
  showWinnerSelect?: boolean
}

export default function PredictionInput({
  match,
  prediction,
  onChange,
  disabled = false,
  showWinnerSelect = false,
}: PredictionInputProps) {
  const homeGoals = prediction?.home_goals ?? null
  const awayGoals = prediction?.away_goals ?? null
  const winnerId = prediction?.winner_id ?? null

  const handleHomeChange = (value: string) => {
    const goals = value === '' ? null : parseInt(value, 10)
    if (goals !== null && (isNaN(goals) || goals < 0)) return
    onChange(match.id, goals, awayGoals, winnerId)
  }

  const handleAwayChange = (value: string) => {
    const goals = value === '' ? null : parseInt(value, 10)
    if (goals !== null && (isNaN(goals) || goals < 0)) return
    onChange(match.id, homeGoals, goals, winnerId)
  }

  const handleWinnerChange = (teamId: number) => {
    onChange(match.id, homeGoals, awayGoals, teamId)
  }

  const isTie = homeGoals !== null && awayGoals !== null && homeGoals === awayGoals
  const needsWinnerSelect = showWinnerSelect && isTie

  return (
    <div className="flex items-center gap-2 py-2">
      {/* Home Team */}
      <div className="flex-1 flex items-center justify-end gap-2">
        <span className="text-sm font-medium truncate">{match.homeTeam.tla}</span>
        {match.homeTeam.crest && (
          <img
            src={match.homeTeam.crest}
            alt={match.homeTeam.name}
            className="w-6 h-6 object-contain"
          />
        )}
      </div>

      {/* Score Inputs */}
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="0"
          max="20"
          value={homeGoals ?? ''}
          onChange={(e) => handleHomeChange(e.target.value)}
          disabled={disabled}
          className="w-12 h-10 text-center text-lg font-bold border rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:text-gray-500"
          placeholder="-"
        />
        <span className="text-gray-400">-</span>
        <input
          type="number"
          min="0"
          max="20"
          value={awayGoals ?? ''}
          onChange={(e) => handleAwayChange(e.target.value)}
          disabled={disabled}
          className="w-12 h-10 text-center text-lg font-bold border rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:text-gray-500"
          placeholder="-"
        />
      </div>

      {/* Away Team */}
      <div className="flex-1 flex items-center gap-2">
        {match.awayTeam.crest && (
          <img
            src={match.awayTeam.crest}
            alt={match.awayTeam.name}
            className="w-6 h-6 object-contain"
          />
        )}
        <span className="text-sm font-medium truncate">{match.awayTeam.tla}</span>
      </div>

      {/* Winner Select (for knockout ties) */}
      {needsWinnerSelect && (
        <div className="flex gap-1 ml-2">
          <button
            type="button"
            onClick={() => handleWinnerChange(match.homeTeam.id)}
            disabled={disabled}
            className={`px-2 py-1 text-xs rounded transition ${
              winnerId === match.homeTeam.id
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300'
            } disabled:opacity-50`}
          >
            {match.homeTeam.tla} wins
          </button>
          <button
            type="button"
            onClick={() => handleWinnerChange(match.awayTeam.id)}
            disabled={disabled}
            className={`px-2 py-1 text-xs rounded transition ${
              winnerId === match.awayTeam.id
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300'
            } disabled:opacity-50`}
          >
            {match.awayTeam.tla} wins
          </button>
        </div>
      )}
    </div>
  )
}
