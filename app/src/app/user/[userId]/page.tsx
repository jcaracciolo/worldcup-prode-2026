import Header from "@/components/Header";
import PointsBreakdown from "@/components/PointsBreakdown";
import StandingsTable from "@/components/StandingsTable";
import { createClient } from "@/lib/supabase/server";
import { getQualifyingThirdPlaceTeams } from "@/lib/third-place-ranking";
import { notFound } from "next/navigation";
import {
  Match,
  CalculatedStanding,
  Team,
  PointBreakdown,
} from "@/types/football";

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

  // Calculate points breakdown (simplified for now)
  const breakdown: PointBreakdown[] = [];
  let totalPoints = 0;

  // Show blurred state for predictions not yet visible
  const showGroupPredictions = isOwnPredictions || groupLocked;
  const showKnockoutPredictions = isOwnPredictions || knockoutLocked;

  return (
    <div className="min-h-screen">
      <Header user={currentProfile} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            {targetProfile.display_name}&apos;s Predictions
          </h1>
          {isOwnPredictions && (
            <p className="text-gray-500 text-sm mt-1">This is you!</p>
          )}
        </div>

        {/* Group Stage */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4 border-b pb-2">Group Stage</h2>

          {!showGroupPredictions ? (
            <div className="bg-gray-100 rounded-lg p-8 text-center blur-sm select-none">
              <p className="text-gray-500">
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
                    <div
                      key={groupName}
                      className="bg-white rounded-lg shadow-md p-4"
                    >
                      <h3 className="font-bold text-lg mb-3">{groupName}</h3>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-2">
                            Predictions
                          </h4>
                          {groupMatchList.map((match) => {
                            const pred = predictionMap.get(match.id);
                            return (
                              <div
                                key={match.id}
                                className="flex items-center gap-2 py-2 text-sm"
                              >
                                <span className="flex-1 text-right">
                                  {match.homeTeam.tla}
                                </span>
                                <span className="w-16 text-center font-bold">
                                  {pred?.home_goals ?? "-"} -{" "}
                                  {pred?.away_goals ?? "-"}
                                </span>
                                <span className="flex-1">
                                  {match.awayTeam.tla}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-2">
                            Standings
                          </h4>
                          <StandingsTable 
                            standings={standings} 
                            disabled 
                            thirdPlaceQualifies={thirdPlaceQualifying.get(groupName) || false}
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
          <h2 className="text-xl font-bold mb-4 border-b pb-2">
            Knockout Stage
          </h2>

          {!showKnockoutPredictions ? (
            <div className="bg-gray-100 rounded-lg p-8 text-center blur-sm select-none">
              <p className="text-gray-500">
                Predictions will be visible after knockout stage starts
              </p>
            </div>
          ) : (
            <div className="text-gray-500 text-center py-8">
              Knockout predictions display coming soon
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

      <footer className="bg-gray-800 text-white py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-sm">
          <p>WorldCupProde - FIFA World Cup 2026 Predictions</p>
        </div>
      </footer>
    </div>
  );
}
