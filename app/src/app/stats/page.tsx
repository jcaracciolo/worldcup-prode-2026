"use client";

import { useMemo } from "react";
import { useMatches } from "@/contexts/MatchContext";
import { useAllPredictions } from "@/contexts/PredictionsContext";
import { useAllProfiles, useUser } from "@/contexts/UserContext";
import { useTime } from "@/contexts/TimeContext";
import { buildScoreTimeline } from "@/lib/score-timeline";
import { computeStatTables } from "@/lib/stats-tables";
import { computeCompletedMatchDays } from "@/lib/daily-summary";
import ScoreTimelineChart from "@/components/stats/ScoreTimelineChart";
import StatTableCard from "@/components/stats/StatTableCard";
import DailySummary from "@/components/stats/DailySummary";

export default function StatsPage() {
  const { matches, loading: matchesLoading } = useMatches();
  const allPredictions = useAllPredictions();
  const profiles = useAllProfiles();
  const { user } = useUser();
  const { getCurrentTime, tick } = useTime();

  const inputsReady =
    !matchesLoading &&
    matches.length > 0 &&
    !!allPredictions.content &&
    !!profiles.content;

  const timeline = useMemo(() => {
    if (!inputsReady) return { rows: [], players: [] };
    return buildScoreTimeline(
      matches,
      allPredictions.content!,
      profiles.content!,
      getCurrentTime(),
    );
    // `tick` drives periodic refresh (live + simulation time advance)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputsReady, matches, allPredictions.content, profiles.content, tick]);

  const statTables = useMemo(() => {
    if (!inputsReady) return [];
    return computeStatTables(
      matches,
      allPredictions.content!,
      profiles.content!,
      user?.id ?? null,
      getCurrentTime(),
    );
    // `tick` drives periodic refresh (live + simulation time advance)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputsReady, matches, allPredictions.content, profiles.content, user?.id, tick]);

  const completedDays = useMemo(() => {
    if (!inputsReady) return [];
    return computeCompletedMatchDays(matches, getCurrentTime());
    // `tick` drives periodic refresh (live + simulation time advance)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputsReady, matches, tick]);

  const loading = !inputsReady;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-4 sm:py-8">
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-xl sm:text-2xl">📈</span>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Stats</h1>
            <p className="text-white/50 text-xs sm:text-sm">
              How the table has moved over time
            </p>
          </div>
        </div>

        {/* Score over time */}
        <section className="glass-card overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-xl sm:text-2xl">📊</span>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                Position Over Time
              </h2>
              <p className="text-emerald-100 text-xs sm:text-sm">
                Daily ranking — top of the chart leads
              </p>
            </div>
          </div>

          <div className="py-4 sm:py-6 sm:px-2">
            {loading ? (
              <div className="p-6 sm:p-8 text-center">
                <span className="text-3xl sm:text-4xl inline-block animate-bounce-spin">
                  ⚽
                </span>
                <p className="text-white/60 text-sm sm:text-base mt-3">
                  Loading stats…
                </p>
              </div>
            ) : (
              <ScoreTimelineChart
                timeline={timeline}
                currentUserId={user?.id ?? null}
              />
            )}
          </div>
        </section>

        {/* Stat leaderboards */}
        {!loading && statTables.length > 0 && (
          <section className="mt-6 sm:mt-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {statTables.map((table) => (
                <StatTableCard
                  key={table.key}
                  table={table}
                  currentUserId={user?.id ?? null}
                />
              ))}
            </div>
          </section>
        )}

        {/* Daily summary — award-style recap of a completed match day */}
        {!loading && completedDays.length > 0 && (
          <DailySummary
            matches={matches}
            allPredictions={allPredictions.content!}
            profiles={profiles.content!}
            now={getCurrentTime()}
            completedDays={completedDays}
            currentUserId={user?.id ?? null}
          />
        )}
      </main>

      <footer className="border-t border-white/10 mt-auto">
        <div className="container mx-auto px-4 py-4 sm:py-6 text-center">
          <p className="text-white/40 text-xs sm:text-sm">
            FIFA World Cup 2026 Predictions
          </p>
        </div>
      </footer>
    </div>
  );
}
