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
  // Check if team can swap with the one above
  const canSwapUp = (index: number): boolean => {
    if (disabled || !onSwapPositions) return false;
    if (index === 0) return false;
    return standings[index].points === standings[index - 1].points;
  };

  // Check if team can swap with the one below
  const canSwapDown = (index: number): boolean => {
    if (disabled || !onSwapPositions) return false;
    if (index >= standings.length - 1) return false;
    return standings[index].points === standings[index + 1].points;
  };

  const handleSwapUp = (index: number) => {
    if (!onSwapPositions || index === 0) return;
    onSwapPositions(standings[index - 1].team.id, standings[index].team.id);
  };

  const handleSwapDown = (index: number) => {
    if (!onSwapPositions || index >= standings.length - 1) return;
    onSwapPositions(standings[index].team.id, standings[index + 1].team.id);
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
                className="border-b border-white/5"
                style={advances ? { backgroundColor: 'var(--qualifying-bg)' } : undefined}
              >
                <td className="px-2 py-2 font-medium" style={advances ? { color: 'var(--qualifying-text)' } : { color: 'rgba(255,255,255,0.6)' }}>{index + 1}</td>
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
                    <span className={`truncate ${advances ? "font-medium" : "text-white/80"}`} style={advances ? { color: 'var(--qualifying-text)' } : undefined}>{standing.team.tla}</span>
                  </div>
                </td>
                <td className="px-2 py-2 text-center" style={advances ? { color: 'var(--qualifying-text)', opacity: 0.7 } : { color: 'rgba(255,255,255,0.6)' }}>{standing.played}</td>
                <td className="px-2 py-2 text-center" style={advances ? { color: 'var(--qualifying-text)', opacity: 0.7 } : { color: 'rgba(255,255,255,0.6)' }}>{standing.won}</td>
                <td className="px-2 py-2 text-center" style={advances ? { color: 'var(--qualifying-text)', opacity: 0.7 } : { color: 'rgba(255,255,255,0.6)' }}>{standing.drawn}</td>
                <td className="px-2 py-2 text-center" style={advances ? { color: 'var(--qualifying-text)', opacity: 0.7 } : { color: 'rgba(255,255,255,0.6)' }}>{standing.lost}</td>
                <td className="px-2 py-2 text-center" style={advances ? { color: 'var(--qualifying-text)', opacity: 0.7 } : { color: 'rgba(255,255,255,0.6)' }}>
                  {standing.goalDifference > 0 ? "+" : ""}
                  {standing.goalDifference}
                </td>
                <td className="px-2 py-2 text-center font-bold" style={advances ? { color: 'var(--qualifying-text)' } : { color: 'white' }}>
                  {standing.points}
                </td>
                {onSwapPositions && !disabled && (
                  <td className="px-2 py-2 text-center">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSwapUp(index)}
                        disabled={!canSwapUp(index)}
                        className="w-8 h-3 rounded flex items-center justify-center transition-all"
                        style={{
                          backgroundColor: canSwapUp(index) ? 'var(--qualifying-text)' : 'rgb(71, 85, 105)',
                          opacity: canSwapUp(index) ? 1 : 0.2,
                          cursor: canSwapUp(index) ? 'pointer' : 'default',
                        }}
                        title="Swap with team above"
                      >
                        <span className="text-[8px] leading-none text-slate-900">▲</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwapDown(index)}
                        disabled={!canSwapDown(index)}
                        className="w-8 h-3 rounded flex items-center justify-center transition-all"
                        style={{
                          backgroundColor: canSwapDown(index) ? 'var(--qualifying-text)' : 'rgb(71, 85, 105)',
                          opacity: canSwapDown(index) ? 1 : 0.2,
                          cursor: canSwapDown(index) ? 'pointer' : 'default',
                        }}
                        title="Swap with team below"
                      >
                        <span className="text-[8px] leading-none text-slate-900">▼</span>
                      </button>
                    </div>
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
