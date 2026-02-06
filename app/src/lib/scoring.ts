import {
  Match,
  PointBreakdown,
  CalculatedStanding,
  Team,
} from "@/types/football";
import { Prediction, GroupStandingsOverride } from "@/types/database";
import {
  getMatchResult,
  getPredictionResult,
  isGroupStageMatch,
} from "./football-api";

// =====================================================================
// SCORING CONSTANTS - Single source of truth for all scoring rules
// Modify these to change scoring rules across the entire app
// =====================================================================

/** Points for predicting correct result (win/draw/loss) in group stage */
export const POINTS_CORRECT_RESULT = 2;

/** Points for predicting exact goals for one team */
export const POINTS_CORRECT_GOALS = 1;

/** 
 * Multipliers for knockout rounds 
 * Applied to result prediction points (not goals)
 */
export const ROUND_MULTIPLIERS: Record<string, number> = {
  LAST_32: 1,
  LAST_16: 2,
  QUARTER_FINALS: 3,
  SEMI_FINALS: 4,
  THIRD_PLACE: 5,
  FINAL: 6,
};

export function calculateGroupStagePoints(
  match: Match,
  prediction: Prediction | undefined,
): PointBreakdown[] {
  const points: PointBreakdown[] = [];

  if (
    !prediction ||
    prediction.home_goals === null ||
    prediction.away_goals === null
  ) {
    return points;
  }

  if (match.status !== "FINISHED") {
    return points;
  }

  const actualHomeGoals = match.score.fullTime.home;
  const actualAwayGoals = match.score.fullTime.away;

  if (actualHomeGoals === null || actualAwayGoals === null) {
    return points;
  }

  const predictedResult = getPredictionResult(
    prediction.home_goals,
    prediction.away_goals,
  );
  const actualResult = getMatchResult(match);

  const matchInfo = {
    homeTeam: {
      tla: match.homeTeam.tla,
      crest: match.homeTeam.crest,
      shortName: match.homeTeam.shortName,
    },
    awayTeam: {
      tla: match.awayTeam.tla,
      crest: match.awayTeam.crest,
      shortName: match.awayTeam.shortName,
    },
    homeGoals: actualHomeGoals,
    awayGoals: actualAwayGoals,
    stage: match.stage,
  };

  // 2 points for correct result
  if (predictedResult === actualResult) {
    const resultText =
      actualResult === "draw" ? "Group Stage tie" : "Group Stage win";
    points.push({
      matchId: match.id,
      description: resultText,
      points: 2,
      type: "result",
      matchInfo,
    });
  }

  // 1 point for exact home goals
  if (prediction.home_goals === actualHomeGoals) {
    points.push({
      matchId: match.id,
      description: `Correct goals`,
      points: 1,
      type: "goals_home",
      team: {
        tla: match.homeTeam.tla,
        crest: match.homeTeam.crest,
        name: match.homeTeam.name,
      },
      matchInfo,
    });
  }

  // 1 point for exact away goals
  if (prediction.away_goals === actualAwayGoals) {
    points.push({
      matchId: match.id,
      description: `Correct goals`,
      points: 1,
      type: "goals_away",
      team: {
        tla: match.awayTeam.tla,
        crest: match.awayTeam.crest,
        name: match.awayTeam.name,
      },
      matchInfo,
    });
  }

  return points;
}

export function calculateKnockoutPoints(
  match: Match,
  prediction: Prediction | undefined,
): PointBreakdown[] {
  const points: PointBreakdown[] = [];

  if (
    !prediction ||
    prediction.home_goals === null ||
    prediction.away_goals === null
  ) {
    return points;
  }

  if (match.status !== "FINISHED") {
    return points;
  }

  const actualHomeGoals = match.score.fullTime.home;
  const actualAwayGoals = match.score.fullTime.away;

  if (actualHomeGoals === null || actualAwayGoals === null) {
    return points;
  }

  const multiplier = ROUND_MULTIPLIERS[match.stage] || 1;

  // Get human-readable stage name
  const stageName = match.stage
    .replace("LAST_32", "Round of 32")
    .replace("LAST_16", "Round of 16")
    .replace("QUARTER_FINALS", "Quarter-Final")
    .replace("SEMI_FINALS", "Semi-Final")
    .replace("THIRD_PLACE", "3rd Place")
    .replace("FINAL", "Final");

  const predictedResult = getPredictionResult(
    prediction.home_goals,
    prediction.away_goals,
  );
  const actualResult = getMatchResult(match);

  const matchInfo = {
    homeTeam: {
      tla: match.homeTeam.tla,
      crest: match.homeTeam.crest,
      shortName: match.homeTeam.shortName,
    },
    awayTeam: {
      tla: match.awayTeam.tla,
      crest: match.awayTeam.crest,
      shortName: match.awayTeam.shortName,
    },
    homeGoals: actualHomeGoals,
    awayGoals: actualAwayGoals,
    stage: match.stage,
  };

  // For knockout, we award points for correct team win/lose/tie separately
  // This allows partial credit even if you didn't predict the exact teams

  // If it's a draw (tie before penalties)
  if (actualResult === "draw") {
    if (predictedResult === "draw") {
      // Both teams tie = 1 point each × multiplier
      points.push({
        matchId: match.id,
        description: `${stageName} tie${multiplier > 1 ? ` (${multiplier}×)` : ""}`,
        points: 1 * multiplier,
        type: "knockout_tie",
        team: {
          tla: match.homeTeam.tla,
          crest: match.homeTeam.crest,
          name: match.homeTeam.name,
        },
        matchInfo,
      });
      points.push({
        matchId: match.id,
        description: `${stageName} tie${multiplier > 1 ? ` (${multiplier}×)` : ""}`,
        points: 1 * multiplier,
        type: "knockout_tie",
        team: {
          tla: match.awayTeam.tla,
          crest: match.awayTeam.crest,
          name: match.awayTeam.name,
        },
        matchInfo,
      });
    }
  } else {
    // Home or Away won
    if (predictedResult === actualResult) {
      const winner = actualResult === "home" ? match.homeTeam : match.awayTeam;
      const loser = actualResult === "home" ? match.awayTeam : match.homeTeam;

      points.push({
        matchId: match.id,
        description: `${stageName} winner${multiplier > 1 ? ` (${multiplier}×)` : ""}`,
        points: 1 * multiplier,
        type: "knockout_win",
        team: { tla: winner.tla, crest: winner.crest, name: winner.name },
        matchInfo,
      });
      points.push({
        matchId: match.id,
        description: `${stageName} loser${multiplier > 1 ? ` (${multiplier}×)` : ""}`,
        points: 1 * multiplier,
        type: "knockout_lose",
        team: { tla: loser.tla, crest: loser.crest, name: loser.name },
        matchInfo,
      });
    }
  }

  // 1 point for exact goals (no multiplier for goals)
  if (prediction.home_goals === actualHomeGoals) {
    points.push({
      matchId: match.id,
      description: `Correct goals`,
      points: 1,
      type: "goals_home",
      team: {
        tla: match.homeTeam.tla,
        crest: match.homeTeam.crest,
        name: match.homeTeam.name,
      },
      matchInfo,
    });
  }

  if (prediction.away_goals === actualAwayGoals) {
    points.push({
      matchId: match.id,
      description: `Correct goals`,
      points: 1,
      type: "goals_away",
      team: {
        tla: match.awayTeam.tla,
        crest: match.awayTeam.crest,
        name: match.awayTeam.name,
      },
      matchInfo,
    });
  }

  return points;
}

export function calculateGroupStandingsBonusPoints(
  groupName: string,
  predictedStandings: CalculatedStanding[],
  actualStandings: CalculatedStanding[],
  advancingTeamIds: Set<number>, // Teams that actually advanced (1st, 2nd, best 3rds)
  groupComplete: boolean = false, // Whether all group matches are finished
): PointBreakdown[] {
  const points: PointBreakdown[] = [];

  // Only award group bonus points when group stage is complete
  if (!groupComplete) {
    return points;
  }

  const groupLetter = groupName.replace("GROUP_", "");

  predictedStandings.forEach((predicted, index) => {
    const predictedPosition = index + 1;
    const actual = actualStandings.find((s) => s.team.id === predicted.team.id);

    if (!actual || !predicted.team) return;

    // 1 point if team advances
    if (advancingTeamIds.has(predicted.team.id)) {
      const positionText =
        predictedPosition === 1
          ? "1st"
          : predictedPosition === 2
            ? "2nd"
            : "3rd";
      points.push({
        matchId: 0,
        description: `Predicted to advance from Group ${groupLetter}`,
        points: 1,
        type: "group_advance",
        team: {
          tla: predicted.team.tla || "???",
          crest: predicted.team.crest || "",
          name: predicted.team.name || "Unknown",
        },
      });

      // 1 additional point if position is correct
      const actualPosition =
        actualStandings.findIndex((s) => s.team.id === predicted.team.id) + 1;
      if (predictedPosition === actualPosition) {
        points.push({
          matchId: 0,
          description: `Correct position: ${positionText} in Group ${groupLetter}`,
          points: 1,
          type: "group_position",
          team: {
            tla: predicted.team.tla || "???",
            crest: predicted.team.crest || "",
            name: predicted.team.name || "Unknown",
          },
        });
      }
    }
  });

  return points;
}

export function calculateStandingsFromPredictions(
  groupMatches: Match[],
  predictions: Map<number, Prediction>,
  overrides: GroupStandingsOverride[],
): CalculatedStanding[] {
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

  // Calculate stats from predictions
  groupMatches.forEach((match) => {
    const prediction = predictions.get(match.id);
    if (
      !prediction ||
      prediction.home_goals === null ||
      prediction.away_goals === null
    ) {
      return;
    }

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

  // Sort standings
  let standings = Array.from(teamStats.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference)
      return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });

  // Apply manual overrides for tiebreakers
  if (overrides.length > 0) {
    overrides.forEach((override) => {
      const teamIndex = standings.findIndex(
        (s) => s.team.id === override.team_id,
      );
      if (teamIndex !== -1) {
        const [team] = standings.splice(teamIndex, 1);
        standings.splice(override.position - 1, 0, team);
      }
    });
  }

  // Update positions
  standings = standings.map((s, i) => ({ ...s, position: i + 1 }));

  return standings;
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

export function calculateTotalPoints(
  matches: Match[],
  predictions: Prediction[],
  groupOverrides: GroupStandingsOverride[],
  actualGroupStandings: Map<string, CalculatedStanding[]>,
  advancingTeamIds: Set<number>,
): { totalPoints: number; breakdown: PointBreakdown[] } {
  const predictionMap = new Map(predictions.map((p) => [p.match_id, p]));
  const allBreakdown: PointBreakdown[] = [];

  // Calculate match points
  matches.forEach((match) => {
    const prediction = predictionMap.get(match.id);

    if (isGroupStageMatch(match)) {
      allBreakdown.push(...calculateGroupStagePoints(match, prediction));
    } else {
      allBreakdown.push(...calculateKnockoutPoints(match, prediction));
    }
  });

  // Calculate group standings bonus points
  const groupMatches = matches.filter(isGroupStageMatch);
  const groupedMatches = new Map<string, Match[]>();
  groupMatches.forEach((match) => {
    if (!match.group) return;
    if (!groupedMatches.has(match.group)) {
      groupedMatches.set(match.group, []);
    }
    groupedMatches.get(match.group)!.push(match);
  });

  groupedMatches.forEach((groupMatchList, groupName) => {
    const groupOverridesForGroup = groupOverrides.filter(
      (o) => o.group_name === groupName,
    );
    const predictedStandings = calculateStandingsFromPredictions(
      groupMatchList,
      predictionMap,
      groupOverridesForGroup,
    );
    const actualStandings = actualGroupStandings.get(groupName);

    // Check if all matches in this group are finished (6 matches per group)
    const finishedMatches = groupMatchList.filter(
      (m) => m.status === "FINISHED",
    );
    const groupComplete =
      finishedMatches.length === groupMatchList.length &&
      groupMatchList.length > 0;

    if (actualStandings) {
      allBreakdown.push(
        ...calculateGroupStandingsBonusPoints(
          groupName,
          predictedStandings,
          actualStandings,
          advancingTeamIds,
          groupComplete,
        ),
      );
    }
  });

  const totalPoints = allBreakdown.reduce((sum, p) => sum + p.points, 0);

  return { totalPoints, breakdown: allBreakdown };
}
