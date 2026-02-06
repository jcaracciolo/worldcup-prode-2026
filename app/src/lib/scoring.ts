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

// Round multipliers for knockout stages
const ROUND_MULTIPLIERS: Record<string, number> = {
  LAST_32: 1,
  LAST_16: 1,
  QUARTER_FINALS: 1,
  SEMI_FINALS: 2,
  THIRD_PLACE: 3,
  FINAL: 4,
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

  // 2 points for correct result
  if (predictedResult === actualResult) {
    points.push({
      matchId: match.id,
      description: `Correct result: ${match.homeTeam.tla} ${actualResult === "home" ? "win" : actualResult === "away" ? "loss" : "draw"} (${match.homeTeam.tla} ${actualHomeGoals}-${actualAwayGoals} ${match.awayTeam.tla})`,
      points: 2,
      type: "result",
    });
  }

  // 1 point for exact home goals
  if (prediction.home_goals === actualHomeGoals) {
    points.push({
      matchId: match.id,
      description: `Correct goals: ${match.homeTeam.tla} ${actualHomeGoals} (${match.homeTeam.tla} ${actualHomeGoals}-${actualAwayGoals} ${match.awayTeam.tla})`,
      points: 1,
      type: "goals_home",
    });
  }

  // 1 point for exact away goals
  if (prediction.away_goals === actualAwayGoals) {
    points.push({
      matchId: match.id,
      description: `Correct goals: ${match.awayTeam.tla} ${actualAwayGoals} (${match.homeTeam.tla} ${actualHomeGoals}-${actualAwayGoals} ${match.awayTeam.tla})`,
      points: 1,
      type: "goals_away",
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
  const stageName = match.stage.replace(/_/g, " ");

  const predictedResult = getPredictionResult(
    prediction.home_goals,
    prediction.away_goals,
  );
  const actualResult = getMatchResult(match);

  // For knockout, we award points for correct team win/lose/tie separately
  // This allows partial credit even if you didn't predict the exact teams

  // If it's a draw (tie before penalties)
  if (actualResult === "draw") {
    if (predictedResult === "draw") {
      // Both teams tie = 1 point each × multiplier
      points.push({
        matchId: match.id,
        description: `Correct: ${match.homeTeam.tla} ties (${stageName})`,
        points: 1 * multiplier,
        type: "knockout_tie",
      });
      points.push({
        matchId: match.id,
        description: `Correct: ${match.awayTeam.tla} ties (${stageName})`,
        points: 1 * multiplier,
        type: "knockout_tie",
      });
    }
  } else {
    // Home or Away won
    if (predictedResult === actualResult) {
      const winner = actualResult === "home" ? match.homeTeam : match.awayTeam;
      const loser = actualResult === "home" ? match.awayTeam : match.homeTeam;

      points.push({
        matchId: match.id,
        description: `Correct: ${winner.tla} wins (${stageName})`,
        points: 1 * multiplier,
        type: "knockout_win",
      });
      points.push({
        matchId: match.id,
        description: `Correct: ${loser.tla} loses (${stageName})`,
        points: 1 * multiplier,
        type: "knockout_lose",
      });
    }
  }

  // 1 point for exact goals (no multiplier for goals)
  if (prediction.home_goals === actualHomeGoals) {
    points.push({
      matchId: match.id,
      description: `Correct goals: ${match.homeTeam.tla} ${actualHomeGoals}`,
      points: 1,
      type: "goals_home",
    });
  }

  if (prediction.away_goals === actualAwayGoals) {
    points.push({
      matchId: match.id,
      description: `Correct goals: ${match.awayTeam.tla} ${actualAwayGoals}`,
      points: 1,
      type: "goals_away",
    });
  }

  return points;
}

export function calculateGroupStandingsBonusPoints(
  groupName: string,
  predictedStandings: CalculatedStanding[],
  actualStandings: CalculatedStanding[],
  advancingTeamIds: Set<number>, // Teams that actually advanced (1st, 2nd, best 3rds)
): PointBreakdown[] {
  const points: PointBreakdown[] = [];

  predictedStandings.forEach((predicted, index) => {
    const predictedPosition = index + 1;
    const actual = actualStandings.find((s) => s.team.id === predicted.team.id);

    if (!actual) return;

    // 1 point if team advances
    if (advancingTeamIds.has(predicted.team.id)) {
      points.push({
        matchId: 0,
        description: `${predicted.team.tla} advanced from ${groupName}`,
        points: 1,
        type: "group_advance",
      });

      // 1 additional point if position is correct
      const actualPosition =
        actualStandings.findIndex((s) => s.team.id === predicted.team.id) + 1;
      if (predictedPosition === actualPosition) {
        points.push({
          matchId: 0,
          description: `${predicted.team.tla} correct position: ${predictedPosition} (${groupName})`,
          points: 1,
          type: "group_position",
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

    if (actualStandings) {
      allBreakdown.push(
        ...calculateGroupStandingsBonusPoints(
          groupName,
          predictedStandings,
          actualStandings,
          advancingTeamIds,
        ),
      );
    }
  });

  const totalPoints = allBreakdown.reduce((sum, p) => sum + p.points, 0);

  return { totalPoints, breakdown: allBreakdown };
}
