"use client";

import { useMemo, useCallback } from "react";
import { GlobalLiveIndicator } from "@/components/MatchStatus";
import {
  GroupStageSection,
  KnockoutStageSection,
} from "@/components/predictions";
import { useMatches } from "@/contexts/MatchContext";
import { useSimulation } from "@/contexts/SimulationContext";
import { buildApiToFifaMapping } from "@/lib/api-client";
import { getQualifyingThirdPlaceTeams } from "@/lib/third-place-ranking";
import { Match, CalculatedStanding, Team } from "@/types/football";

// Calculate standings from actual match results (not predictions)
function calculateActualStandings(groupMatches: Match[]): CalculatedStanding[] {
  const teamStats = new Map<number, CalculatedStanding>();

  // Initialize teams from matches
  groupMatches.forEach((match) => {
    if (!teamStats.has(match.homeTeam.id)) {
      teamStats.set(match.homeTeam.id, createEmptyStanding(match.homeTeam));
    }
    if (!teamStats.has(match.awayTeam.id)) {
      teamStats.set(match.awayTeam.id, createEmptyStanding(match.awayTeam));
    }
  });

  // Calculate stats from actual results
  groupMatches.forEach((match) => {
    if (match.status !== "FINISHED") return;

    const homeGoals = match.score.fullTime.home;
    const awayGoals = match.score.fullTime.away;
    if (homeGoals === null || awayGoals === null) return;

    const homeStats = teamStats.get(match.homeTeam.id)!;
    const awayStats = teamStats.get(match.awayTeam.id)!;

    homeStats.played++;
    awayStats.played++;

    homeStats.goalsFor += homeGoals;
    homeStats.goalsAgainst += awayGoals;
    awayStats.goalsFor += awayGoals;
    awayStats.goalsAgainst += homeGoals;

    homeStats.goalDifference = homeStats.goalsFor - homeStats.goalsAgainst;
    awayStats.goalDifference = awayStats.goalsFor - awayStats.goalsAgainst;

    if (homeGoals > awayGoals) {
      homeStats.won++;
      homeStats.points += 3;
      awayStats.lost++;
    } else if (awayGoals > homeGoals) {
      awayStats.won++;
      awayStats.points += 3;
      homeStats.lost++;
    } else {
      homeStats.drawn++;
      awayStats.drawn++;
      homeStats.points += 1;
      awayStats.points += 1;
    }
  });

  // Sort standings and assign positions
  const sorted = Array.from(teamStats.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference)
      return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });

  sorted.forEach((standing, index) => {
    standing.position = index + 1;
  });

  return sorted;
}

function createEmptyStanding(team: Team): CalculatedStanding {
  return {
    team,
    position: 0,
    points: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
  };
}

export default function FixturesPage() {
  // Use centralized match context
  const {
    matches,
    loading: matchesLoading,
    hasLiveMatches,
    liveMatches,
    refresh: refreshMatches,
    isSimulated,
  } = useMatches();

  // Scroll to first live match
  const scrollToFirstLiveMatch = useCallback(() => {
    const firstLiveMatch = document.querySelector('.live-match');
    if (firstLiveMatch) {
      firstLiveMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // Get stage lock status to determine section order
  const { stageLockStatus } = useSimulation();
  const showKnockoutFirst = stageLockStatus.knockoutStageLocked;

  // Organize matches by groups
  const groups = useMemo(() => {
    const groupMatches = matches.filter((m) => m.stage === "GROUP_STAGE");
    const groupMap = new Map<string, Match[]>();
    groupMatches.forEach((m) => {
      if (!m.group) return;
      if (!groupMap.has(m.group)) groupMap.set(m.group, []);
      groupMap.get(m.group)!.push(m);
    });
    return groupMap;
  }, [matches]);

  // Calculate standings for all groups
  const groupStandings = useMemo(() => {
    const standingsMap = new Map<string, CalculatedStanding[]>();
    groups.forEach((groupMatchList, groupName) => {
      standingsMap.set(groupName, calculateActualStandings(groupMatchList));
    });
    return standingsMap;
  }, [groups]);

  // Wrap calculateStandings to match the interface expected by GroupStageSection
  const calculateStandings = useCallback(
    (groupMatches: Match[], groupName?: string): CalculatedStanding[] => {
      if (groupName && groupStandings.has(groupName)) {
        return groupStandings.get(groupName)!;
      }
      return calculateActualStandings(groupMatches);
    },
    [groupStandings],
  );

  // Calculate which 3rd place teams qualify
  const thirdPlaceQualifying = useMemo(() => {
    return getQualifyingThirdPlaceTeams(groupStandings);
  }, [groupStandings]);

  // Organize knockout matches by stage
  const knockoutStages = useMemo(() => {
    const knockoutMatches = matches.filter((m) => m.stage !== "GROUP_STAGE");
    const stageMap = new Map<string, Match[]>();
    knockoutMatches.forEach((m) => {
      if (!stageMap.has(m.stage)) stageMap.set(m.stage, []);
      stageMap.get(m.stage)!.push(m);
    });
    return stageMap;
  }, [matches]);

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

  // Build API match ID to FIFA match number mapping
  const apiToFifaMap = useMemo(() => buildApiToFifaMapping(matches), [matches]);

  if (matchesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-white/60">Loading fixtures...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Fixtures</h1>
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

        {isSimulated && (
          <div className="bg-amber-500/20 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-xl mb-6">
            🧪 Simulation mode active — Match data is generated for testing
          </div>
        )}

        {/* Show Group Stage first during group stage, Knockout first during knockouts */}
        {showKnockoutFirst ? (
          <>
            {/* Knockout Stage */}
            {knockoutStages.size > 0 && (
              <KnockoutStageSection
                knockoutStages={knockoutStages}
                apiToFifaMap={apiToFifaMap}
                readOnly={true}
              />
            )}

            {/* Group Stage */}
            <GroupStageSection
              groups={groups}
              apiToFifaMap={apiToFifaMap}
              thirdPlaceQualifying={thirdPlaceQualifying}
              calculateStandings={calculateStandings}
              readOnly={true}
            />
          </>
        ) : (
          <>
            {/* Group Stage */}
            <GroupStageSection
              groups={groups}
              apiToFifaMap={apiToFifaMap}
              thirdPlaceQualifying={thirdPlaceQualifying}
              calculateStandings={calculateStandings}
              readOnly={true}
            />

            {/* Knockout Stage */}
            {knockoutStages.size > 0 && (
              <KnockoutStageSection
                knockoutStages={knockoutStages}
                apiToFifaMap={apiToFifaMap}
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
