"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { useMatches } from "@/contexts/MatchContext";
import MatchCard from "@/components/MatchCard";
import { GlobalLiveIndicator } from "@/components/MatchStatus";

interface TodaysMatchesProps {
  /** Filter matches to show only today's or all */
  showTodayOnly?: boolean;
  /** Show next match day section */
  showNextMatchDay?: boolean;
}

/**
 * Client component that displays matches from the global context
 * Shows today's matches by default, with live polling
 */
export default function TodaysMatches({
  showTodayOnly = true,
  showNextMatchDay = true,
}: TodaysMatchesProps) {
  const { matches, loading, hasLiveMatches, liveMatches, refresh } =
    useMatches();

  // Get today's date in ISO format
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // Get today's matches
  const todaysMatches = useMemo(() => {
    const filtered = matches.filter(
      (m) => m.utcDate.split("T")[0] === todayStr,
    );
    return [...filtered].sort(
      (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
    );
  }, [matches, todayStr]);

  // Find the next match day after today
  const nextMatchDay = useMemo(() => {
    if (!showNextMatchDay) return null;

    // Get all unique dates after today
    const futureDates = new Set<string>();
    matches.forEach((m) => {
      const matchDate = m.utcDate.split("T")[0];
      if (matchDate > todayStr) {
        futureDates.add(matchDate);
      }
    });

    // Sort dates and get the first one
    const sortedDates = Array.from(futureDates).sort();
    return sortedDates[0] || null;
  }, [matches, todayStr, showNextMatchDay]);

  // Get matches for the next match day
  const nextDayMatches = useMemo(() => {
    if (!nextMatchDay) return [];
    const filtered = matches.filter(
      (m) => m.utcDate.split("T")[0] === nextMatchDay,
    );
    return [...filtered].sort(
      (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
    );
  }, [matches, nextMatchDay]);

  // Filter to today's matches only if requested, otherwise show all
  const displayMatches = showTodayOnly ? todaysMatches : matches;

  // Sort by time
  const sortedMatches = [...displayMatches].sort(
    (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
  );

  if (loading) {
    return (
      <div className="glass-card p-12 text-center">
        <div className="text-white/60">Loading matches...</div>
      </div>
    );
  }

  // Format the next match day for display
  const formatNextMatchDay = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00Z");
    return format(date, "EEEE, MMMM d");
  };

  return (
    <div className="space-y-8">
      {/* Live indicator */}
      {hasLiveMatches && (
        <div>
          <GlobalLiveIndicator
            hasLiveMatches={hasLiveMatches}
            liveCount={liveMatches.length}
            onClick={refresh}
          />
        </div>
      )}

      {/* Today's matches */}
      {sortedMatches.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="text-6xl mb-4">⚽</div>
          <p className="text-xl text-white/80 font-medium">No matches today</p>
          <p className="text-white/50 mt-2">
            {nextMatchDay
              ? `Next matches on ${formatNextMatchDay(nextMatchDay)}`
              : "The World Cup starts June 11, 2026!"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sortedMatches.map((match) => (
            <MatchCard key={match.id} match={match} showDate />
          ))}
        </div>
      )}

      {/* Next match day section */}
      {showNextMatchDay && nextMatchDay && nextDayMatches.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4 mt-8">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <span className="text-lg">📆</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Next Match Day
              </h3>
              <p className="text-white/50 text-sm">
                {formatNextMatchDay(nextMatchDay)}
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {nextDayMatches.map((match) => (
              <MatchCard key={match.id} match={match} showDate />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
