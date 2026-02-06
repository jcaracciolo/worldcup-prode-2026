import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateTotalPoints } from "@/lib/scoring";
import { Match, CalculatedStanding } from "@/types/football";
import { getQualifyingThirdPlaceTeams } from "@/lib/third-place-ranking";
import { getStageLockStatus } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();

    // Get all profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name");

    if (!profiles) {
      return NextResponse.json({ scores: [] });
    }

    // Get stage lock status based on current time
    const {
      groupStageLocked: groupLocked,
      knockoutStageLocked: knockoutLocked,
    } = getStageLockStatus();

    // If nothing is locked, return profiles with 0 points
    if (!groupLocked && !knockoutLocked) {
      return NextResponse.json({
        scores: profiles.map((p) => ({
          userId: p.id,
          displayName: p.display_name,
          totalPoints: 0,
          groupStagePoints: 0,
          groupBonusPoints: 0,
          knockoutPoints: 0,
        })),
      });
    }

    // Fetch matches
    let matches: Match[] = [];
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/matches`,
        { cache: "no-store" },
      );
      const data = await res.json();
      matches = data.matches || [];
    } catch (error) {
      console.error("Failed to fetch matches:", error);
    }

    // Calculate actual standings from finished matches
    const groupMatches = matches.filter((m) => m.stage === "GROUP_STAGE");
    const groups = new Map<string, Match[]>();
    groupMatches.forEach((m) => {
      if (!m.group) return;
      if (!groups.has(m.group)) groups.set(m.group, []);
      groups.get(m.group)!.push(m);
    });

    const calculateActualStandings = (
      groupMatchList: Match[],
    ): CalculatedStanding[] => {
      const teamStats = new Map<number, CalculatedStanding>();

      groupMatchList.forEach((match) => {
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

      groupMatchList.forEach((match) => {
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

    const actualGroupStandings = new Map<string, CalculatedStanding[]>();
    groups.forEach((groupMatchList, groupName) => {
      actualGroupStandings.set(
        groupName,
        calculateActualStandings(groupMatchList),
      );
    });

    const actualThirdPlaceQualifying =
      getQualifyingThirdPlaceTeams(actualGroupStandings);
    const advancingTeamIds = new Set<number>();
    actualGroupStandings.forEach((standings, groupName) => {
      standings.forEach((standing, index) => {
        if (index < 2) {
          advancingTeamIds.add(standing.team.id);
        } else if (index === 2 && actualThirdPlaceQualifying.get(groupName)) {
          advancingTeamIds.add(standing.team.id);
        }
      });
    });

    // Calculate points for each user
    const scores = await Promise.all(
      profiles.map(async (profile) => {
        // Get user's predictions
        const { data: predictions } = await supabase
          .from("predictions")
          .select("*")
          .eq("user_id", profile.id);

        // Get user's group overrides
        const { data: groupOverrides } = await supabase
          .from("group_standings_overrides")
          .select("*")
          .eq("user_id", profile.id);

        const { totalPoints, breakdown } = calculateTotalPoints(
          matches,
          predictions || [],
          groupOverrides || [],
          actualGroupStandings,
          advancingTeamIds,
        );

        // Categorize points
        let groupStagePoints = 0;
        let groupBonusPoints = 0;
        let knockoutPoints = 0;

        breakdown.forEach((item) => {
          if (item.type === "group_advance" || item.type === "group_position") {
            groupBonusPoints += item.points;
          } else if (
            item.type === "knockout_win" ||
            item.type === "knockout_lose" ||
            item.type === "knockout_tie"
          ) {
            knockoutPoints += item.points;
          } else {
            // result, goals_home, goals_away for group stage
            const match = matches.find((m) => m.id === item.matchId);
            if (match?.stage === "GROUP_STAGE") {
              groupStagePoints += item.points;
            } else {
              knockoutPoints += item.points;
            }
          }
        });

        return {
          userId: profile.id,
          displayName: profile.display_name,
          totalPoints,
          groupStagePoints,
          groupBonusPoints,
          knockoutPoints,
        };
      }),
    );

    // Sort by total points
    scores.sort((a, b) => b.totalPoints - a.totalPoints);

    return NextResponse.json({ scores });
  } catch (error) {
    console.error("Error calculating leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to calculate leaderboard", scores: [] },
      { status: 500 },
    );
  }
}
