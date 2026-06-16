"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { useMatches } from "@/contexts/MatchContext";
import MatchCard from "@/components/MatchCard";
import { GlobalLiveIndicator } from "@/components/MatchStatus";
import { useScrollToLiveMatch } from "@/hooks/useScrollToLiveMatch";
import { useMatchDayNav } from "@/hooks/useMatchDayNav";

/**
 * Client component that displays matches for the selected match day.
 * Arrows let the user browse past/future days. Defaults to today.
 */
export default function TodaysMatches() {
  const { matches, loading, hasLiveMatches, liveMatches } = useMatches();
  const scrollToFirstLiveMatch = useScrollToLiveMatch();
  const { selectedDay, dayMatches, isToday, canPrev, canNext, prev, next, goToday } =
    useMatchDayNav();

  // Determine tournament phase for empty-state message
  const tournamentPhase = useMemo(() => {
    if (matches.length === 0) return "before";
    const allFinished = matches.every((m) => m.status === "FINISHED");
    if (allFinished) return "after";
    return "during";
  }, [matches]);

  if (loading && matches.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <div className="text-white/60">Loading matches...</div>
      </div>
    );
  }

  const formatDay = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00Z");
    return format(date, "EEEE, MMMM d");
  };

  const title = isToday ? "Today's Matches" : "Upcoming Matches";
  const subtitle = selectedDay ? formatDay(selectedDay) : null;

  return (
    <div className="space-y-4">
      {/* Live indicator */}
      {hasLiveMatches && isToday && (
        <div>
          <GlobalLiveIndicator
            hasLiveMatches={hasLiveMatches}
            liveCount={liveMatches.length}
            onClick={scrollToFirstLiveMatch}
          />
        </div>
      )}

      {/* Header with navigation arrows */}
      {selectedDay && (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
            <span className="text-lg sm:text-xl">📅</span>
          </div>
          <div className="flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              {title}
            </h2>
            {subtitle && (
              <p className="text-white/50 text-xs sm:text-sm">
                {subtitle}
              </p>
            )}
          </div>
          {!isToday && (
            <button
              onClick={goToday}
              className="px-2 py-1 rounded-lg text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
            >
              Today
            </button>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={prev}
              disabled={!canPrev}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-colors disabled:text-white/20 disabled:bg-white/[0.02] disabled:hover:bg-white/[0.02]"
              aria-label="Previous match day"
            >
              ‹
            </button>
            <button
              onClick={next}
              disabled={!canNext}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-colors disabled:text-white/20 disabled:bg-white/[0.02] disabled:hover:bg-white/[0.02]"
              aria-label="Next match day"
            >
              ›
            </button>
          </div>
        </div>
      )}

      {/* Matches grid */}
      {dayMatches.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="text-6xl mb-4">⚽</div>
          <p className="text-xl text-white/80 font-medium">No matches today</p>
          <p className="text-white/50 mt-2">
            {tournamentPhase === "after"
              ? "The World Cup has ended. See you next time!"
              : tournamentPhase === "during"
                ? "Rest day — use the arrows to browse"
                : "The World Cup starts June 11, 2026!"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {dayMatches.map((match) => (
            <MatchCard key={match.id} match={match} showDate />
          ))}
        </div>
      )}
    </div>
  );
}
