import Header from "@/components/Header";
import PointsBreakdown from "@/components/PointsBreakdown";
import StandingsTable from "@/components/StandingsTable";
import MatchPointsTooltip from "@/components/MatchPointsTooltip";
import R32Preview from "@/components/R32Preview";
import { createClient } from "@/lib/supabase/server";
import { getQualifyingThirdPlaceTeams } from "@/lib/third-place-ranking";
import { calculateTotalPoints, getTeamDisplayName } from "@/lib/scoring";
import { BracketResolver } from "@/lib/bracket-resolver";
import { getMatchInfo, Venue } from "@/lib/tournament";
import { buildApiToFifaMapping } from "@/lib/api-client";
import { getStageLockStatus } from "@/lib/time";
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

  // Get stage lock status based on current time
  const {
    groupStageLocked: groupLocked,
    knockoutStageOpen: knockoutOpen,
    knockoutStageLocked: knockoutLocked,
  } = getStageLockStatus();
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

  // Use BracketResolver to resolve knockout teams based on predictions
  const resolver = new BracketResolver({
    matches,
    predictions: predictionMap,
    groupStandings: allGroupStandings,
    thirdPlaceQualifying,
  });
  const resolvedKnockoutTeams = resolver.resolve();

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

  // Build API match ID to FIFA match number mapping for venue lookup
  const apiToFifaMap = buildApiToFifaMapping(matches);

  // Helper to get venue by match - uses centralized tournament data
  const getMatchVenue = (match: Match): Venue | null => {
    const fifaNum = apiToFifaMap.get(match.id);
    if (fifaNum) {
      const matchInfo = getMatchInfo(fifaNum);
      return matchInfo?.venue || null;
    }
    return null;
  };

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

        {/* Knockout Stage - shown first when knockout is locked */}
        {knockoutLocked && (
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4 border-b border-white/10 pb-2 text-white">
              Knockout Stage
            </h2>

            <div className="space-y-6">
              {(() => {
                const knockoutStagesData = [
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

                return knockoutStagesData.map(({ stage, name }) => {
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
                      <div className="grid md:grid-cols-2 gap-3">
                        {stageMatches.map((match) => {
                          const pred = predictionMap.get(match.id);
                          const matchDate = new Date(match.utcDate);
                          const resolved = resolvedKnockoutTeams.get(match.id);
                          const homeTeam =
                            resolved?.home ||
                            (match.homeTeam?.id ? match.homeTeam : null);
                          const awayTeam =
                            resolved?.away ||
                            (match.awayTeam?.id ? match.awayTeam : null);
                          const venue = getMatchVenue(match);

                          // Determine winner highlight
                          const homeGoals = pred?.home_goals;
                          const awayGoals = pred?.away_goals;
                          const hasScore =
                            homeGoals !== null &&
                            homeGoals !== undefined &&
                            awayGoals !== null &&
                            awayGoals !== undefined;
                          const homeWinsOnScore =
                            hasScore && homeGoals > awayGoals;
                          const awayWinsOnScore =
                            hasScore && awayGoals > homeGoals;
                          const isTie = hasScore && homeGoals === awayGoals;
                          // For knockout, highlight winner by score or by winner_id selection on ties
                          const homeHighlight =
                            homeWinsOnScore ||
                            (isTie && pred?.winner_id === homeTeam?.id);
                          const awayHighlight =
                            awayWinsOnScore ||
                            (isTie && pred?.winner_id === awayTeam?.id);

                          const formattedDate = matchDate.toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                            },
                          );
                          const formattedTime = matchDate.toLocaleTimeString(
                            "en-US",
                            {
                              hour: "numeric",
                              minute: "2-digit",
                            },
                          );

                          return (
                            <div
                              key={match.id}
                              className="flex items-center py-3 px-4 rounded-xl bg-slate-800/60 border border-white/5"
                            >
                              {/* Date */}
                              <div className="w-20 text-center shrink-0 pr-3 border-r border-white/10">
                                <div
                                  className="text-sm uppercase font-bold tracking-wide whitespace-nowrap"
                                  style={{ color: "var(--date-color)" }}
                                >
                                  {formattedDate}
                                </div>
                              </div>

                              {/* Time & Venue */}
                              <div className="w-28 shrink-0 px-3 border-r border-white/10">
                                <div className="text-sm text-white/70 font-medium">
                                  {formattedTime}
                                </div>
                                {venue && (
                                  <div
                                    className="text-sm font-semibold truncate"
                                    style={{ color: "var(--venue-color)" }}
                                  >
                                    {venue.city}
                                  </div>
                                )}
                              </div>

                              {/* Match */}
                              <div className="flex-1 flex items-center justify-center pl-4">
                                {/* Home Team */}
                                <div
                                  className={`flex items-center justify-end gap-2 px-2 py-1 rounded-lg ${
                                    homeHighlight
                                      ? "bg-amber-500/80 text-slate-900"
                                      : ""
                                  }`}
                                >
                                  <span
                                    className={`text-sm font-semibold truncate ${
                                      homeHighlight
                                        ? "text-slate-900"
                                        : "text-white"
                                    }`}
                                  >
                                    {getTeamDisplayName(
                                      homeTeam,
                                      match.id,
                                      "home",
                                    )}
                                  </span>
                                  {homeTeam?.crest ? (
                                    <img
                                      src={homeTeam.crest}
                                      alt={homeTeam.name}
                                      className="w-7 h-7 object-contain shrink-0"
                                    />
                                  ) : (
                                    <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-[10px] font-bold text-white/60 shrink-0">
                                      {homeTeam?.tla?.substring(0, 2) || "?"}
                                    </div>
                                  )}
                                </div>

                                {/* Score */}
                                <div className="flex items-center gap-2 mx-4">
                                  <span className="w-10 h-9 flex items-center justify-center text-lg font-bold bg-white/90 rounded-lg text-slate-800">
                                    {pred?.home_goals ?? "-"}
                                  </span>
                                  <span className="text-white/50 font-bold">
                                    -
                                  </span>
                                  <span className="w-10 h-9 flex items-center justify-center text-lg font-bold bg-white/90 rounded-lg text-slate-800">
                                    {pred?.away_goals ?? "-"}
                                  </span>
                                </div>

                                {/* Away Team */}
                                <div
                                  className={`flex items-center gap-2 px-2 py-1 rounded-lg ${
                                    awayHighlight
                                      ? "bg-amber-500/80 text-slate-900"
                                      : ""
                                  }`}
                                >
                                  {awayTeam?.crest ? (
                                    <img
                                      src={awayTeam.crest}
                                      alt={awayTeam.name}
                                      className="w-7 h-7 object-contain shrink-0"
                                    />
                                  ) : (
                                    <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-[10px] font-bold text-white/60 shrink-0">
                                      {awayTeam?.tla?.substring(0, 2) || "?"}
                                    </div>
                                  )}
                                  <span
                                    className={`text-sm font-semibold truncate ${
                                      awayHighlight
                                        ? "text-slate-900"
                                        : "text-white"
                                    }`}
                                  >
                                    {getTeamDisplayName(
                                      awayTeam,
                                      match.id,
                                      "away",
                                    )}
                                  </span>
                                </div>
                              </div>

                              {/* Points earned */}
                              <MatchPointsTooltip
                                match={match}
                                prediction={pred}
                                predictedHomeTeam={homeTeam}
                                predictedAwayTeam={awayTeam}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </section>
        )}

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
                            const homeGoals = pred?.home_goals;
                            const awayGoals = pred?.away_goals;
                            const hasScore =
                              homeGoals !== null &&
                              homeGoals !== undefined &&
                              awayGoals !== null &&
                              awayGoals !== undefined;
                            const homeWins = hasScore && homeGoals > awayGoals;
                            const awayWins = hasScore && awayGoals > homeGoals;
                            const isDraw = hasScore && homeGoals === awayGoals;
                            // For group stage, highlight both teams on draw
                            const homeHighlight = homeWins || isDraw;
                            const awayHighlight = awayWins || isDraw;
                            return (
                              <div
                                key={match.id}
                                className="flex items-center gap-2 py-2 text-sm"
                              >
                                <div
                                  className={`flex-1 flex items-center justify-end gap-1.5 px-1.5 py-0.5 rounded ${homeHighlight ? "bg-amber-500/80" : ""}`}
                                >
                                  <span
                                    className={
                                      homeHighlight
                                        ? "text-slate-900 font-semibold"
                                        : "text-white/80"
                                    }
                                  >
                                    {match.homeTeam.tla}
                                  </span>
                                  {match.homeTeam.crest ? (
                                    <img
                                      src={match.homeTeam.crest}
                                      alt={match.homeTeam.name}
                                      className="w-5 h-5 object-contain shrink-0"
                                    />
                                  ) : (
                                    <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[8px] font-bold text-white/60 shrink-0">
                                      {match.homeTeam.tla?.substring(0, 2)}
                                    </div>
                                  )}
                                </div>
                                <span className="w-16 text-center font-bold text-white">
                                  {pred?.home_goals ?? "-"} -{" "}
                                  {pred?.away_goals ?? "-"}
                                </span>
                                <div
                                  className={`flex-1 flex items-center gap-1.5 px-1.5 py-0.5 rounded ${awayHighlight ? "bg-amber-500/80" : ""}`}
                                >
                                  {match.awayTeam.crest ? (
                                    <img
                                      src={match.awayTeam.crest}
                                      alt={match.awayTeam.name}
                                      className="w-5 h-5 object-contain shrink-0"
                                    />
                                  ) : (
                                    <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[8px] font-bold text-white/60 shrink-0">
                                      {match.awayTeam.tla?.substring(0, 2)}
                                    </div>
                                  )}
                                  <span
                                    className={
                                      awayHighlight
                                        ? "text-slate-900 font-semibold"
                                        : "text-white/80"
                                    }
                                  >
                                    {match.awayTeam.tla}
                                  </span>
                                </div>
                                {/* Points earned */}
                                <MatchPointsTooltip
                                  match={match}
                                  prediction={pred}
                                  className="w-8"
                                />
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

        {/* Knockout Stage - shown after groups when not locked */}
        {!knockoutLocked && (
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4 border-b border-white/10 pb-2 text-white">
              Knockout Stage
            </h2>

            {!knockoutOpen ? (
              // Knockout not open yet - show R32 preview + blurred placeholder
              <div className="space-y-6">
                <R32Preview
                  matches={matches.filter((m) => m.stage === "LAST_32")}
                  groupStandings={allGroupStandings}
                  thirdPlaceQualifying={thirdPlaceQualifying}
                />

                {/* Blurred rest of knockout */}
                <div className="relative">
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-10 rounded-xl flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-5xl mb-4">🔒</div>
                      <p className="text-white/60 text-lg">
                        Coming soon after group stage
                      </p>
                    </div>
                  </div>
                  <div className="space-y-6 opacity-50">
                    {["LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"].map(
                      (stage) => {
                        const stageName = {
                          LAST_16: "Round of 16",
                          QUARTER_FINALS: "Quarter-Finals",
                          SEMI_FINALS: "Semi-Finals",
                          FINAL: "Final",
                        }[stage];
                        return (
                          <div key={stage} className="glass-card p-5">
                            <h3 className="font-bold text-lg mb-4 text-white">
                              {stageName}
                            </h3>
                            <div className="grid md:grid-cols-2 gap-4 h-20">
                              {/* Placeholder boxes */}
                              <div className="bg-white/5 rounded-lg h-12"></div>
                              <div className="bg-white/5 rounded-lg h-12"></div>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              </div>
            ) : !showKnockoutPredictions ? (
              <div className="glass-card p-8 text-center blur-sm select-none">
                <p className="text-white/50">
                  Predictions will be visible after knockout stage starts
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {(() => {
                  const knockoutStagesData = [
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

                  return knockoutStagesData.map(({ stage, name }) => {
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
                        <div className="grid md:grid-cols-2 gap-3">
                          {stageMatches.map((match) => {
                            const pred = predictionMap.get(match.id);
                            const matchDate = new Date(match.utcDate);
                            const resolved = resolvedKnockoutTeams.get(
                              match.id,
                            );
                            const homeTeam =
                              resolved?.home ||
                              (match.homeTeam?.id ? match.homeTeam : null);
                            const awayTeam =
                              resolved?.away ||
                              (match.awayTeam?.id ? match.awayTeam : null);
                            const venue = getMatchVenue(match);

                            const formattedDate = matchDate.toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                              },
                            );
                            const formattedTime = matchDate.toLocaleTimeString(
                              "en-US",
                              {
                                hour: "numeric",
                                minute: "2-digit",
                              },
                            );

                            return (
                              <div
                                key={match.id}
                                className="flex items-center py-3 px-4 rounded-xl bg-slate-800/60 border border-white/5"
                              >
                                {/* Date */}
                                <div className="w-20 text-center shrink-0 pr-3 border-r border-white/10">
                                  <div
                                    className="text-sm uppercase font-bold tracking-wide whitespace-nowrap"
                                    style={{ color: "var(--date-color)" }}
                                  >
                                    {formattedDate}
                                  </div>
                                </div>

                                {/* Time & Venue */}
                                <div className="w-28 shrink-0 px-3 border-r border-white/10">
                                  <div className="text-sm text-white/70 font-medium">
                                    {formattedTime}
                                  </div>
                                  {venue && (
                                    <div
                                      className="text-sm font-semibold truncate"
                                      style={{ color: "var(--venue-color)" }}
                                    >
                                      {venue.city}
                                    </div>
                                  )}
                                </div>

                                {(() => {
                                  // Calculate highlights based on score
                                  const hasScore =
                                    pred?.home_goals !== null &&
                                    pred?.home_goals !== undefined &&
                                    pred?.away_goals !== null &&
                                    pred?.away_goals !== undefined;
                                  const homeWins =
                                    hasScore &&
                                    pred.home_goals > pred.away_goals;
                                  const awayWins =
                                    hasScore &&
                                    pred.away_goals > pred.home_goals;
                                  const isTie =
                                    hasScore &&
                                    pred.home_goals === pred.away_goals;

                                  // Knockout: winner based on score, or winner_id if tie
                                  const homeHighlight =
                                    homeWins ||
                                    (isTie && pred?.winner_id === homeTeam?.id);
                                  const awayHighlight =
                                    awayWins ||
                                    (isTie && pred?.winner_id === awayTeam?.id);

                                  return (
                                    /* Match */
                                    <div className="flex-1 flex items-center justify-center pl-4">
                                      {/* Home Team */}
                                      <div
                                        className={`flex items-center justify-end gap-2 px-2 py-1 rounded-lg ${
                                          homeHighlight
                                            ? "bg-amber-500/80 text-slate-900"
                                            : ""
                                        }`}
                                      >
                                        <span
                                          className={`text-sm font-semibold truncate ${
                                            homeHighlight
                                              ? "text-slate-900"
                                              : "text-white"
                                          }`}
                                        >
                                          {getTeamDisplayName(
                                            homeTeam,
                                            match.id,
                                            "home",
                                          )}
                                        </span>
                                        {homeTeam?.crest ? (
                                          <img
                                            src={homeTeam.crest}
                                            alt={homeTeam.name}
                                            className="w-7 h-7 object-contain shrink-0"
                                          />
                                        ) : (
                                          <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-[10px] font-bold text-white/60 shrink-0">
                                            {homeTeam?.tla?.substring(0, 2) ||
                                              "?"}
                                          </div>
                                        )}
                                      </div>

                                      {/* Score */}
                                      <div className="flex items-center gap-2 mx-4">
                                        <span className="w-10 h-9 flex items-center justify-center text-lg font-bold bg-white/90 rounded-lg text-slate-800">
                                          {pred?.home_goals ?? "-"}
                                        </span>
                                        <span className="text-white/50 font-bold">
                                          -
                                        </span>
                                        <span className="w-10 h-9 flex items-center justify-center text-lg font-bold bg-white/90 rounded-lg text-slate-800">
                                          {pred?.away_goals ?? "-"}
                                        </span>
                                      </div>

                                      {/* Away Team */}
                                      <div
                                        className={`flex items-center gap-2 px-2 py-1 rounded-lg ${
                                          awayHighlight
                                            ? "bg-amber-500/80 text-slate-900"
                                            : ""
                                        }`}
                                      >
                                        {awayTeam?.crest ? (
                                          <img
                                            src={awayTeam.crest}
                                            alt={awayTeam.name}
                                            className="w-7 h-7 object-contain shrink-0"
                                          />
                                        ) : (
                                          <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-[10px] font-bold text-white/60 shrink-0">
                                            {awayTeam?.tla?.substring(0, 2) ||
                                              "?"}
                                          </div>
                                        )}
                                        <span
                                          className={`text-sm font-semibold truncate ${
                                            awayHighlight
                                              ? "text-slate-900"
                                              : "text-white"
                                          }`}
                                        >
                                          {getTeamDisplayName(
                                            awayTeam,
                                            match.id,
                                            "away",
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* Points earned */}
                                <MatchPointsTooltip
                                  match={match}
                                  prediction={pred}
                                  predictedHomeTeam={homeTeam}
                                  predictedAwayTeam={awayTeam}
                                />
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
        )}

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
