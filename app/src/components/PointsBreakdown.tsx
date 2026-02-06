'use client'

import { PointBreakdown } from '@/types/football'

interface PointsBreakdownProps {
  breakdown: PointBreakdown[]
  totalPoints: number
}

export default function PointsBreakdown({ breakdown, totalPoints }: PointsBreakdownProps) {
  const getTypeIcon = (type: PointBreakdown['type']) => {
    switch (type) {
      case 'result':
        return '✓'
      case 'goals_home':
      case 'goals_away':
        return '⚽'
      case 'group_advance':
        return '📈'
      case 'group_position':
        return '🎯'
      case 'knockout_win':
        return '🏆'
      case 'knockout_lose':
      case 'knockout_tie':
        return '📊'
      default:
        return '+'
    }
  }

  const getTypeColor = (type: PointBreakdown['type']) => {
    switch (type) {
      case 'result':
        return 'text-green-600'
      case 'goals_home':
      case 'goals_away':
        return 'text-blue-600'
      case 'group_advance':
      case 'group_position':
        return 'text-purple-600'
      case 'knockout_win':
        return 'text-yellow-600'
      case 'knockout_lose':
      case 'knockout_tie':
        return 'text-orange-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="bg-gradient-to-r from-blue-700 to-blue-600 text-white px-4 py-3 flex justify-between items-center">
        <h2 className="text-lg font-bold">📊 Points Breakdown</h2>
        <span className="text-2xl font-bold">{totalPoints} pts</span>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {breakdown.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No points earned yet
          </div>
        ) : (
          <div className="divide-y">
            {breakdown.map((item, index) => (
              <div
                key={index}
                className="px-4 py-2 flex items-center gap-3 hover:bg-gray-50"
              >
                <span className={`text-lg ${getTypeColor(item.type)}`}>
                  {getTypeIcon(item.type)}
                </span>
                <span className="flex-1 text-sm text-gray-700">
                  {item.description}
                </span>
                <span className={`font-bold ${getTypeColor(item.type)}`}>
                  +{item.points}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
