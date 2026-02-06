"use client";

import { format } from "date-fns";
import { MatchWithLiveInfo } from "@/contexts/MatchContext";

interface MatchStatusBadgeProps {
  match: MatchWithLiveInfo;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show elapsed time for live matches */
  showElapsed?: boolean;
}

/**
 * Badge component showing match status with live indicator
 */
export function MatchStatusBadge({
  match,
  size = "md",
  showElapsed = true,
}: MatchStatusBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-xs px-3 py-1",
    lg: "text-sm px-4 py-1.5",
  };

  if (match.isLive) {
    const elapsedText =
      match.elapsedMinutes !== null ? `${match.elapsedMinutes}'` : "";
    const periodText = match.period === "HALF_TIME" ? "HT" : elapsedText;

    return (
      <div className="flex items-center gap-2">
        <span
          className={`bg-red-500 text-white font-bold rounded-full live-pulse ${sizeClasses[size]}`}
        >
          LIVE
        </span>
        {showElapsed && periodText && (
          <span
            className={`text-red-400 font-semibold ${size === "sm" ? "text-xs" : "text-sm"}`}
          >
            {periodText}
          </span>
        )}
      </div>
    );
  }

  if (match.status === "FINISHED") {
    return (
      <span
        className={`bg-slate-600 text-white font-semibold rounded-full ${sizeClasses[size]}`}
      >
        FT
      </span>
    );
  }

  if (match.status === "SCHEDULED" || match.status === "TIMED") {
    const matchDate = new Date(match.utcDate);
    return (
      <span
        className={`text-emerald-400 font-bold ${size === "lg" ? "text-lg" : ""}`}
      >
        {format(matchDate, "HH:mm")}
      </span>
    );
  }

  // Other statuses (POSTPONED, SUSPENDED, etc.)
  return (
    <span
      className={`bg-amber-500 text-white font-semibold rounded-full ${sizeClasses[size]}`}
    >
      {match.status}
    </span>
  );
}

interface MatchScoreDisplayProps {
  match: MatchWithLiveInfo;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

/**
 * Component showing the match score with proper styling for live/finished
 */
export function MatchScoreDisplay({
  match,
  size = "md",
}: MatchScoreDisplayProps) {
  const homeGoals = match.score.fullTime.home;
  const awayGoals = match.score.fullTime.away;
  const hasScore = homeGoals !== null && awayGoals !== null;

  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  };

  if (!hasScore && !match.isLive) {
    return (
      <div className={`text-slate-300 font-light ${sizeClasses[size]}`}>vs</div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`font-bold ${sizeClasses[size]} ${
          match.isLive ? "text-red-500" : "text-slate-800"
        }`}
      >
        {homeGoals ?? 0}
      </span>
      <span
        className={`text-slate-400 ${size === "sm" ? "text-sm" : "text-lg"}`}
      >
        -
      </span>
      <span
        className={`font-bold ${sizeClasses[size]} ${
          match.isLive ? "text-red-500" : "text-slate-800"
        }`}
      >
        {awayGoals ?? 0}
      </span>
    </div>
  );
}

interface LiveIndicatorProps {
  /** Whether to show a pulse animation */
  pulse?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

/**
 * Simple live indicator dot with optional pulse animation
 */
export function LiveIndicator({
  pulse = true,
  size = "md",
}: LiveIndicatorProps) {
  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  };

  return (
    <span
      className={`inline-block rounded-full bg-red-500 ${sizeClasses[size]} ${
        pulse ? "animate-pulse" : ""
      }`}
      title="Live"
    />
  );
}

interface GlobalLiveIndicatorProps {
  hasLiveMatches: boolean;
  liveCount: number;
  onClick?: () => void;
}

/**
 * Global live indicator for header/nav showing if any matches are live
 */
export function GlobalLiveIndicator({
  hasLiveMatches,
  liveCount,
  onClick,
}: GlobalLiveIndicatorProps) {
  if (!hasLiveMatches) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-full hover:bg-red-500/30 transition-colors"
    >
      <LiveIndicator size="sm" />
      <span className="text-red-400 text-sm font-medium">
        {liveCount} {liveCount === 1 ? "match" : "matches"} live
      </span>
    </button>
  );
}

interface MatchTimeInfoProps {
  match: MatchWithLiveInfo;
}

/**
 * Full match time information including date and live status
 */
export function MatchTimeInfo({ match }: MatchTimeInfoProps) {
  const matchDate = new Date(match.utcDate);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-xs text-slate-500">
        {format(matchDate, "EEE, MMM d")}
      </div>
      <MatchStatusBadge match={match} />
    </div>
  );
}
