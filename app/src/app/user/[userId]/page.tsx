import Header from "@/components/Header";
import PointsBreakdown from "@/components/PointsBreakdown";
import StandingsTable from "@/components/StandingsTable";
import { createClient } from "@/lib/supabase/server";
import { getQualifyingThirdPlaceTeams } from "@/lib/third-place-ranking";
import { calculateTotalPoints } from "@/lib/scoring";
import { notFound } from "next/navigation";
import { Match, CalculatedStanding } from "@/types/football";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function UserPredictionsPage({ params }: PageProps) {
  const { userId } = await params;
  const supabase = await createClient();

  // Get current user
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  let currentProfile = null;
  if (currentUser) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .single();
    currentProfile = data;
  }

  // Get target user profile
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!targetProfile) {
    notFound();
  }

  // Get tournament settings
  const { data: settings } = await supabase
    .from("tournament_settings")
    .select("*")
    .single();

  const groupLocked = settings?.group_stage_locked || false;
  const knockoutLocked = settings?.knockout_stage_locked || false;
  const isOwnPredictions = currentUser?.id === userId;

  // Get predictions
  const { data: predictions } = await supabase
    .from("predictions")
    .select("*")
    .eq("user_id", userId);

  // Get group standings overrides
  const { data: groupOverrides } = await supabase
    .from("group_standings_overrides")
    .select("*")
    .eq("user_id", userId);

  // Get matches from API
  let matches: Match[] = [];
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/matches`,
      {
        cache: "no-store",
      },
    );
    const data = await res.json();
    matches = data.matches || [];
  } catch (error) {
    console.error("Failed to fetch matches:", error);
  }

  const predictionMap = new Map(predictions?.map((p) => [p.match_id, p]) || []);

  // Calculate standings from predictions
  const calculateStandings = (groupMatches: Match[]): CalculatedStanding[] => {
    const teamStats = new Map<number, CalculatedStanding>();

    groupMatches.forEach((match) => {
      if (!teamStats.has(match.homeTeam.id)) {
        teamStats.set(match.homeTeam.id, {
          team: match.homeTeam,
          position: 0,
          points: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
        });
      }
      if (!teamStats.has(match.awayTeam.id)) {
        teamStats.set(match.awayTeam.id, {
          team: match.awayTeam,
          position: 0,
          points: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
        });
      }
    });

    groupMatches.forEach((match) => {
      const prediction = predictionMap.get(match.id);
      if (
        !prediction ||
        prediction.home_goals === null ||
        prediction.away_goals === null
      )
        return;

      const homeStats = teamStats.get(match.homeTeam.id)!;
      const awayStats = teamStats.get(match.awayTeam.id)!;

      homeStats.played++;
      awayStats.played++;
      homeStats.goalsFor += prediction.home_goals;
      homeStats.goalsAgainst += prediction.away_goals;
      awayStats.goalsFor += prediction.away_goals;
      awayStats.goalsAgainst += prediction.home_goals;
      homeStats.goalDifference = homeStats.goalsFor - homeStats.goalsAgainst;
      awayStats.goalDifference = awayStats.goalsFor - awayStats.goalsAgainst;

      if (prediction.home_goals > prediction.away_goals) {
        homeStats.won++;
        homeStats.points += 3;
        awayStats.lost++;
      } else if (prediction.away_goals > prediction.home_goals) {
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

    return Array.from(teamStats.values())
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference)
          return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
      })
      .map((s, i) => ({ ...s, position: i + 1 }));
  };

  const groupMatches = matches.filter((m) => m.stage === "GROUP_STAGE");
  const groups = new Map<string, Match[]>();
  groupMatches.forEach((m) => {
    if (!m.group) return;
    if (!groups.has(m.group)) groups.set(m.group, []);
    groups.get(m.group)!.push(m);
  });

  // Pre-calculate standings for all groups to determine 3rd place qualifiers
  const allGroupStandings = new Map<string, CalculatedStanding[]>();
  groups.forEach((groupMatchList, groupName) => {
    allGroupStandings.set(groupName, calculateStandings(groupMatchList));
  });
  const thirdPlaceQualifying = getQualifyingThirdPlaceTeams(allGroupStandings);

  // Calculate actual standings from actual match results (for scoring)
  const calculateActualStandings = (
    groupMatches: Match[],
  ): CalculatedStanding[] => {
    const teamStats = new Map<number, CalculatedStanding>();

    groupMatches.forEach((match) => {
      if (!teamStats.has(match.homeTeam.id)) {
        teamStats.set(match.homeTeam.id, {
          team: match.homeTeam,
          position: 0,
          points: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
        });
      }
      if (!teamStats.has(match.awayTeam.id)) {
        teamStats.set(match.awayTeam.id, {
          team: match.awayTeam,
          position: 0,
          points: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
        });
      }
    });

    groupMatches.forEach((match) => {
      // Use actual results
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

    return Array.from(teamStats.values())
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference)
          return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
      })
      .map((s, i) => ({ ...s, position: i + 1 }));
  };

  // Calculate actual group standings (from real results)
  const actualGroupStandings = new Map<string, CalculatedStanding[]>();
  groups.forEach((groupMatchList, groupName) => {
    actualGroupStandings.set(
      groupName,
      calculateActualStandings(groupMatchList),
    );
  });

  // Determine which teams actually advanced (1st, 2nd, + best 8 3rds)
  const actualThirdPlaceQualifying =
    getQualifyingThirdPlaceTeams(actualGroupStandings);
  const advancingTeamIds = new Set<number>();
  actualGroupStandings.forEach((standings, groupName) => {
    standings.forEach((standing, index) => {
      if (index < 2) {
        // 1st and 2nd always advance
        advancingTeamIds.add(standing.team.id);
      } else if (index === 2 && actualThirdPlaceQualifying.get(groupName)) {
        // 3rd advances if in best 8
        advancingTeamIds.add(standing.team.id);
      }
    });
  });

  // Calculate points
  const { totalPoints, breakdown } = calculateTotalPoints(
    matches,
    predictions || [],
    groupOverrides || [],
    actualGroupStandings,
    advancingTeamIds,
  );

  // Show blurred state for predictions not yet visible
  const showGroupPredictions = isOwnPredictions || groupLocked;
  const showKnockoutPredictions = isOwnPredictions || knockoutLocked;

  return (
    <div className="min-h-screen">
      <Header user={currentProfile} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">
            {targetProfile.display_name}&apos;s Predictions
          </h1>
          {isOwnPredictions && (
            <p className="text-white/50 text-sm mt-1">This is you!</p>
          )}
        </div>

        {/* Group Stage */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4 border-b border-white/10 pb-2 text-white">
            Group Stage
          </h2>

          {!showGroupPredictions ? (
            <div className="glass-card p-8 text-center blur-sm select-none">
              <p className="text-white/50">
                Predictions will be visible after group stage starts
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {Array.from(groups.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([groupName, groupMatchList]) => {
                  const standings = calculateStandings(groupMatchList);
                  return (
                    <div key={groupName} className="glass-card p-4">
                      <h3 className="font-bold text-lg mb-3 text-white">
                        {groupName.replace("GROUP_", "Group ")}
                      </h3>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-white/50 mb-2">
                            Predictions
                          </h4>
                          {groupMatchList.map((match) => {
                            const pred = predictionMap.get(match.id);
                            return (
                              <div
                                key={match.id}
                                className="flex items-center gap-2 py-2 text-sm"
                              >
                                <span className="flex-1 text-right text-white/80">
                                  {match.homeTeam.tla}
                                </span>
                                <span className="w-16 text-center font-bold text-white">
                                  {pred?.home_goals ?? "-"} -{" "}
                                  {pred?.away_goals ?? "-"}
                                </span>
                                <span className="flex-1 text-white/80">
                                  {match.awayTeam.tla}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        <div>
                          <h4 className="text-sm font-medium text-white/50 mb-2">
                            Standings
                          </h4>
                          <StandingsTable
                            standings={standings}
                            disabled
                            thirdPlaceQualifies={
                              thirdPlaceQualifying.get(groupName) || false
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        {/* Knockout Stage */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4 border-b border-white/10 pb-2 text-white">
            Knockout Stage
          </h2>

          {!showKnockoutPredictions ? (
            <div className="glass-card p-8 text-center blur-sm select-none">
              <p className="text-white/50">
                Predictions will be visible after knockout stage starts
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {(() => {
                const knockoutStages = [
                  { stage: "LAST_32", name: "Round of 32" },
                  { stage: "LAST_16", name: "Round of 16" },
                  { stage: "QUARTER_FINALS", name: "Quarter-Finals" },
                  { stage: "SEMI_FINALS", name: "Semi-Finals" },
                  { stage: "THIRD_PLACE", name: "Third Place" },
                  { stage: "FINAL", name: "Final" },
                ];

                const knockoutMatches = matches.filter(
                  (m) => m.stage !== "GROUP_STAGE",
                );

                if (knockoutMatches.length === 0) {
                  return (
                    <div className="text-white/50 text-center py-8">
                      No knockout matches available yet
                    </div>
                  );
                }

                return knockoutStages.map(({ stage, name }) => {
                  const stageMatches = knockoutMatches
                    .filter((m) => m.stage === stage)
                    .sort(
                      (a, b) =>
                        new Date(a.utcDate).getTime() -
                        new Date(b.utcDate).getTime(),
                    );

                  if (stageMatches.length === 0) return null;

                  return (
                    <div key={stage} className="glass-card p-4">
                      <h3 className="font-bold text-lg mb-3 text-white">
                        {name}
                      </h3>
                      <div className="space-y-2">
                        {stageMatches.map((match) => {
                          const pred = predictionMap.get(match.id);
                          const matchDate = new Date(match.utcDate);
                          const isTie =
                            pred?.home_goals !== null &&
                            pred?.away_goals !== null &&
                            pred?.home_goals === pred?.away_goals;
                          const winnerTeam = pred?.winner_id
                            ? match.homeTeam.id === pred.winner_id
                              ? match.homeTeam
                              : match.awayTeam
                            : null;

                          return (
                            <div
                              key={match.id}
                              className="flex items-center gap-3 py-3 px-4 rounded-xl bg-slate-800/60 border border-white/5"
                            >
                              {/* Date */}
                              <div className="w-16 text-center shrink-0">
                                <div className="text-xs text-white/50">
                                  {matchDate.toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </div>
                              </div>

                              {/* Home Team */}
                              <div className="w-28 flex items-center justify-end gap-2">
                                <span className="text-sm font-semibold text-white truncate">
                                  {match.homeTeam.tla || "TBD"}
                                </span>
                                {match.homeTeam.crest ? (
                                  <img
                                    src={match.homeTeam.crest}
                                    alt={match.homeTeam.name}
                                    className="w-6 h-6 object-contain shrink-0"
                                  />
                                ) : (
                                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-[10px] font-bold text-white/60 shrink-0">
                                    ?
                                  </div>
                                )}
                              </div>

                              {/* Score */}
                              <div className="flex items-center gap-2 mx-2">
                                <span className="w-8 h-8 flex items-center justify-center text-lg font-bold bg-white/10 rounded text-white">
                                  {pred?.home_goals ?? "-"}
                                </span>
                                <span className="text-white/50">-</span>
                                <span className="w-8 h-8 flex items-center justify-center text-lg font-bold bg-white/10 rounded text-white">
                                  {pred?.away_goals ?? "-"}
                                </span>
                              </div>

                              {/* Away Team */}
                              <div className="w-28 flex items-center gap-2">
                                {match.awayTeam.crest ? (
                                  <img
                                    src={match.awayTeam.crest}
                                    alt={match.awayTeam.name}
                                    className="w-6 h-6 object-contain shrink-0"
                                  />
                                ) : (
                                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-[10px] font-bold text-white/60 shrink-0">
                                    ?
                                  </div>
                                )}
                                <span className="text-sm font-semibold text-white truncate">
                                  {match.awayTeam.tla || "TBD"}
                                </span>
                              </div>

                              {/* Winner indicator for ties */}
                              {isTie && winnerTeam && (
                                <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded bg-emerald-600/30 text-emerald-400 text-xs">
                                  <span>🏆</span>
                                  <span>{winnerTeam.tla}</span>
                                </div>
                              )}
                              {isTie && !winnerTeam && (
                                <div className="ml-auto px-2 py-1 rounded bg-yellow-600/30 text-yellow-400 text-xs">
                                  No winner selected
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </section>

        {/* Points Breakdown */}
        {(groupLocked || knockoutLocked) && (
          <section>
            <PointsBreakdown breakdown={breakdown} totalPoints={totalPoints} />
          </section>
        )}
      </main>

      <footer className="bg-black/20 text-white py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-sm">
          <p className="text-white/50">
            WorldCupProde - FIFA World Cup 2026 Predictions
          </p>
        </div>
      </footer>
    </div>
  );
}
