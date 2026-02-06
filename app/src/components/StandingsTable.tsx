"use client";

import { CalculatedStanding } from "@/types/football";

interface StandingsTableProps {
  standings: CalculatedStanding[];
  onSwapPositions?: (teamId1: number, teamId2: number) => void;
  disabled?: boolean;
  highlightAdvancing?: number; // How many teams advance
}

export default function StandingsTable({
  standings,
  onSwapPositions,
  disabled = false,
  highlightAdvancing = 3,
}: StandingsTableProps) {
  // Find teams with same points that can be swapped
  const canSwap = (index: number): boolean => {
    if (disabled || !onSwapPositions) return false;
    if (index === 0) return false;
    return standings[index].points === standings[index - 1].points;
  };

  const handleSwap = (index: number) => {
    if (!onSwapPositions || index === 0) return;
    onSwapPositions(standings[index - 1].team.id, standings[index].team.id);
  };

  return (
    <div className="bg-white/5 rounded-xl overflow-hidden border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/10 text-white/60">
            <th className="px-2 py-2 text-left text-xs font-semibold">#</th>
            <th className="px-2 py-2 text-left text-xs font-semibold">Team</th>
            <th className="px-2 py-2 text-center text-xs font-semibold">P</th>
            <th className="px-2 py-2 text-center text-xs font-semibold">W</th>
            <th className="px-2 py-2 text-center text-xs font-semibold">D</th>
            <th className="px-2 py-2 text-center text-xs font-semibold">L</th>
            <th className="px-2 py-2 text-center text-xs font-semibold">GD</th>
            <th className="px-2 py-2 text-center text-xs font-bold">Pts</th>
            {onSwapPositions && !disabled && <th className="px-2 py-2"></th>}
          </tr>
        </thead>
        <tbody>
          {standings.map((standing, index) => {
            const advances = index < highlightAdvancing;
            return (
              <tr
                key={standing.team.id}
                className={`border-b border-white/5 ${
                  advances ? "bg-emerald-500/10" : ""
                }`}
              >
                <td className={`px-2 py-2 font-medium ${advances ? "text-emerald-400" : "text-white/60"}`}>{index + 1}</td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1.5">
                    {standing.team.crest ? (
                      <img
                        src={standing.team.crest}
                        alt={standing.team.name}
                        className="w-5 h-5 object-contain"
                      />
                    ) : (
                      <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[8px] font-bold text-white/60">
                        {standing.team.tla?.substring(0, 2)}
                      </div>
                    )}
                    <span className={`truncate ${advances ? "text-emerald-400 font-medium" : "text-white/80"}`}>{standing.team.tla}</span>
                  </div>
                </td>
                <td className="px-2 py-2 text-center text-white/60">{standing.played}</td>
                <td className="px-2 py-2 text-center text-white/60">{standing.won}</td>
                <td className="px-2 py-2 text-center text-white/60">{standing.drawn}</td>
                <td className="px-2 py-2 text-center text-white/60">{standing.lost}</td>
                <td className="px-2 py-2 text-center text-white/60">
                  {standing.goalDifference > 0 ? "+" : ""}
                  {standing.goalDifference}
                </td>
                <td className={`px-2 py-2 text-center font-bold ${advances ? "text-emerald-400" : "text-white"}`}>
                  {standing.points}
                </td>
                {onSwapPositions && !disabled && (
                  <td className="px-2 py-2 text-center">
                    {canSwap(index) && (
                      <button
                        type="button"
                        onClick={() => handleSwap(index)}
                        className="text-emerald-400 hover:text-emerald-300 text-lg transition-colors"
                        title="Swap with team above"
                      >
                        ↕
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
