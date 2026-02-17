"use client";

import { useMemo } from "react";
import { GlobalLiveIndicator } from "@/components/MatchStatus";
import {
  GroupStageSection,
  KnockoutStageSection,
} from "@/components/predictions";
import { useMatches } from "@/contexts/MatchContext";
import { useTime } from "@/contexts/TimeContext";
import { useScrollToLiveMatch } from "@/hooks/useScrollToLiveMatch";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function FixturesPage() {
  // Use centralized match context
  const {
    matches,
    loading: matchesLoading,
    hasLiveMatches,
    liveMatches,
    liveBracket,
    groups,
    knockoutStages,
    refresh: refreshMatches,
  } = useMatches();

  const scrollToFirstLiveMatch = useScrollToLiveMatch();

  // Get stage lock status to determine section order
  const { stageLockStatus } = useTime();
  const showKnockoutFirst = stageLockStatus.knockoutStageLocked;

  // Standings and third-place qualifying come from the live bracket
  const thirdPlaceQualifying = liveBracket.thirdPlaceQualifying;

  // Count stats
  const stats = useMemo(() => {
    const finished = matches.filter((m) => m.status === "FINISHED").length;
    const live = matches.filter(
      (m) => m.status === "IN_PLAY" || m.status === "PAUSED",
    ).length;
    const scheduled = matches.filter(
      (m) => m.status === "SCHEDULED" || m.status === "TIMED",
    ).length;
    return { finished, live, scheduled, total: matches.length };
  }, [matches]);

  // Only show loading on initial load when we have no data
  if (matchesLoading && matches.length === 0) {
    return <LoadingSpinner message="Loading fixtures..." />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Fixtures
            </h1>
            <p className="text-white/50 mt-1 text-sm sm:text-base">
              All World Cup 2026 matches and results
            </p>
            <div className="mt-2">
              <GlobalLiveIndicator
                hasLiveMatches={hasLiveMatches}
                liveCount={liveMatches.length}
                onClick={scrollToFirstLiveMatch}
              />
            </div>
          </div>

          {/* Stats Summary */}
          <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm">
            <div className="glass-card px-3 sm:px-4 py-1.5 sm:py-2">
              <span className="text-white/50">Finished</span>
              <span className="ml-2 text-white font-bold">
                {stats.finished}
              </span>
            </div>
            {stats.live > 0 && (
              <div className="glass-card px-3 sm:px-4 py-1.5 sm:py-2 bg-red-500/20 border-red-500/30">
                <span className="text-red-400">Live</span>
                <span className="ml-2 text-white font-bold">{stats.live}</span>
              </div>
            )}
            <div className="glass-card px-3 sm:px-4 py-1.5 sm:py-2">
              <span className="text-white/50">Scheduled</span>
              <span className="ml-2 text-white font-bold">
                {stats.scheduled}
              </span>
            </div>
          </div>
        </div>

        {/* Show Group Stage first during group stage, Knockout first during knockouts */}
        {showKnockoutFirst ? (
          <>
            {/* Knockout Stage */}
            {knockoutStages.size > 0 && (
              <KnockoutStageSection
                knockoutStages={knockoutStages}
                readOnly={true}
              />
            )}

            {/* Group Stage */}
            <GroupStageSection
              groups={groups}
              thirdPlaceQualifying={thirdPlaceQualifying}
              groupStandings={liveBracket.groupStandings}
              readOnly={true}
            />
          </>
        ) : (
          <>
            {/* Group Stage */}
            <GroupStageSection
              groups={groups}
              thirdPlaceQualifying={thirdPlaceQualifying}
              groupStandings={liveBracket.groupStandings}
              readOnly={true}
            />

            {/* Knockout Stage */}
            {knockoutStages.size > 0 && (
              <KnockoutStageSection
                knockoutStages={knockoutStages}
                readOnly={true}
              />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-white/10 mt-auto">
        <div className="container mx-auto px-4 py-6 text-center">
          <p className="text-white/40 text-sm">
            WorldCupProde - FIFA World Cup 2026 Fixtures
          </p>
        </div>
      </footer>
    </div>
  );
}
