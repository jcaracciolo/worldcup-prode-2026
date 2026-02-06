import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { r32Bracket } from "@/lib/r32-bracket";
import { Match, Team, CalculatedStanding } from "@/types/football";

// Calculate actual group standings from finished matches
function calculateGroupStandings(
  groupMatches: Match[],
): Map<string, CalculatedStanding[]> {
  const groups = new Map<string, Match[]>();
  groupMatches.forEach((match) => {
    if (match.group) {
      if (!groups.has(match.group)) {
        groups.set(match.group, []);
      }
      groups.get(match.group)!.push(match);
    }
  });

  const standings = new Map<string, CalculatedStanding[]>();

  groups.forEach((matches, groupName) => {
    const teamStats = new Map<number, CalculatedStanding & { team: Team }>();

    // Initialize teams
    matches.forEach((match) => {
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

    // Calculate stats from finished matches
    matches.forEach((match) => {
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

    const sorted = Array.from(teamStats.values())
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference)
          return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
      })
      .map((s, i) => ({ ...s, position: i + 1 }));

    standings.set(groupName, sorted);
  });

  return standings;
}

// Get team from standings by position
function getTeamFromStandings(
  standings: Map<string, CalculatedStanding[]>,
  groupName: string,
  position: number,
): Team | null {
  const groupStandings = standings.get(groupName);
  if (!groupStandings) return null;
  const standing = groupStandings.find((s) => s.position === position);
  return standing?.team || null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { stage } = await request.json();

    // Get all matches
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/matches`,
    );
    const { matches } = await res.json();

    if (!matches || matches.length === 0) {
      return NextResponse.json({ error: "No matches found" }, { status: 400 });
    }

    // Filter by stage
    const targetMatches =
      stage === "group"
        ? matches.filter((m: Match) => m.stage === "GROUP_STAGE")
        : matches.filter((m: Match) => m.stage !== "GROUP_STAGE");

    // For knockout, calculate group standings to resolve R32 teams
    let groupStandings: Map<string, CalculatedStanding[]> | null = null;
    const knockoutResults: Map<number, { winner: Team; loser: Team }> =
      new Map();

    if (stage === "knockout") {
      const groupMatches = matches.filter(
        (m: Match) => m.stage === "GROUP_STAGE",
      );
      groupStandings = calculateGroupStandings(groupMatches);
    }

    // Generate random results and update cache
    const serviceClient = await createServiceClient();

    // Sort knockout matches by round order
    const roundOrder = [
      "LAST_32",
      "LAST_16",
      "QUARTER_FINALS",
      "SEMI_FINALS",
      "THIRD_PLACE",
      "FINAL",
    ];
    const sortedMatches = [...targetMatches].sort((a: Match, b: Match) => {
      const aOrder = roundOrder.indexOf(a.stage);
      const bOrder = roundOrder.indexOf(b.stage);
      if (aOrder !== bOrder) return aOrder - bOrder;
      // Within same round, sort by match ID to maintain bracket order
      return a.id - b.id;
    });

    // Group matches by stage
    const matchesByStage = new Map<string, Match[]>();
    sortedMatches.forEach((match) => {
      if (!matchesByStage.has(match.stage)) {
        matchesByStage.set(match.stage, []);
      }
      matchesByStage.get(match.stage)!.push(match);
    });

    // Process each stage in order
    for (const stage of roundOrder) {
      const stageMatches = matchesByStage.get(stage) || [];
      if (stageMatches.length === 0) continue;

      // For R16+, get winners from previous round
      const prevRoundWinners: Team[] = [];
      if (stage === "LAST_16") {
        // Get R32 winners in bracket order
        const r32Matches = matchesByStage.get("LAST_32") || [];
        r32Matches.forEach((m) => {
          const result = knockoutResults.get(m.id);
          if (result) prevRoundWinners.push(result.winner);
        });
      } else if (stage === "QUARTER_FINALS") {
        const r16Matches = matchesByStage.get("LAST_16") || [];
        r16Matches.forEach((m) => {
          const result = knockoutResults.get(m.id);
          if (result) prevRoundWinners.push(result.winner);
        });
      } else if (stage === "SEMI_FINALS") {
        const qfMatches = matchesByStage.get("QUARTER_FINALS") || [];
        qfMatches.forEach((m) => {
          const result = knockoutResults.get(m.id);
          if (result) prevRoundWinners.push(result.winner);
        });
      } else if (stage === "FINAL" || stage === "THIRD_PLACE") {
        const sfMatches = matchesByStage.get("SEMI_FINALS") || [];
        sfMatches.forEach((m) => {
          const result = knockoutResults.get(m.id);
          if (result) {
            if (stage === "FINAL") {
              prevRoundWinners.push(result.winner);
            } else {
              prevRoundWinners.push(result.loser);
            }
          }
        });
      }

      for (let i = 0; i < stageMatches.length; i++) {
        const match = stageMatches[i];
        const homeGoals = Math.floor(Math.random() * 5);
        const awayGoals = Math.floor(Math.random() * 5);

        const resolvedMatch = { ...match };

        // For R32 matches, resolve teams from group standings
        if (match.stage === "LAST_32" && groupStandings) {
          const bracketSlot = r32Bracket.find((b) => b.matchId === match.id);
          if (bracketSlot) {
            const homeTeam = getTeamFromStandings(
              groupStandings,
              bracketSlot.homePosition.group,
              bracketSlot.homePosition.position,
            );
            const awayTeam = getTeamFromStandings(
              groupStandings,
              bracketSlot.awayPosition.group,
              bracketSlot.awayPosition.position,
            );
            if (homeTeam) resolvedMatch.homeTeam = homeTeam;
            if (awayTeam) resolvedMatch.awayTeam = awayTeam;
          }
        } else if (prevRoundWinners.length > 0) {
          // For later rounds, assign teams from previous round winners
          // Each match takes 2 consecutive winners from the bracket
          const homeIdx = i * 2;
          const awayIdx = i * 2 + 1;
          if (prevRoundWinners[homeIdx]) {
            resolvedMatch.homeTeam = prevRoundWinners[homeIdx];
          }
          if (prevRoundWinners[awayIdx]) {
            resolvedMatch.awayTeam = prevRoundWinners[awayIdx];
          }
        }

        // Create a mock match result
        const updatedMatch = {
          ...resolvedMatch,
          status: "FINISHED",
          score: {
            winner:
              homeGoals > awayGoals
                ? "HOME_TEAM"
                : awayGoals > homeGoals
                  ? "AWAY_TEAM"
                  : "DRAW",
            duration: "REGULAR",
            fullTime: { home: homeGoals, away: awayGoals },
            halfTime: {
              home: Math.floor(homeGoals / 2),
              away: Math.floor(awayGoals / 2),
            },
          },
        };

        // Track knockout results for later rounds
        const winner =
          homeGoals >= awayGoals
            ? updatedMatch.homeTeam
            : updatedMatch.awayTeam;
        const loser =
          homeGoals >= awayGoals
            ? updatedMatch.awayTeam
            : updatedMatch.homeTeam;
        knockoutResults.set(match.id, { winner, loser });

        // Store in cache
        await serviceClient.from("matches_cache").upsert({
          match_id: match.id,
          data: updatedMatch,
          updated_at: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      matchesUpdated: targetMatches.length,
    });
  } catch (error) {
    console.error("Error generating results:", error);
    return NextResponse.json(
      { error: "Failed to generate results" },
      { status: 500 },
    );
  }
}
