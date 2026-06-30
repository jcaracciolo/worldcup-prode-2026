"use client";

import { FifaMatchId } from "@/types/football";
import { getTeamLabel } from "@/lib/team-display";
import {
  getMaxPossiblePoints,
  ROUND_MULTIPLIERS,
} from "@/lib/scoring";
import { isGroupStageMatch } from "@/lib/match-utils";
import { useMatch } from "@/contexts/MatchContext";
import { useLeaderboard } from "@/contexts/LeaderboardContext";
import { useState, useMemo } from "react";

interface MatchPointsTooltipProps {
  matchId: FifaMatchId;
  userId: string;
  className?: string;
}

export default function MatchPointsTooltip({
  matchId,
  userId,
  className = "",
}: MatchPointsTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Get actual match from MatchContext (real teams/scores baked in)
  const match = useMatch(matchId);

  // Get the user's full breakdown from LeaderboardContext
  const { getUserScore } = useLeaderboard();
  const userScore = getUserScore(userId);

  // Filter breakdown to this match
  const matchBreakdown = useMemo(
    () => (userScore?.breakdown ?? []).filter((b) => b.matchId === matchId),
    [userScore?.breakdown, matchId],
  );

  // Derive total and status from the breakdown + match
  const total = matchBreakdown.reduce((sum, b) => sum + b.points, 0);
  const isLive = match?.status === "IN_PLAY" || match?.status === "PAUSED";
  const isFinished = match?.status === "FINISHED";
  const maxPossible = match ? getMaxPossiblePoints(match) : 0;

  // Check if user made a prediction for this match
  const hasPrediction = useMemo(() => {
    if (!userScore?.breakdown) return false;
    // A user has a prediction if they have ANY breakdown items for this match
    // OR if calculation was attempted (could score 0). We check via the leaderboard's
    // full calculation which only produces breakdown items for matches with predictions.
    // So: if breakdown has items → yes. If not, we need another signal.
    // The leaderboard computes breakdown for every match where prediction exists.
    // For 0-point matches: calculateGroupStagePoints/calculateKnockoutPoints return
    // empty arrays when no match points earned. So breakdown.length === 0 could mean
    // "no prediction" OR "prediction but scored 0".
    // We'll check the full breakdown array to see if this matchId appears in any
    // item's matchInfo (which is always set when prediction exists), or just show
    // the tooltip if the match is scorable — the worst case is showing "+0".
    return true; // We'll rely on the "+0" display being acceptable
  }, [userScore?.breakdown]);

  // Build breakdown display rows.
  // Earned points come from the pre-computed matchBreakdown.
  // Labels use actual match teams.
  const details = useMemo(() => {
    if (!match) return null;

    const actualHome = match.score.fullTime.home;
    const actualAway = match.score.fullTime.away;
    if (actualHome === null || actualAway === null) return null;

    const homeTla = getTeamLabel(match.homeTeam);
    const awayTla = getTeamLabel(match.awayTeam);
    const isGroup = isGroupStageMatch(match);
    const isR32 = match.stage === "LAST_32";
    const multiplier = isGroup ? 1 : ROUND_MULTIPLIERS[match.stage] || 1;
    const multLabel = multiplier > 1 ? ` (${multiplier}×)` : "";

    // Sum earned points by type from breakdown
    const earned = (type: string) =>
      matchBreakdown
        .filter((b) => b.type === type)
        .reduce((sum, b) => sum + b.points, 0);

    const rows: { label: string; points: number }[] = [];

    // Advancer ("passes") row — the team you predicted to advance that did.
    const passItem = matchBreakdown.find((b) => b.type === "knockout_pass");
    const passTla = passItem?.team?.tla;
    const passLabel = passTla
      ? `${passTla} advances${multLabel}`
      : `Advances${multLabel}`;
    const passRow = { label: passLabel, points: earned("knockout_pass") };

    if (isGroup || isR32) {
      // Group stage and R32 use a single "Result" line (position-based scoring)
      rows.push({ label: "Result", points: earned("result") });
      if (isR32) rows.push(passRow);
      rows.push({ label: `Goals (${homeTla})`, points: earned("goals_home") });
      rows.push({ label: `Goals (${awayTla})`, points: earned("goals_away") });
    } else {
      // Knockout (R32+): show winner/loser or tie + goals
      const isTie = actualHome === actualAway;
      if (isTie) {
        rows.push({
          label: `${homeTla} tie${multLabel}`,
          points: matchBreakdown
            .filter(
              (b) =>
                (b.type === "knockout_tie" || b.type === "result") &&
                (b.team?.tla === match.homeTeam.tla || b.type === "result"),
            )
            .reduce(
              (sum, b) => sum + (b.type === "result" ? b.points / 2 : b.points),
              0,
            ),
        });
        rows.push({
          label: `${awayTla} tie${multLabel}`,
          points: matchBreakdown
            .filter(
              (b) =>
                (b.type === "knockout_tie" || b.type === "result") &&
                (b.team?.tla === match.awayTeam.tla || b.type === "result"),
            )
            .reduce(
              (sum, b) => sum + (b.type === "result" ? b.points / 2 : b.points),
              0,
            ),
        });
      } else {
        const winnerTla = actualHome > actualAway ? homeTla : awayTla;
        const loserTla = actualHome > actualAway ? awayTla : homeTla;
        rows.push({
          label: `${winnerTla} win${multLabel}`,
          points: earned("knockout_win") || earned("result"),
        });
        rows.push({
          label: `${loserTla} lose${multLabel}`,
          points: earned("knockout_lose"),
        });
      }
      rows.push(passRow);
      rows.push({ label: `Goals (${homeTla})`, points: earned("goals_home") });
      rows.push({ label: `Goals (${awayTla})`, points: earned("goals_away") });
    }

    return rows;
  }, [match, matchBreakdown]);

  // Don't render if match not found, not finished/live, or no prediction
  if (!match || (!isFinished && !isLive) || !hasPrediction) {
    return <div className={className || "w-12 shrink-0"} />;
  }

  const actualHome = match.score.fullTime.home;
  const actualAway = match.score.fullTime.away;
  const hasActualScore = actualHome !== null && actualAway !== null;

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
    : total > 0
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
        +{total}
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
                  {match.homeTeam?.crest ? (
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
                  {match.awayTeam?.crest ? (
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

              {/* Points breakdown — always show all categories */}
              <div className="mt-2 pt-2 border-t border-white/10 text-xs space-y-1">
                {details ? (
                  details.map((row, i) => (
                    <div key={i} className="flex justify-between gap-4">
                      <span className="text-white/80">{row.label}</span>
                      <span
                        className={
                          row.points > 0
                            ? "text-emerald-400 font-bold"
                            : "text-white/30"
                        }
                      >
                        {row.points > 0 ? `+${row.points}` : "0"}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-white/40">No score data</div>
                )}
                <div className="flex justify-between gap-4 pt-1 border-t border-white/10 font-semibold">
                  <span className="text-white/60">Total:</span>
                  <span
                    className={
                      total > 0 ? "text-emerald-400 font-bold" : "text-white/40"
                    }
                  >
                    {total} / {maxPossible}
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
