"use client";

import { Match, PointBreakdown } from "@/types/football";
import { LocalPrediction } from "@/types/database";
import { calculateMatchPoints, getTeamLabel } from "@/lib/scoring";
import { useState, useMemo } from "react";

interface MatchPointsTooltipProps {
  match: Match;
  prediction: LocalPrediction | null | undefined;
  /** For knockout: the team user predicted for home slot */
  predictedHomeTeam?: { id: number } | null;
  /** For knockout: the team user predicted for away slot */
  predictedAwayTeam?: { id: number } | null;
  /** Pre-computed breakdown items for this match (from LeaderboardContext) */
  matchBreakdown?: PointBreakdown[];
  className?: string;
}

export default function MatchPointsTooltip({
  match,
  prediction,
  predictedHomeTeam,
  predictedAwayTeam,
  matchBreakdown,
  className = "",
}: MatchPointsTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const pts = calculateMatchPoints(
    match,
    prediction,
    predictedHomeTeam,
    predictedAwayTeam,
  );

  // Derive tooltip detail rows from pre-computed breakdown (centralized scoring)
  const details = useMemo(() => {
    if (!matchBreakdown) return null;
    return matchBreakdown.map((item) => ({
      description: item.description,
      points: item.points,
      earned: true, // All items in breakdown are earned points
    }));
  }, [matchBreakdown]);

  // Don't render if match not finished/live or no prediction
  if ((!pts.isFinished && !pts.isLive) || !pts.hasPrediction) {
    return <div className={className || "w-12 shrink-0"} />;
  }

  const actualHome = match.score.fullTime.home;
  const actualAway = match.score.fullTime.away;
  const hasActualScore = actualHome !== null && actualAway !== null;
  const isLive = pts.isLive;

  // Determine actual winner for highlighting
  const actualHomeWon = hasActualScore && actualHome > actualAway;
  const actualAwayWon = hasActualScore && actualAway > actualHome;
  const actualDraw = hasActualScore && actualHome === actualAway;
  const isGroupStage = match.stage === "GROUP_STAGE";
  const actualHomeHighlight = actualHomeWon || (isGroupStage && actualDraw);
  const actualAwayHighlight = actualAwayWon || (isGroupStage && actualDraw);

  // Determine if small layout (for group stage inline view)
  const isSmall = className?.includes("w-8");

  // Color classes based on live status
  const pointsColorClass = isLive
    ? "text-red-400"
    : pts.total > 0
      ? "text-emerald-400"
      : "text-white/40";

  return (
    <button
      type="button"
      className={`${className || "w-12 shrink-0 pl-2"} text-right relative`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setShowTooltip((prev) => !prev);
      }}
    >
      <span
        className={`${isSmall ? "text-xs" : "text-sm"} font-bold cursor-help ${pointsColorClass}`}
      >
        +{pts.total}
      </span>

      {/* Tooltip */}
      {showTooltip && hasActualScore && (
        <>
          {/* Click-away overlay for mobile */}
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setShowTooltip(false);
            }}
          />
          <div className="absolute right-0 bottom-full mb-2 z-[100] whitespace-nowrap">
            <div
              className={`bg-slate-800 border rounded-lg shadow-xl p-3 ${isLive ? "border-red-500 border-2" : "border-white/20"}`}
            >
              {/* Header */}
              <div
                className={`text-[10px] uppercase tracking-wider mb-2 text-center ${isLive ? "text-red-400" : "text-white/50"}`}
              >
                {isLive ? "🔴 Live Score" : "Actual Result"}
              </div>

              {/* Match result */}
              <div className="flex items-center justify-center gap-3">
                {/* Home team */}
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded ${actualHomeHighlight ? "bg-amber-500/80" : ""}`}
                >
                  {match.homeTeam.crest ? (
                    <img
                      src={match.homeTeam.crest}
                      alt={getTeamLabel(match.homeTeam)}
                      className="w-5 h-5 object-contain shrink-0"
                    />
                  ) : (
                    <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[8px] font-bold text-white/60 shrink-0">
                      {getTeamLabel(match.homeTeam).substring(0, 2)}
                    </div>
                  )}
                  <span
                    className={`text-sm font-semibold ${actualHomeHighlight ? "text-slate-900" : "text-white"}`}
                  >
                    {getTeamLabel(match.homeTeam)}
                  </span>
                </div>

                {/* Score */}
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded">
                  <span className="text-white font-bold text-lg">
                    {actualHome}
                  </span>
                  <span className="text-white/50">-</span>
                  <span className="text-white font-bold text-lg">
                    {actualAway}
                  </span>
                </div>

                {/* Away team */}
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded ${actualAwayHighlight ? "bg-amber-500/80" : ""}`}
                >
                  {match.awayTeam.crest ? (
                    <img
                      src={match.awayTeam.crest}
                      alt={getTeamLabel(match.awayTeam)}
                      className="w-5 h-5 object-contain shrink-0"
                    />
                  ) : (
                    <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[8px] font-bold text-white/60 shrink-0">
                      {getTeamLabel(match.awayTeam).substring(0, 2)}
                    </div>
                  )}
                  <span
                    className={`text-sm font-semibold ${actualAwayHighlight ? "text-slate-900" : "text-white"}`}
                  >
                    {getTeamLabel(match.awayTeam)}
                  </span>
                </div>
              </div>

              {/* Points breakdown */}
              <div className="mt-2 pt-2 border-t border-white/10 text-xs space-y-1">
                {details && details.length > 0 ? (
                  details.map((detail, i) => (
                    <div key={i} className="flex justify-between gap-4">
                      <span className="text-white/80">
                        {detail.description}
                      </span>
                      <span className="text-emerald-400 font-bold">
                        +{detail.points}
                      </span>
                    </div>
                  ))
                ) : pts.total > 0 ? (
                  <div className="flex justify-between gap-4">
                    <span className="text-white/80">Points earned</span>
                    <span className="text-emerald-400 font-bold">
                      +{pts.total}
                    </span>
                  </div>
                ) : (
                  <div className="text-white/40">No points earned</div>
                )}
                <div className="flex justify-between gap-4 pt-1 border-t border-white/10 font-semibold">
                  <span className="text-white/60">Total:</span>
                  <span
                    className={
                      pts.total > 0
                        ? "text-emerald-400 font-bold"
                        : "text-white/40"
                    }
                  >
                    {pts.total} / {pts.maxPossible}
                  </span>
                </div>
              </div>

              {/* Arrow */}
              <div className="absolute -bottom-1 right-4 w-2 h-2 bg-slate-800 border-r border-b border-white/20 transform rotate-45" />
            </div>
          </div>
        </>
      )}
    </button>
  );
}
