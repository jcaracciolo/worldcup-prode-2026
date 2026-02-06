"use client";

import { PointBreakdown } from "@/types/football";

interface PointsBreakdownProps {
  breakdown: PointBreakdown[];
  totalPoints: number;
}

export default function PointsBreakdown({
  breakdown,
  totalPoints,
}: PointsBreakdownProps) {
  const getTypeIcon = (type: PointBreakdown["type"]) => {
    switch (type) {
      case "result":
        return "✓";
      case "goals_home":
      case "goals_away":
        return "⚽";
      case "group_advance":
        return "📈";
      case "group_position":
        return "🎯";
      case "knockout_win":
        return "🏆";
      case "knockout_lose":
      case "knockout_tie":
        return "📊";
      default:
        return "+";
    }
  };

  const getTypeColor = (type: PointBreakdown["type"]) => {
    switch (type) {
      case "result":
        return "text-green-400";
      case "goals_home":
      case "goals_away":
        return "text-blue-400";
      case "group_advance":
      case "group_position":
        return "text-purple-400";
      case "knockout_win":
        return "text-yellow-400";
      case "knockout_lose":
      case "knockout_tie":
        return "text-orange-400";
      default:
        return "text-white/60";
    }
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 text-white px-4 py-3 flex justify-between items-center">
        <h2 className="text-lg font-bold">📊 Points Breakdown</h2>
        <span className="text-2xl font-bold">{totalPoints} pts</span>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {breakdown.length === 0 ? (
          <div className="p-4 text-center text-white/50">
            No points earned yet - points are calculated when matches finish
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {breakdown.map((item, index) => (
              <div
                key={index}
                className="px-4 py-2 flex items-center gap-3 hover:bg-white/5"
              >
                <span className={`text-lg ${getTypeColor(item.type)}`}>
                  {getTypeIcon(item.type)}
                </span>
                <span className="flex-1 text-sm text-white/80">
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
  );
}
