"use client";

import { CalculatedStanding } from "@/types/football";

interface StandingsTableProps {
  standings: CalculatedStanding[];
  onSwapPositions?: (teamId1: number, teamId2: number) => void;
  disabled?: boolean;
  thirdPlaceQualifies?: boolean; // Whether 3rd place team in this group qualifies for R32
}

export default function StandingsTable({
  standings,
  onSwapPositions,
  disabled = false,
  thirdPlaceQualifies = false,
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
            const definitelyAdvances = index < 2; // 1st and 2nd always qualify
            const isThirdPlace = index === 2;
            const thirdAdvances = isThirdPlace && thirdPlaceQualifies;
            const thirdDoesNotAdvance = isThirdPlace && !thirdPlaceQualifies;
            
            // Determine styling based on qualification status
            const rowStyle = definitelyAdvances || thirdAdvances
              ? { backgroundColor: 'var(--qualifying-bg)' }
              : thirdDoesNotAdvance
              ? { backgroundColor: 'rgba(239, 68, 68, 0.15)' } // red tint for doesn't qualify
              : undefined;
            const textColor = definitelyAdvances || thirdAdvances
              ? 'var(--qualifying-text)'
              : thirdDoesNotAdvance
              ? '#f87171' // red-400
              : 'rgba(255,255,255,0.6)';
            const dimTextColor = definitelyAdvances || thirdAdvances
              ? 'var(--qualifying-text)'
              : thirdDoesNotAdvance
              ? '#f87171'
              : 'rgba(255,255,255,0.6)';
            
            return (
              <tr
                key={standing.team.id}
                className="border-b border-white/5"
                style={rowStyle}
              >
                <td className="px-2 py-2 font-medium" style={{ color: textColor }}>{index + 1}</td>
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
                    <span className={`truncate ${definitelyAdvances || thirdAdvances ? "font-medium" : "text-white/80"}`} style={{ color: textColor }}>{standing.team.tla}</span>
                    {thirdDoesNotAdvance && <span className="text-[9px] text-red-400 ml-1">✗</span>}
                  </div>
                </td>
                <td className="px-2 py-2 text-center" style={{ color: dimTextColor, opacity: definitelyAdvances || thirdAdvances ? 0.7 : 1 }}>{standing.played}</td>
                <td className="px-2 py-2 text-center" style={{ color: dimTextColor, opacity: definitelyAdvances || thirdAdvances ? 0.7 : 1 }}>{standing.won}</td>
                <td className="px-2 py-2 text-center" style={{ color: dimTextColor, opacity: definitelyAdvances || thirdAdvances ? 0.7 : 1 }}>{standing.drawn}</td>
                <td className="px-2 py-2 text-center" style={{ color: dimTextColor, opacity: definitelyAdvances || thirdAdvances ? 0.7 : 1 }}>{standing.lost}</td>
                <td className="px-2 py-2 text-center" style={{ color: dimTextColor, opacity: definitelyAdvances || thirdAdvances ? 0.7 : 1 }}>
                  {standing.goalDifference > 0 ? "+" : ""}
                  {standing.goalDifference}
                </td>
                <td className="px-2 py-2 text-center font-bold" style={{ color: definitelyAdvances || thirdAdvances ? 'var(--qualifying-text)' : thirdDoesNotAdvance ? '#f87171' : 'white' }}>
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
