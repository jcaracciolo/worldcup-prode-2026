"use client";

import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { useMatches } from "@/contexts/MatchContext";
import { useTime } from "@/contexts/TimeContext";
import MatchCard from "@/components/MatchCard";
import { GlobalLiveIndicator } from "@/components/MatchStatus";
import { useScrollToLiveMatch } from "@/hooks/useScrollToLiveMatch";

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
  const { getCurrentTime } = useTime();

  const scrollToFirstLiveMatch = useScrollToLiveMatch();

  // Helper: get local date string (YYYY-MM-DD) from a UTC date string
  const toLocalDateStr = (utcDate: string) =>
    new Date(utcDate).toLocaleDateString("en-CA"); // en-CA gives YYYY-MM-DD

  // Get today's date in local YYYY-MM-DD format
  const today = getCurrentTime();
  const todayStr = today.toLocaleDateString("en-CA");

  // Get today's matches (comparing in local time)
  const todaysMatches = useMemo(() => {
    const filtered = matches.filter(
      (m) => toLocalDateStr(m.utcDate) === todayStr,
    );
    return [...filtered].sort(
      (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
    );
  }, [matches, todayStr]);

  // All future match days sorted chronologically
  const futureDates = useMemo(() => {
    if (!showNextMatchDay) return [];

    const dates = new Set<string>();
    matches.forEach((m) => {
      const matchLocalDate = toLocalDateStr(m.utcDate);
      if (matchLocalDate > todayStr) {
        dates.add(matchLocalDate);
      }
    });

    return Array.from(dates).sort();
  }, [matches, todayStr, showNextMatchDay]);

  // Index into futureDates for navigation
  const [futureDateIndex, setFutureDateIndex] = useState(0);

  // Reset to first future date when day changes
  useEffect(() => {
    setFutureDateIndex(0);
  }, [todayStr]);

  // Clamp index if futureDates shrinks
  const clampedIndex = Math.min(futureDateIndex, Math.max(futureDates.length - 1, 0));
  const selectedDate = futureDates[clampedIndex] || null;

  // Get matches for the selected future date
  const nextDayMatches = useMemo(() => {
    if (!selectedDate) return [];
    const filtered = matches.filter(
      (m) => toLocalDateStr(m.utcDate) === selectedDate,
    );
    return [...filtered].sort(
      (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
    );
  }, [matches, selectedDate]);

  // Determine tournament phase for empty-state message
  const tournamentPhase = useMemo(() => {
    if (matches.length === 0) return "before"; // no data loaded yet
    const allFinished = matches.every((m) => m.status === "FINISHED");
    if (allFinished) return "after";
    const firstMatchDate = matches
      .map((m) => toLocalDateStr(m.utcDate))
      .sort()[0];
    if (firstMatchDate && todayStr < firstMatchDate) return "before";
    return "during";
  }, [matches, todayStr]);

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
            onClick={scrollToFirstLiveMatch}
          />
        </div>
      )}

      {/* Today's matches */}
      {sortedMatches.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="text-6xl mb-4">⚽</div>
          <p className="text-xl text-white/80 font-medium">No matches today</p>
          <p className="text-white/50 mt-2">
            {selectedDate
              ? `Next matches on ${formatNextMatchDay(selectedDate)}`
              : tournamentPhase === "after"
                ? "The World Cup has ended. See you next time!"
                : tournamentPhase === "during"
                  ? "No more matches scheduled"
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

      {/* Next / upcoming match day section */}
      {showNextMatchDay && selectedDate && nextDayMatches.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4 mt-8">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <span className="text-lg">📆</span>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white">
                {clampedIndex === 0 ? "Next Match Day" : "Upcoming Matches"}
              </h3>
              <p className="text-white/50 text-sm">
                {formatNextMatchDay(selectedDate)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFutureDateIndex((i) => Math.max(0, i - 1))}
                disabled={clampedIndex === 0}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-colors disabled:text-white/20 disabled:bg-white/[0.02] disabled:hover:bg-white/[0.02]"
                aria-label="Previous match day"
              >
                ‹
              </button>
              <button
                onClick={() => setFutureDateIndex((i) => Math.min(futureDates.length - 1, i + 1))}
                disabled={clampedIndex >= futureDates.length - 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-colors disabled:text-white/20 disabled:bg-white/[0.02] disabled:hover:bg-white/[0.02]"
                aria-label="Next match day"
              >
                ›
              </button>
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
