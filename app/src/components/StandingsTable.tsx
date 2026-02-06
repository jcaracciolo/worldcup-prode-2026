'use client'

import { CalculatedStanding } from '@/types/football'

interface StandingsTableProps {
  standings: CalculatedStanding[]
  onSwapPositions?: (teamId1: number, teamId2: number) => void
  disabled?: boolean
  highlightAdvancing?: number // How many teams advance
}

export default function StandingsTable({
  standings,
  onSwapPositions,
  disabled = false,
  highlightAdvancing = 3,
}: StandingsTableProps) {
  // Find teams with same points that can be swapped
  const canSwap = (index: number): boolean => {
    if (disabled || !onSwapPositions) return false
    if (index === 0) return false
    return standings[index].points === standings[index - 1].points
  }

  const handleSwap = (index: number) => {
    if (!onSwapPositions || index === 0) return
    onSwapPositions(standings[index - 1].team.id, standings[index].team.id)
  }

  return (
    <div className="bg-gray-50 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-200 text-gray-600">
            <th className="px-2 py-1 text-left">#</th>
            <th className="px-2 py-1 text-left">Team</th>
            <th className="px-2 py-1 text-center">P</th>
            <th className="px-2 py-1 text-center">W</th>
            <th className="px-2 py-1 text-center">D</th>
            <th className="px-2 py-1 text-center">L</th>
            <th className="px-2 py-1 text-center">GD</th>
            <th className="px-2 py-1 text-center font-bold">Pts</th>
            {onSwapPositions && !disabled && <th className="px-2 py-1"></th>}
          </tr>
        </thead>
        <tbody>
          {standings.map((standing, index) => {
            const advances = index < highlightAdvancing
            return (
              <tr
                key={standing.team.id}
                className={`border-b border-gray-200 ${
                  advances ? 'bg-green-50' : ''
                }`}
              >
                <td className="px-2 py-1.5 font-medium">{index + 1}</td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1">
                    {standing.team.crest && (
                      <img
                        src={standing.team.crest}
                        alt={standing.team.name}
                        className="w-4 h-4 object-contain"
                      />
                    )}
                    <span className="truncate">{standing.team.tla}</span>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-center">{standing.played}</td>
                <td className="px-2 py-1.5 text-center">{standing.won}</td>
                <td className="px-2 py-1.5 text-center">{standing.drawn}</td>
                <td className="px-2 py-1.5 text-center">{standing.lost}</td>
                <td className="px-2 py-1.5 text-center">
                  {standing.goalDifference > 0 ? '+' : ''}
                  {standing.goalDifference}
                </td>
                <td className="px-2 py-1.5 text-center font-bold">
                  {standing.points}
                </td>
                {onSwapPositions && !disabled && (
                  <td className="px-2 py-1.5 text-center">
                    {canSwap(index) && (
                      <button
                        type="button"
                        onClick={() => handleSwap(index)}
                        className="text-blue-500 hover:text-blue-700 text-lg"
                        title="Swap with team above"
                      >
                        ↕
                      </button>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
