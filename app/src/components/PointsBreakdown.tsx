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
  const getTypeLabel = (type: PointBreakdown["type"]) => {
    switch (type) {
      case "result":
        return "Result";
      case "goals_home":
      case "goals_away":
        return "Goals";
      case "group_advance":
        return "Advance";
      case "group_position":
        return "Position";
      case "knockout_win":
        return "Winner";
      case "knockout_lose":
        return "Loser";
      case "knockout_tie":
        return "Tie";
      default:
        return "";
    }
  };

  const getTypeBgColor = (type: PointBreakdown["type"]) => {
    switch (type) {
      case "result":
        return "bg-green-500/20 text-green-400";
      case "goals_home":
      case "goals_away":
        return "bg-blue-500/20 text-blue-400";
      case "group_advance":
      case "group_position":
        return "bg-purple-500/20 text-purple-400";
      case "knockout_win":
        return "bg-yellow-500/20 text-yellow-400";
      case "knockout_lose":
      case "knockout_tie":
        return "bg-orange-500/20 text-orange-400";
      default:
        return "bg-white/10 text-white/60";
    }
  };

  // Group breakdown by category
  const groupMatchPoints = breakdown.filter(
    (b) =>
      (b.type === "result" ||
        b.type === "goals_home" ||
        b.type === "goals_away") &&
      b.matchInfo?.stage === "GROUP_STAGE",
  );
  const groupBonusPoints = breakdown.filter(
    (b) => b.type === "group_advance" || b.type === "group_position",
  );
  const knockoutPoints = breakdown.filter(
    (b) =>
      b.type === "knockout_win" ||
      b.type === "knockout_lose" ||
      b.type === "knockout_tie" ||
      ((b.type === "result" ||
        b.type === "goals_home" ||
        b.type === "goals_away") &&
        b.matchInfo &&
        b.matchInfo.stage !== "GROUP_STAGE"),
  );

  const renderItem = (item: PointBreakdown, index: number) => {
    // For goals, show match with highlighted score
    const isGoalsType =
      item.type === "goals_home" || item.type === "goals_away";
    // Knockout types should show match info instead of just team (since teams may be TBD)
    const isKnockoutType =
      item.type === "knockout_win" ||
      item.type === "knockout_lose" ||
      item.type === "knockout_tie";
    // Group bonus types show just the team (they have proper team data)
    const isGroupBonusType =
      item.type === "group_advance" || item.type === "group_position";

    return (
      <div
        key={index}
        className="px-4 py-3 flex items-center gap-3 hover:bg-white/5 border-b border-white/5 last:border-0"
      >
        {/* Team or Match display */}
        <div className="flex items-center gap-2 shrink-0">
          {isGroupBonusType && item.team ? (
            (() => {
              const teamTla =
                item.team?.tla ||
                item.team?.name?.substring(0, 3).toUpperCase() ||
                "";
              return (
                <>
                  {item.team?.crest ? (
                    <img
                      src={item.team.crest}
                      alt={teamTla || "TBD"}
                      className="w-6 h-6 object-contain"
                    />
                  ) : (
                    <span className="w-6 h-6 flex items-center justify-center text-base">
                      🏳️
                    </span>
                  )}
                  <span className="font-bold text-white w-10">
                    {teamTla || "⏳"}
                  </span>
                </>
              );
            })()
          ) : item.matchInfo ? (
            (() => {
              const homeWon =
                item.matchInfo.homeGoals > item.matchInfo.awayGoals;
              const awayWon =
                item.matchInfo.awayGoals > item.matchInfo.homeGoals;
              const homeTeam = item.matchInfo.homeTeam as {
                tla?: string;
                crest: string;
                shortName?: string;
              };
              const awayTeam = item.matchInfo.awayTeam as {
                tla?: string;
                crest: string;
                shortName?: string;
              };
              const homeTla =
                homeTeam.tla ||
                homeTeam.shortName?.substring(0, 3).toUpperCase() ||
                "";
              const awayTla =
                awayTeam.tla ||
                awayTeam.shortName?.substring(0, 3).toUpperCase() ||
                "";
              const homeHasTeam = homeTla !== "";
              const awayHasTeam = awayTla !== "";
              const highlightHome = item.type === "goals_home";
              const highlightAway = item.type === "goals_away";
              
              // For knockout types, highlight winner/loser based on score
              const isKnockoutEntry = isKnockoutType;
              const knockoutHomeWon = homeWon && isKnockoutEntry;
              const knockoutAwayWon = awayWon && isKnockoutEntry;
              
              return (
                <div className="flex items-center gap-1.5">
                  {homeTeam.crest ? (
                    <img
                      src={homeTeam.crest}
                      alt={homeTla || "TBD"}
                      className={`w-5 h-5 object-contain ${(awayWon && !isGoalsType) || (knockoutAwayWon && item.type === "knockout_win") ? "opacity-50" : ""}`}
                    />
                  ) : (
                    <span className="w-5 h-5 flex items-center justify-center text-sm">
                      🏳️
                    </span>
                  )}
                  <span
                    className={`text-xs font-medium w-8 text-right ${
                      !homeHasTeam
                        ? "text-white/40"
                        : isGoalsType
                          ? "text-white/70"
                          : knockoutHomeWon
                            ? "text-emerald-400 font-bold"
                            : knockoutAwayWon
                              ? "text-white/40"
                              : homeWon
                                ? "text-emerald-400 font-bold"
                                : awayWon
                                  ? "text-white/40"
                                  : "text-white/70"
                    }`}
                  >
                    {homeHasTeam ? homeTla : "⏳"}
                  </span>
                  <span className="font-bold px-1.5 py-0.5 bg-white/10 rounded text-sm min-w-[40px] text-center">
                    <span
                      className={
                        highlightHome ? "text-yellow-400" : "text-white"
                      }
                    >
                      {item.matchInfo.homeGoals}
                    </span>
                    <span className="text-white">-</span>
                    <span
                      className={
                        highlightAway ? "text-yellow-400" : "text-white"
                      }
                    >
                      {item.matchInfo.awayGoals}
                    </span>
                  </span>
                  <span
                    className={`text-xs font-medium w-8 ${
                      !awayHasTeam
                        ? "text-white/40"
                        : isGoalsType
                          ? "text-white/70"
                          : knockoutAwayWon
                            ? "text-emerald-400 font-bold"
                            : knockoutHomeWon
                              ? "text-white/40"
                              : awayWon
                                ? "text-emerald-400 font-bold"
                                : homeWon
                                  ? "text-white/40"
                                  : "text-white/70"
                    }`}
                  >
                    {awayHasTeam ? awayTla : "⏳"}
                  </span>
                  {awayTeam.crest ? (
                    <img
                      src={awayTeam.crest}
                      alt={awayTla || "TBD"}
                      className={`w-5 h-5 object-contain ${(homeWon && !isGoalsType) || (knockoutHomeWon && item.type === "knockout_win") ? "opacity-50" : ""}`}
                    />
                  ) : (
                    <span className="w-5 h-5 flex items-center justify-center text-sm">
                      🏳️
                    </span>
                  )}
                </div>
              );
            })()
          ) : (
            <span className="text-lg">📊</span>
          )}
        </div>

        {/* Description and badge */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${getTypeBgColor(item.type)}`}
          >
            {getTypeLabel(item.type)}
          </span>
          <p className="text-xs text-white/50 truncate">{item.description}</p>
        </div>

        {/* Points */}
        <div className="text-right shrink-0">
          <span className="text-lg font-bold text-emerald-400">
            +{item.points}
          </span>
        </div>
      </div>
    );
  };

  const renderSection = (
    title: string,
    emoji: string,
    items: PointBreakdown[],
    sectionPoints: number,
  ) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-4 last:mb-0">
        <div className="flex items-center justify-between px-4 py-2 bg-white/5">
          <span className="text-sm font-medium text-white/70">
            {emoji} {title}
          </span>
          <span className="text-sm font-bold text-white">
            {sectionPoints} pts
          </span>
        </div>
        <div>{items.map((item, index) => renderItem(item, index))}</div>
      </div>
    );
  };

  const groupMatchPts = groupMatchPoints.reduce((sum, p) => sum + p.points, 0);
  const groupBonusPts = groupBonusPoints.reduce((sum, p) => sum + p.points, 0);
  const knockoutPts = knockoutPoints.reduce((sum, p) => sum + p.points, 0);

  return (
    <div className="glass-card overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 text-white px-4 py-3 flex justify-between items-center">
        <h2 className="text-lg font-bold">📊 Points Breakdown</h2>
        <span className="text-2xl font-bold">{totalPoints} pts</span>
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        {breakdown.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-4xl mb-3">⏳</div>
            <p className="text-white/50">No points earned yet</p>
            <p className="text-white/30 text-sm mt-1">
              Points are calculated when matches finish
            </p>
          </div>
        ) : (
          <div className="py-2">
            {renderSection(
              "Group Match Predictions",
              "⚽",
              groupMatchPoints,
              groupMatchPts,
            )}
            {renderSection(
              "Group Standings Bonus",
              "📈",
              groupBonusPoints,
              groupBonusPts,
            )}
            {renderSection("Knockout Stage", "⚔️", knockoutPoints, knockoutPts)}
          </div>
        )}
      </div>

      {/* Summary footer */}
      {breakdown.length > 0 && (
        <div className="border-t border-white/10 px-4 py-3 bg-white/5">
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Group matches</span>
            <span className="text-white">{groupMatchPts}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Group bonus</span>
            <span className="text-white">{groupBonusPts}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Knockout</span>
            <span className="text-white">{knockoutPts}</span>
          </div>
        </div>
      )}
    </div>
  );
}
