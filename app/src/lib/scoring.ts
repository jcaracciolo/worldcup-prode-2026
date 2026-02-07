import {
  Match,
  PointBreakdown,
  CalculatedStanding,
  Team,
  FifaMatchId,
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

// Re-exported for backwards compatibility
export const KNOCKOUT_MULTIPLIERS = ROUND_MULTIPLIERS;

// =====================================================================
// TYPES - Used by single-match scoring functions
// =====================================================================

export interface MatchPointsResult {
  /** Total points earned from this match */
  total: number;
  /** Maximum possible points for this match type */
  maxPossible: number;
  /** Whether prediction was made */
  hasPrediction: boolean;
  /** Whether match is finished */
  isFinished: boolean;
  /** Whether match is currently live (IN_PLAY or PAUSED) */
  isLive: boolean;
}

export interface MatchPointsBreakdown {
  /** Points from correct result prediction */
  resultPoints: number;
  /** Points from correct home team goals */
  homeGoalsPoints: number;
  /** Points from correct away team goals */
  awayGoalsPoints: number;
  /** Multiplier applied (1 for group stage) */
  multiplier: number;
  /** Total points */
  total: number;
  /** Detailed description of each scoring item */
  details: PointDetail[];
}

export interface PointDetail {
  description: string;
  points: number;
  earned: boolean;
  /** True if this scoring item doesn't apply (e.g., predicted wrong team for knockout slot) */
  notApplicable?: boolean;
}

// =====================================================================
// UTILITY FUNCTIONS - Team display names and helpers
// =====================================================================

/** Team abbreviation overrides for teams with missing or non-standard TLA */
const TEAM_TLA_OVERRIDES: Record<string, string> = {
  Curaçao: "CUW",
  Curacao: "CUW",
};

/** Get team abbreviation with fallbacks */
function getTeamName(
  team:
    | { tla?: string | null; shortName?: string | null; name?: string | null }
    | null
    | undefined,
  fallback: string = "TBD",
): string {
  if (!team) return fallback;
  // Check for override first
  if (team.name && TEAM_TLA_OVERRIDES[team.name]) {
    return TEAM_TLA_OVERRIDES[team.name];
  }
  return team.tla || team.shortName || team.name || fallback;
}

/** Generate consistent TBD labels for a match based on match ID */
export function getTbdLabels(matchId: number): { home: string; away: string } {
  // Use last 2 digits of match ID for a short identifier
  const matchNum = matchId % 100;
  return {
    home: `${matchNum}H`,
    away: `${matchNum}A`,
  };
}

/**
 * Get team display name with consistent TBD fallback
 * Use this in components to display team names
 */
export function getTeamDisplayName(
  team:
    | { tla?: string | null; shortName?: string | null; name?: string | null }
    | null
    | undefined,
  matchId: number,
  position: "home" | "away",
): string {
  // Check for override first
  if (team?.name && TEAM_TLA_OVERRIDES[team.name]) {
    return TEAM_TLA_OVERRIDES[team.name];
  }
  if (team?.tla) return team.tla;
  if (team?.shortName) return team.shortName;
  if (team?.name) return team.name;
  const labels = getTbdLabels(matchId);
  return position === "home" ? labels.home : labels.away;
}

function getStageName(stage: string): string {
  const names: Record<string, string> = {
    GROUP_STAGE: "Group Stage",
    LAST_32: "Round of 32",
    LAST_16: "Round of 16",
    QUARTER_FINALS: "Quarter-Finals",
    SEMI_FINALS: "Semi-Finals",
    THIRD_PLACE: "3rd Place",
    FINAL: "Final",
  };
  return names[stage] || stage;
}

// =====================================================================
// SINGLE-MATCH SCORING FUNCTIONS
// =====================================================================

/** Check if a match is currently live (in progress) */
function isMatchLive(match: Match): boolean {
  return match.status === "IN_PLAY" || match.status === "PAUSED";
}

/** Check if a match has scorable status (finished or live) */
function isMatchScorable(match: Match): boolean {
  return match.status === "FINISHED" || isMatchLive(match);
}

/**
 * Calculate total points for a single match prediction
 *
 * @param match - The match from API
 * @param prediction - User's prediction (can be undefined/null)
 * @param predictedHomeTeam - For knockout: the team user predicted for home slot
 * @param predictedAwayTeam - For knockout: the team user predicted for away slot
 * @returns MatchPointsResult with total and metadata
 */
export function calculateMatchPoints(
  match: Match,
  prediction: Prediction | null | undefined,
  predictedHomeTeam?: { id: number } | null,
  predictedAwayTeam?: { id: number } | null,
): MatchPointsResult {
  const multiplier = isGroupStageMatch(match)
    ? 1
    : ROUND_MULTIPLIERS[match.stage] || 1;
  const isKnockout = !isGroupStageMatch(match);
  const isLive = isMatchLive(match);

  // Max possible: result points × multiplier + 4 goals points (2 per team)
  // For knockout: 2 × multiplier (win + lose or 2 × tie) + 4 goals = 2*mult + 4
  // For group: 2 (result) + 2 (goals) = 4
  const maxPossible = isKnockout
    ? 2 * multiplier + 4 // knockout: result (×mult) + goals (2 per team)
    : POINTS_CORRECT_RESULT + POINTS_CORRECT_GOALS * 2; // group: 4 points

  // Check if we can calculate
  if (
    !prediction ||
    prediction.home_goals === null ||
    prediction.away_goals === null
  ) {
    return {
      total: 0,
      maxPossible,
      hasPrediction: false,
      isFinished: match.status === "FINISHED",
      isLive,
    };
  }

  // Only calculate for finished or live matches
  if (!isMatchScorable(match)) {
    return {
      total: 0,
      maxPossible,
      hasPrediction: true,
      isFinished: false,
      isLive: false,
    };
  }

  const actualHome = match.score.fullTime.home;
  const actualAway = match.score.fullTime.away;

  if (actualHome === null || actualAway === null) {
    return {
      total: 0,
      maxPossible,
      hasPrediction: true,
      isFinished: false,
      isLive: false,
    };
  }

  let total = 0;

  // Result points
  const predictedResult = getPredictionResult(
    prediction.home_goals,
    prediction.away_goals,
  );
  const actualResult = getMatchResult(match);

  if (predictedResult === actualResult) {
    if (isKnockout) {
      // Knockout: 1 point for each team outcome × multiplier (win+lose or tie+tie)
      total += 2 * multiplier;
    } else {
      // Group stage: 2 points for correct result
      total += POINTS_CORRECT_RESULT;
    }
  }

  // Goals points (always 1 point each, no multiplier)
  // For knockout: only award if the predicted team matches the actual team in that slot
  const homeTeamMatches =
    !isKnockout ||
    !predictedHomeTeam ||
    predictedHomeTeam.id === match.homeTeam?.id;
  const awayTeamMatches =
    !isKnockout ||
    !predictedAwayTeam ||
    predictedAwayTeam.id === match.awayTeam?.id;

  if (homeTeamMatches && prediction.home_goals === actualHome) {
    total += POINTS_CORRECT_GOALS;
  }
  if (awayTeamMatches && prediction.away_goals === actualAway) {
    total += POINTS_CORRECT_GOALS;
  }

  return {
    total,
    maxPossible,
    hasPrediction: true,
    isFinished: match.status === "FINISHED",
    isLive,
  };
}

/**
 * Calculate detailed breakdown of points for a match
 * Useful for showing users what they got right/wrong
 *
 * @param match - The match from API
 * @param prediction - User's prediction
 * @param predictedHomeTeam - For knockout: the team user predicted for home slot
 * @param predictedAwayTeam - For knockout: the team user predicted for away slot
 */
export function calculateMatchPointsDetailed(
  match: Match,
  prediction: Prediction | null | undefined,
  predictedHomeTeam?: { id: number } | null,
  predictedAwayTeam?: { id: number } | null,
): MatchPointsBreakdown {
  const multiplier = isGroupStageMatch(match)
    ? 1
    : ROUND_MULTIPLIERS[match.stage] || 1;
  const isKnockout = !isGroupStageMatch(match);
  const isLive = isMatchLive(match);
  const details: PointDetail[] = [];

  let resultPoints = 0;
  let homeGoalsPoints = 0;
  let awayGoalsPoints = 0;

  // Cannot calculate without prediction
  if (
    !prediction ||
    prediction.home_goals === null ||
    prediction.away_goals === null
  ) {
    return {
      resultPoints: 0,
      homeGoalsPoints: 0,
      awayGoalsPoints: 0,
      multiplier,
      total: 0,
      details: [
        { description: "No prediction made", points: 0, earned: false },
      ],
    };
  }

  // Only calculate for finished or live matches
  if (!isMatchScorable(match)) {
    return {
      resultPoints: 0,
      homeGoalsPoints: 0,
      awayGoalsPoints: 0,
      multiplier,
      total: 0,
      details: [{ description: "Match not started", points: 0, earned: false }],
    };
  }

  const actualHome = match.score.fullTime.home;
  const actualAway = match.score.fullTime.away;

  if (actualHome === null || actualAway === null) {
    return {
      resultPoints: 0,
      homeGoalsPoints: 0,
      awayGoalsPoints: 0,
      multiplier,
      total: 0,
      details: [
        { description: "Match result unavailable", points: 0, earned: false },
      ],
    };
  }

  const predictedResult = getPredictionResult(
    prediction.home_goals,
    prediction.away_goals,
  );
  const actualResult = getMatchResult(match)!;
  const tbdLabels = getTbdLabels(match.id);

  // Result check
  const correctResult = predictedResult === actualResult;
  if (isKnockout && match.stage !== "LAST_32") {
    // Knockout (R16+): show winner and loser separately (or both ties)
    if (actualResult === "draw") {
      // Both teams tied - 1 point each × multiplier
      resultPoints = correctResult ? 2 * multiplier : 0;
      details.push({
        description: `${getTeamName(match.homeTeam, tbdLabels.home)} tie${multiplier > 1 ? ` (${multiplier}×)` : ""}`,
        points: 1 * multiplier,
        earned: correctResult,
      });
      details.push({
        description: `${getTeamName(match.awayTeam, tbdLabels.away)} tie${multiplier > 1 ? ` (${multiplier}×)` : ""}`,
        points: 1 * multiplier,
        earned: correctResult,
      });
    } else {
      // Winner and loser
      const winner = actualResult === "home" ? match.homeTeam : match.awayTeam;
      const loser = actualResult === "home" ? match.awayTeam : match.homeTeam;
      const winnerFallback =
        actualResult === "home" ? tbdLabels.home : tbdLabels.away;
      const loserFallback =
        actualResult === "home" ? tbdLabels.away : tbdLabels.home;
      resultPoints = correctResult ? 2 * multiplier : 0;
      details.push({
        description: `${getTeamName(winner, winnerFallback)} win${multiplier > 1 ? ` (${multiplier}×)` : ""}`,
        points: 1 * multiplier,
        earned: correctResult,
      });
      details.push({
        description: `${getTeamName(loser, loserFallback)} loss${multiplier > 1 ? ` (${multiplier}×)` : ""}`,
        points: 1 * multiplier,
        earned: correctResult,
      });
    }
  } else {
    // Group stage OR R32: simple "correct result" format
    resultPoints = correctResult ? POINTS_CORRECT_RESULT * multiplier : 0;
    const resultLabel =
      actualResult === "draw"
        ? "Draw"
        : actualResult === "home"
          ? `${getTeamName(match.homeTeam, tbdLabels.home)} win`
          : `${getTeamName(match.awayTeam, tbdLabels.away)} win`;
    details.push({
      description: `Correct result (${resultLabel})${multiplier > 1 ? ` (${multiplier}×)` : ""}`,
      points: POINTS_CORRECT_RESULT * multiplier,
      earned: correctResult,
    });
  }

  // For knockout: can only get goal points if the predicted team matches the actual team
  // If no predicted team is provided, fall back to checking if team is known
  const homeTeamMatches =
    !isKnockout ||
    (predictedHomeTeam
      ? predictedHomeTeam.id === match.homeTeam?.id
      : !!match.homeTeam?.tla);
  const awayTeamMatches =
    !isKnockout ||
    (predictedAwayTeam
      ? predictedAwayTeam.id === match.awayTeam?.id
      : !!match.awayTeam?.tla);

  // Home goals check
  const correctHomeGoals =
    homeTeamMatches && prediction.home_goals === actualHome;
  homeGoalsPoints = correctHomeGoals ? POINTS_CORRECT_GOALS : 0;
  details.push({
    description: `${getTeamName(match.homeTeam, tbdLabels.home)} goals (${actualHome})`,
    points: POINTS_CORRECT_GOALS,
    earned: correctHomeGoals,
    // Show as not applicable if predicted team doesn't match actual team
    ...(isKnockout && !homeTeamMatches ? { notApplicable: true } : {}),
  });

  // Away goals check
  const correctAwayGoals =
    awayTeamMatches && prediction.away_goals === actualAway;
  awayGoalsPoints = correctAwayGoals ? POINTS_CORRECT_GOALS : 0;
  details.push({
    description: `${getTeamName(match.awayTeam, tbdLabels.away)} goals (${actualAway})`,
    points: POINTS_CORRECT_GOALS,
    earned: correctAwayGoals,
    // Show as not applicable if predicted team doesn't match actual team
    ...(isKnockout && !awayTeamMatches ? { notApplicable: true } : {}),
  });

  return {
    resultPoints,
    homeGoalsPoints,
    awayGoalsPoints,
    multiplier,
    total: resultPoints + homeGoalsPoints + awayGoalsPoints,
    details,
  };
}

/**
 * Get maximum possible points for a match type
 */
export function getMaxPossiblePoints(match: Match): number {
  const multiplier = isGroupStageMatch(match)
    ? 1
    : ROUND_MULTIPLIERS[match.stage] || 1;
  const isKnockout = !isGroupStageMatch(match);

  return isKnockout
    ? 2 * multiplier + 2
    : POINTS_CORRECT_RESULT + POINTS_CORRECT_GOALS * 2;
}

// =====================================================================
// GROUP STAGE SCORING
// =====================================================================

export function calculateGroupStagePoints(
  match: Match,
  prediction: Prediction | undefined,
): PointBreakdown[] {
  const points: PointBreakdown[] = [];
  const isLive = isMatchLive(match);

  if (
    !prediction ||
    prediction.home_goals === null ||
    prediction.away_goals === null
  ) {
    return points;
  }

  // Calculate for finished or live matches
  if (!isMatchScorable(match)) {
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

  const predictionInfo = {
    homeGoals: prediction.home_goals,
    awayGoals: prediction.away_goals,
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
      isLive,
      matchInfo,
      prediction: predictionInfo,
    });
  }

  // 1 point for exact home goals
  if (prediction.home_goals === actualHomeGoals) {
    points.push({
      matchId: match.id,
      description: `Correct goals`,
      points: 1,
      type: "goals_home",
      isLive,
      team: {
        tla: match.homeTeam.tla,
        crest: match.homeTeam.crest,
        name: match.homeTeam.name,
      },
      matchInfo,
      prediction: predictionInfo,
    });
  }

  // 1 point for exact away goals
  if (prediction.away_goals === actualAwayGoals) {
    points.push({
      matchId: match.id,
      description: `Correct goals`,
      points: 1,
      type: "goals_away",
      isLive,
      team: {
        tla: match.awayTeam.tla,
        crest: match.awayTeam.crest,
        name: match.awayTeam.name,
      },
      matchInfo,
      prediction: predictionInfo,
    });
  }

  return points;
}

export function calculateKnockoutPoints(
  match: Match,
  prediction: Prediction | undefined,
): PointBreakdown[] {
  const points: PointBreakdown[] = [];
  const isLive = isMatchLive(match);

  if (
    !prediction ||
    prediction.home_goals === null ||
    prediction.away_goals === null
  ) {
    return points;
  }

  // Calculate for finished or live matches
  if (!isMatchScorable(match)) {
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

  const predictionInfo = {
    homeGoals: prediction.home_goals,
    awayGoals: prediction.away_goals,
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
        isLive,
        team: {
          tla: match.homeTeam.tla,
          crest: match.homeTeam.crest,
          name: match.homeTeam.name,
        },
        matchInfo,
        prediction: predictionInfo,
      });
      points.push({
        matchId: match.id,
        description: `${stageName} tie${multiplier > 1 ? ` (${multiplier}×)` : ""}`,
        points: 1 * multiplier,
        type: "knockout_tie",
        isLive,
        team: {
          tla: match.awayTeam.tla,
          crest: match.awayTeam.crest,
          name: match.awayTeam.name,
        },
        matchInfo,
        prediction: predictionInfo,
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
        isLive,
        team: { tla: winner.tla, crest: winner.crest, name: winner.name },
        matchInfo,
        prediction: predictionInfo,
      });
      points.push({
        matchId: match.id,
        description: `${stageName} loser${multiplier > 1 ? ` (${multiplier}×)` : ""}`,
        points: 1 * multiplier,
        type: "knockout_lose",
        isLive,
        team: { tla: loser.tla, crest: loser.crest, name: loser.name },
        matchInfo,
        prediction: predictionInfo,
      });
    }
  }

  // 2 points for exact goals in knockout (no multiplier for goals)
  if (prediction.home_goals === actualHomeGoals) {
    points.push({
      matchId: match.id,
      description: `Correct goals`,
      points: 2,
      type: "goals_home",
      isLive,
      team: {
        tla: match.homeTeam.tla,
        crest: match.homeTeam.crest,
        name: match.homeTeam.name,
      },
      matchInfo,
      prediction: predictionInfo,
    });
  }

  if (prediction.away_goals === actualAwayGoals) {
    points.push({
      matchId: match.id,
      description: `Correct goals`,
      points: 2,
      type: "goals_away",
      isLive,
      team: {
        tla: match.awayTeam.tla,
        crest: match.awayTeam.crest,
        name: match.awayTeam.name,
      },
      matchInfo,
      prediction: predictionInfo,
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
  groupMatches: (Match & { fifaNumber?: FifaMatchId | null })[],
  predictions: Map<FifaMatchId, Prediction>, // Keyed by FIFA match number
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

  // Calculate stats from predictions (use fifaNumber for lookup)
  groupMatches.forEach((match) => {
    const fifaNumber = match.fifaNumber;
    const prediction = fifaNumber ? predictions.get(fifaNumber) : undefined;
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
  matches: (Match & { fifaNumber?: FifaMatchId | null })[],
  predictions: Prediction[], // Keyed by FIFA match number (match_id)
  groupOverrides: GroupStandingsOverride[],
  actualGroupStandings: Map<string, CalculatedStanding[]>,
  advancingTeamIds: Set<number>,
): { totalPoints: number; livePoints: number; breakdown: PointBreakdown[] } {
  // Predictions are keyed by FIFA match number
  const predictionMap = new Map<FifaMatchId, Prediction>(
    predictions.map((p) => [p.match_id as FifaMatchId, p]),
  );
  const allBreakdown: PointBreakdown[] = [];

  // Calculate match points - use fifaNumber for prediction lookup
  matches.forEach((match) => {
    // Use fifaNumber to look up prediction (it's keyed by FIFA number now)
    const fifaNumber = match.fifaNumber;
    const prediction = fifaNumber ? predictionMap.get(fifaNumber) : undefined;

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
  const livePoints = allBreakdown
    .filter((p) => p.isLive)
    .reduce((sum, p) => sum + p.points, 0);

  return { totalPoints, livePoints, breakdown: allBreakdown };
}
