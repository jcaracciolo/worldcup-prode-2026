"use client";

import { useMemo } from "react";
import FixtureRow from "@/components/FixtureRow";
import StandingsTable from "@/components/StandingsTable";
import { GlobalLiveIndicator } from "@/components/MatchStatus";
import { useMatches } from "@/contexts/MatchContext";
import { useSimulation } from "@/contexts/SimulationContext";
import { buildApiToFifaMapping } from "@/lib/api-client";
import { getQualifyingThirdPlaceTeams } from "@/lib/third-place-ranking";
import { Match, CalculatedStanding, Team } from "@/types/football";

// Get human-readable stage name
const getKnockoutStageName = (stage: string): string => {
  const stageNames: Record<string, string> = {
    LAST_32: "Round of 32",
    LAST_16: "Round of 16",
    QUARTER_FINALS: "Quarter-Finals",
    SEMI_FINALS: "Semi-Finals",
    THIRD_PLACE: "3rd Place",
    FINAL: "Final",
  };
  return stageNames[stage] || stage.replace(/_/g, " ");
};

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

// Knockout Section Component
function KnockoutSection({
  knockoutStages,
  apiToFifaMap,
}: {
  knockoutStages: Map<string, Match[]>;
  apiToFifaMap: Map<number, number>;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
          <span className="text-xl">⚔️</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Knockout Stage</h2>
          <p className="text-white/50 text-sm">Single elimination rounds</p>
        </div>
      </div>

      <div className="space-y-6">
        {[
          "LAST_32",
          "LAST_16",
          "QUARTER_FINALS",
          "SEMI_FINALS",
          "THIRD_PLACE",
          "FINAL",
        ].map((stage) => {
          const stageMatches = knockoutStages.get(stage) || [];
          if (stageMatches.length === 0) return null;

          const stageName = getKnockoutStageName(stage);
          const sortedMatches = [...stageMatches].sort(
            (a, b) =>
              new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
          );

          return (
            <div key={stage} className="glass-card p-5">
              <h3 className="font-bold text-lg mb-4 text-white">{stageName}</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {sortedMatches.map((match) => {
                  const fifaNumber = apiToFifaMap.get(match.id);
                  return (
                    <FixtureRow
                      key={match.id}
                      match={match}
                      fifaMatchNumber={fifaNumber}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Group Stage Section Component
function GroupStageSection({
  groups,
  groupStandings,
  thirdPlaceQualifying,
  apiToFifaMap,
}: {
  groups: Map<string, Match[]>;
  groupStandings: Map<string, CalculatedStanding[]>;
  thirdPlaceQualifying: Map<string, boolean>;
  apiToFifaMap: Map<number, number>;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
          <span className="text-xl">🏆</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Group Stage</h2>
          <p className="text-white/50 text-sm">48 teams in 12 groups</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from(groups.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([groupName, groupMatchList]) => {
            const standings = groupStandings.get(groupName) || [];
            const sortedMatches = [...groupMatchList].sort(
              (a, b) =>
                new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
            );
            const finishedInGroup = sortedMatches.filter(
              (m) => m.status === "FINISHED",
            ).length;

            return (
              <div key={groupName} className="glass-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-4 py-2 bg-emerald-500/20 text-emerald-400 text-xl font-bold rounded-lg">
                    {groupName.replace("GROUP_", "Group ")}
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Matches */}
                  <div>
                    <h4 className="text-sm font-medium text-white/50 mb-3 uppercase tracking-wider">
                      Matches
                    </h4>
                    <div className="space-y-1">
                      {sortedMatches.map((match) => {
                        const fifaNumber = apiToFifaMap.get(match.id);
                        return (
                          <FixtureRow
                            key={match.id}
                            match={match}
                            fifaMatchNumber={fifaNumber}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Standings Table */}
                  {standings.length > 0 && finishedInGroup > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-white/50 mb-3 uppercase tracking-wider">
                        Standings
                      </h4>
                      <StandingsTable
                        standings={standings}
                        disabled={true}
                        thirdPlaceQualifies={
                          thirdPlaceQualifying.get(groupName) || false
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
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
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Fixtures</h1>
            <p className="text-white/50 mt-1">
              All World Cup 2026 matches and results
            </p>
            <div className="mt-2">
              <GlobalLiveIndicator
                hasLiveMatches={hasLiveMatches}
                liveCount={liveMatches.length}
                onClick={refreshMatches}
              />
            </div>
          </div>

          {/* Stats Summary */}
          <div className="flex gap-4 text-sm">
            <div className="glass-card px-4 py-2">
              <span className="text-white/50">Finished</span>
              <span className="ml-2 text-white font-bold">
                {stats.finished}
              </span>
            </div>
            {stats.live > 0 && (
              <div className="glass-card px-4 py-2 bg-red-500/20 border-red-500/30">
                <span className="text-red-400">Live</span>
                <span className="ml-2 text-white font-bold">{stats.live}</span>
              </div>
            )}
            <div className="glass-card px-4 py-2">
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
              <KnockoutSection
                knockoutStages={knockoutStages}
                apiToFifaMap={apiToFifaMap}
              />
            )}

            {/* Group Stage */}
            <GroupStageSection
              groups={groups}
              groupStandings={groupStandings}
              thirdPlaceQualifying={thirdPlaceQualifying}
              apiToFifaMap={apiToFifaMap}
            />
          </>
        ) : (
          <>
            {/* Group Stage */}
            <GroupStageSection
              groups={groups}
              groupStandings={groupStandings}
              thirdPlaceQualifying={thirdPlaceQualifying}
              apiToFifaMap={apiToFifaMap}
            />

            {/* Knockout Stage */}
            {knockoutStages.size > 0 && (
              <KnockoutSection
                knockoutStages={knockoutStages}
                apiToFifaMap={apiToFifaMap}
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
