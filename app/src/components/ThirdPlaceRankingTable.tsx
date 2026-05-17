"use client";

import {
  ThirdPlaceTeam,
  canSwapThirdPlaceUp,
  canSwapThirdPlaceDown,
} from "@/lib/third-place-ranking";
import { getTeamLabel } from "@/lib/team-display";

interface ThirdPlaceRankingTableProps {
  rankedTeams: ThirdPlaceTeam[];
  onSwapPositions?: (group1: string, group2: string) => void;
  disabled?: boolean;
}

export default function ThirdPlaceRankingTable({
  rankedTeams,
  onSwapPositions,
  disabled = false,
}: ThirdPlaceRankingTableProps) {
  const canSwapUp = (index: number): boolean => {
    if (disabled || !onSwapPositions) return false;
    return canSwapThirdPlaceUp(rankedTeams, index);
  };

  const canSwapDown = (index: number): boolean => {
    if (disabled || !onSwapPositions) return false;
    return canSwapThirdPlaceDown(rankedTeams, index);
  };

  const handleSwapUp = (index: number) => {
    if (!onSwapPositions || index === 0) return;
    onSwapPositions(rankedTeams[index - 1].group, rankedTeams[index].group);
  };

  const handleSwapDown = (index: number) => {
    if (!onSwapPositions || index >= rankedTeams.length - 1) return;
    onSwapPositions(rankedTeams[index].group, rankedTeams[index + 1].group);
  };

  const getGroupLetter = (group: string): string => {
    return group.replace("GROUP_", "");
  };

  return (
    <div className="bg-white/5 rounded-xl overflow-hidden border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/10 text-white/60">
            <th className="px-1.5 py-2 text-left text-xs font-semibold">#</th>
            <th className="px-1 py-2 text-center text-xs font-semibold">Grp</th>
            <th className="px-1 py-2 text-left text-xs font-semibold">Team</th>
            <th className="px-1 py-2 text-center text-xs font-semibold">P</th>
            <th className="px-1 py-2 text-center text-xs font-semibold">W</th>
            <th className="px-1 py-2 text-center text-xs font-semibold">D</th>
            <th className="px-1 py-2 text-center text-xs font-semibold">L</th>
            <th className="px-1 py-2 text-center text-xs font-semibold">GD</th>
            <th className="px-1 py-2 text-center text-xs font-semibold">GF</th>
            <th className="px-1.5 py-2 text-center text-xs font-bold">Pts</th>
            {onSwapPositions && !disabled && <th className="px-1 py-2"></th>}
          </tr>
        </thead>
        <tbody>
          {rankedTeams.map((team, index) => {
            const qualifies = index < 8;
            const isCutoffRow = index === 7; // last qualifying row

            const rowStyle = qualifies
              ? { backgroundColor: "var(--qualifying-bg)" }
              : { backgroundColor: "rgba(239, 68, 68, 0.15)" };
            const textColor = qualifies
              ? "var(--qualifying-text)"
              : "#f87171";
            const dimTextColor = qualifies
              ? "var(--qualifying-text)"
              : "#f87171";

            return (
              <tr
                key={team.group}
                className="border-b border-white/5"
                style={{
                  ...rowStyle,
                  borderBottomWidth: isCutoffRow ? "3px" : undefined,
                  borderBottomColor: isCutoffRow
                    ? "rgba(255, 255, 255, 0.3)"
                    : undefined,
                }}
              >
                <td
                  className="px-1.5 py-2 font-medium"
                  style={{ color: textColor }}
                >
                  {index + 1}
                </td>
                <td
                  className="px-1 py-2 text-center font-medium"
                  style={{ color: textColor }}
                >
                  {getGroupLetter(team.group)}
                </td>
                <td className="px-1 py-2">
                  <div className="flex items-center gap-1">
                    {team.team.crest ? (
                      <img
                        src={team.team.crest}
                        alt={getTeamLabel(team.team)}
                        className="w-5 h-5 object-contain shrink-0"
                      />
                    ) : (
                      <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[8px] font-bold text-white/60 shrink-0">
                        {getTeamLabel(team.team).substring(0, 3)}
                      </div>
                    )}
                    <span
                      className={qualifies ? "font-medium" : "text-white/80"}
                      style={{ color: textColor }}
                    >
                      {getTeamLabel(team.team)}
                    </span>
                  </div>
                </td>
                <td
                  className="px-1 py-2 text-center"
                  style={{
                    color: dimTextColor,
                    opacity: qualifies ? 0.7 : 1,
                  }}
                >
                  {team.played}
                </td>
                <td
                  className="px-1 py-2 text-center"
                  style={{
                    color: dimTextColor,
                    opacity: qualifies ? 0.7 : 1,
                  }}
                >
                  {team.won}
                </td>
                <td
                  className="px-1 py-2 text-center"
                  style={{
                    color: dimTextColor,
                    opacity: qualifies ? 0.7 : 1,
                  }}
                >
                  {team.drawn}
                </td>
                <td
                  className="px-1 py-2 text-center"
                  style={{
                    color: dimTextColor,
                    opacity: qualifies ? 0.7 : 1,
                  }}
                >
                  {team.lost}
                </td>
                <td
                  className="px-1 py-2 text-center"
                  style={{
                    color: dimTextColor,
                    opacity: qualifies ? 0.7 : 1,
                  }}
                >
                  {team.goalDifference > 0 ? "+" : ""}
                  {team.goalDifference}
                </td>
                <td
                  className="px-1 py-2 text-center"
                  style={{
                    color: dimTextColor,
                    opacity: qualifies ? 0.7 : 1,
                  }}
                >
                  {team.goalsFor}
                </td>
                <td
                  className="px-1.5 py-2 text-center font-bold"
                  style={{
                    color: qualifies ? "var(--qualifying-text)" : "#f87171",
                  }}
                >
                  {team.points}
                </td>
                {onSwapPositions && !disabled && (
                  <td className="px-1 py-2 text-center">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSwapUp(index)}
                        disabled={!canSwapUp(index)}
                        className="w-8 h-3 rounded flex items-center justify-center transition-all"
                        style={{
                          backgroundColor: canSwapUp(index)
                            ? "var(--qualifying-text)"
                            : "rgb(71, 85, 105)",
                          opacity: canSwapUp(index) ? 1 : 0.2,
                          cursor: canSwapUp(index) ? "pointer" : "default",
                        }}
                        title="Swap with team above"
                      >
                        <span className="text-[8px] leading-none text-slate-900">
                          ▲
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwapDown(index)}
                        disabled={!canSwapDown(index)}
                        className="w-8 h-3 rounded flex items-center justify-center transition-all"
                        style={{
                          backgroundColor: canSwapDown(index)
                            ? "var(--qualifying-text)"
                            : "rgb(71, 85, 105)",
                          opacity: canSwapDown(index) ? 1 : 0.2,
                          cursor: canSwapDown(index) ? "pointer" : "default",
                        }}
                        title="Swap with team below"
                      >
                        <span className="text-[8px] leading-none text-slate-900">
                          ▼
                        </span>
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
