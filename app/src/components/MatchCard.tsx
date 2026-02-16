"use client";

import { useMemo } from "react";
import { Match, FifaMatchId, asFifaMatchId } from "@/types/football";
import { useMatches, MatchWithLiveInfo } from "@/contexts/MatchContext";
import { getTeamDisplaySimple, shortLabel } from "@/lib/team-display";
import { format } from "date-fns";
import Link from "next/link";

interface MatchCardProps {
  match: Match | MatchWithLiveInfo;
  showDate?: boolean;
}

// Type guard to check if match has live info
function hasLiveInfo(
  match: Match | MatchWithLiveInfo,
): match is MatchWithLiveInfo {
  return "isLive" in match && "elapsedMinutes" in match;
}

export default function MatchCard({ match, showDate = false }: MatchCardProps) {
  // Resolve knockout teams from context
  const { resolvedKnockoutTeams } = useMatches();
  const fifaMatchNumber = asFifaMatchId(match.id);
  const resolved =
    match.stage !== "GROUP_STAGE"
      ? resolvedKnockoutTeams.get(fifaMatchNumber)
      : undefined;
  const homeTeam = resolved?.home ?? match.homeTeam;
  const awayTeam = resolved?.away ?? match.awayTeam;
  const homeDisplayName = getTeamDisplaySimple(
    homeTeam,
    match.id,
    "home",
    fifaMatchNumber,
  ).label;
  const awayDisplayName = getTeamDisplaySimple(
    awayTeam,
    match.id,
    "away",
    fifaMatchNumber,
  ).label;
  // Support both Match and MatchWithLiveInfo
  const isLive = hasLiveInfo(match)
    ? match.isLive
    : match.status === "IN_PLAY" || match.status === "PAUSED";
  const isFinished = match.status === "FINISHED";
  const matchDate = new Date(match.utcDate);

  // Get elapsed minutes if available
  const elapsedMinutes = hasLiveInfo(match) ? match.elapsedMinutes : null;
  const period = hasLiveInfo(match) ? match.period : null;

  // Format group name: GROUP_A -> Group A
  const formatGroupName = (group: string | null): string | null => {
    if (!group) return null;
    // Handle "GROUP_A" format -> "Group A"
    if (group.startsWith("GROUP_")) {
      return `Group ${group.replace("GROUP_", "")}`;
    }
    return group;
  };

  // Format stage name for display
  const formatStageName = (stage: string): string => {
    const stageNames: Record<string, string> = {
      GROUP_STAGE: "Group Stage",
      LAST_32: "Round of 32",
      LAST_16: "Round of 16",
      QUARTER_FINALS: "Quarter-Finals",
      SEMI_FINALS: "Semi-Finals",
      THIRD_PLACE: "3rd Place",
      FINAL: "Final",
    };
    return stageNames[stage] || stage.replace(/_/g, " ");
  };

  // Determine winner for highlighting
  const homeGoals = match.score.fullTime.home;
  const awayGoals = match.score.fullTime.away;
  const hasScore =
    (isFinished || isLive) && homeGoals !== null && awayGoals !== null;
  const homeWon = isFinished && hasScore && homeGoals > awayGoals;
  const awayWon = isFinished && hasScore && awayGoals > homeGoals;
  const isDraw = isFinished && hasScore && homeGoals === awayGoals;
  const isGroupStage = match.stage === "GROUP_STAGE";
  // Highlight both teams on group stage draws
  const homeHighlight = homeWon || (isGroupStage && isDraw);
  const awayHighlight = awayWon || (isGroupStage && isDraw);

  const getStatusDisplay = () => {
    if (isLive) {
      const timeDisplay =
        period === "HALF_TIME"
          ? "HT"
          : elapsedMinutes !== null
            ? `${elapsedMinutes}'`
            : "";

      return (
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full live-pulse">
            LIVE
          </span>
          {timeDisplay && (
            <span className="text-red-400 text-sm font-semibold">
              {timeDisplay}
            </span>
          )}
        </div>
      );
    }
    if (isFinished) {
      return (
        <span className="px-3 py-1 bg-slate-600 text-white text-xs font-semibold rounded-full">
          FT
        </span>
      );
    }
    return (
      <span className="text-emerald-400 font-bold text-lg">
        {format(matchDate, "HH:mm")}
      </span>
    );
  };

  return (
    <Link href={`/match/${match.id}`}>
      <div
        id={isLive ? `live-match-${match.id}` : undefined}
        className={`match-card glass-card-light p-3 sm:p-5 cursor-pointer group hover:ring-2 hover:ring-emerald-500/30 transition-all border-2 ${isLive ? "border-red-500 live-match" : "border-white/20"}`}
      >
        {showDate && (
          <div className="text-center text-[10px] sm:text-xs font-medium text-white/50 mb-3 sm:mb-4 uppercase tracking-wider">
            {format(matchDate, "EEE, MMM d")}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Home Team */}
          <div
            className={`flex-1 flex flex-col items-center gap-1 sm:gap-2 p-1.5 sm:p-2 rounded-lg ${homeHighlight ? "bg-amber-500/80" : ""} ${awayWon ? "opacity-50" : ""}`}
          >
            {homeTeam.crest ? (
              <img
                src={homeTeam.crest}
                alt={homeDisplayName}
                className="w-9 h-9 sm:w-12 sm:h-12 object-contain drop-shadow-md"
              />
            ) : (
              <div className="w-9 h-9 sm:w-12 sm:h-12 bg-white/20 rounded-full flex items-center justify-center text-white/60 font-bold text-xs sm:text-sm">
                {shortLabel(homeDisplayName)}
              </div>
            )}
            <span
              className={`font-semibold text-xs sm:text-sm text-center ${homeHighlight ? "text-slate-900" : "text-white"}`}
            >
              {homeDisplayName}
            </span>
          </div>

          {/* Score / Time */}
          <div className="flex flex-col items-center gap-1 sm:gap-2 min-w-[70px] sm:min-w-[100px]">
            {isFinished || isLive ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <span
                  className={`text-2xl sm:text-3xl font-bold ${isLive ? "text-red-500" : "text-white"}`}
                >
                  {match.score.fullTime.home ?? 0}
                </span>
                <span className="text-white/40 text-lg sm:text-xl">-</span>
                <span
                  className={`text-2xl sm:text-3xl font-bold ${isLive ? "text-red-500" : "text-white"}`}
                >
                  {match.score.fullTime.away ?? 0}
                </span>
              </div>
            ) : (
              <div className="text-white/30 text-xl sm:text-2xl font-light">
                vs
              </div>
            )}
            {getStatusDisplay()}
          </div>

          {/* Away Team */}
          <div
            className={`flex-1 flex flex-col items-center gap-1 sm:gap-2 p-1.5 sm:p-2 rounded-lg ${awayHighlight ? "bg-amber-500/80" : ""} ${homeWon ? "opacity-50" : ""}`}
          >
            {awayTeam.crest ? (
              <img
                src={awayTeam.crest}
                alt={awayDisplayName}
                className="w-9 h-9 sm:w-12 sm:h-12 object-contain drop-shadow-md"
              />
            ) : (
              <div className="w-9 h-9 sm:w-12 sm:h-12 bg-white/20 rounded-full flex items-center justify-center text-white/60 font-bold text-xs sm:text-sm">
                {shortLabel(awayDisplayName)}
              </div>
            )}
            <span
              className={`font-semibold text-xs sm:text-sm text-center ${awayHighlight ? "text-slate-900" : "text-white"}`}
            >
              {awayDisplayName}
            </span>
          </div>
        </div>

        {/* Group/Stage info and Venue */}
        <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-white/10">
          <div className="flex flex-col items-center gap-1">
            <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-emerald-500/20 text-emerald-400 text-[10px] sm:text-xs font-semibold rounded-full">
              {formatGroupName(match.group) || formatStageName(match.stage)}
            </span>
            {/* Use venueDisplay from MatchWithLiveInfo if available, otherwise fall back to match.venue */}
            {hasLiveInfo(match) && match.venueDisplay ? (
              <span className="text-white/40 text-[10px] sm:text-xs">
                📍 {match.venueDisplay}
              </span>
            ) : (
              match.venue && (
                <span className="text-white/40 text-[10px] sm:text-xs">
                  📍 {match.venue}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
