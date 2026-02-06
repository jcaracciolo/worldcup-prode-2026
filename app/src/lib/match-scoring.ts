/**
 * Match Scoring Utility
 * 
 * Self-contained module for calculating points from predictions vs actual results.
 * All scoring constants and logic are defined here for easy modification.
 * 
 * USAGE:
 * - calculateMatchPoints(): Get total points for a single match
 * - calculateMatchPointsDetailed(): Get breakdown of points earned
 * - getMaxPossiblePoints(): Get max points available for a match
 */

import { Match } from "@/types/football";
import { Prediction } from "@/types/database";

// =============================================================================
// SCORING CONFIGURATION
// Modify these constants to change scoring rules
// =============================================================================

/** Points for predicting correct result (win/draw/loss) */
export const POINTS_CORRECT_RESULT = 2;

/** Points for predicting exact goals for one team */
export const POINTS_CORRECT_GOALS = 1;

/** 
 * Multipliers for knockout rounds 
 * Applied to result prediction points (not goals)
 */
export const KNOCKOUT_MULTIPLIERS: Record<string, number> = {
  LAST_32: 1,
  LAST_16: 2,
  QUARTER_FINALS: 3,
  SEMI_FINALS: 4,
  THIRD_PLACE: 5,
  FINAL: 6,
};

// =============================================================================
// TYPES
// =============================================================================

export interface MatchPointsResult {
  /** Total points earned from this match */
  total: number;
  /** Maximum possible points for this match type */
  maxPossible: number;
  /** Whether prediction was made */
  hasPrediction: boolean;
  /** Whether match is finished */
  isFinished: boolean;
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

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function isGroupStage(match: Match): boolean {
  return match.stage === "GROUP_STAGE";
}

function getMultiplier(match: Match): number {
  if (isGroupStage(match)) return 1;
  return KNOCKOUT_MULTIPLIERS[match.stage] || 1;
}

function getPredictedResult(homeGoals: number, awayGoals: number): "home" | "away" | "draw" {
  if (homeGoals > awayGoals) return "home";
  if (awayGoals > homeGoals) return "away";
  return "draw";
}

function getActualResult(match: Match): "home" | "away" | "draw" | null {
  const home = match.score.fullTime.home;
  const away = match.score.fullTime.away;
  if (home === null || away === null) return null;
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
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

/** Get team abbreviation with fallbacks */
function getTeamName(team: { tla?: string | null; shortName?: string | null; name?: string | null } | null | undefined, fallback: string = "TBD"): string {
  if (!team) return fallback;
  return team.tla || team.shortName || team.name || fallback;
}

/** Generate consistent TBD labels for a match based on match ID */
export function getTbdLabels(matchId: number): { home: string; away: string } {
  // Use last 2 digits of match ID for a short identifier
  const matchNum = matchId % 100;
  return {
    home: `#${matchNum}H`,
    away: `#${matchNum}A`,
  };
}

/** 
 * Get team display name with consistent TBD fallback 
 * Use this in components to display team names
 */
export function getTeamDisplayName(
  team: { tla?: string | null; shortName?: string | null; name?: string | null } | null | undefined,
  matchId: number,
  position: "home" | "away"
): string {
  if (team?.tla) return team.tla;
  if (team?.shortName) return team.shortName;
  if (team?.name) return team.name;
  const labels = getTbdLabels(matchId);
  return position === "home" ? labels.home : labels.away;
}

// =============================================================================
// MAIN SCORING FUNCTIONS
// =============================================================================

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
  predictedAwayTeam?: { id: number } | null
): MatchPointsResult {
  const multiplier = getMultiplier(match);
  const isKnockout = !isGroupStage(match);
  
  // Max possible: result points × multiplier + 2 goals points
  // For knockout: 2 × multiplier (win + lose or 2 × tie) + 2 goals = 2*mult + 2
  // For group: 2 (result) + 2 (goals) = 4
  const maxPossible = isKnockout 
    ? (2 * multiplier) + 2 // knockout: result (×mult) + goals
    : POINTS_CORRECT_RESULT + (POINTS_CORRECT_GOALS * 2); // group: 4 points

  // Check if we can calculate
  if (!prediction || prediction.home_goals === null || prediction.away_goals === null) {
    return { total: 0, maxPossible, hasPrediction: false, isFinished: match.status === "FINISHED" };
  }

  if (match.status !== "FINISHED") {
    return { total: 0, maxPossible, hasPrediction: true, isFinished: false };
  }

  const actualHome = match.score.fullTime.home;
  const actualAway = match.score.fullTime.away;

  if (actualHome === null || actualAway === null) {
    return { total: 0, maxPossible, hasPrediction: true, isFinished: false };
  }

  let total = 0;

  // Result points
  const predictedResult = getPredictedResult(prediction.home_goals, prediction.away_goals);
  const actualResult = getActualResult(match);

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
  const homeTeamMatches = !isKnockout || !predictedHomeTeam || predictedHomeTeam.id === match.homeTeam?.id;
  const awayTeamMatches = !isKnockout || !predictedAwayTeam || predictedAwayTeam.id === match.awayTeam?.id;
  
  if (homeTeamMatches && prediction.home_goals === actualHome) {
    total += POINTS_CORRECT_GOALS;
  }
  if (awayTeamMatches && prediction.away_goals === actualAway) {
    total += POINTS_CORRECT_GOALS;
  }

  return { total, maxPossible, hasPrediction: true, isFinished: true };
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
  predictedAwayTeam?: { id: number } | null
): MatchPointsBreakdown {
  const multiplier = getMultiplier(match);
  const isKnockout = !isGroupStage(match);
  const details: PointDetail[] = [];

  let resultPoints = 0;
  let homeGoalsPoints = 0;
  let awayGoalsPoints = 0;

  // Cannot calculate without prediction or finished match
  if (!prediction || prediction.home_goals === null || prediction.away_goals === null) {
    return {
      resultPoints: 0,
      homeGoalsPoints: 0,
      awayGoalsPoints: 0,
      multiplier,
      total: 0,
      details: [{ description: "No prediction made", points: 0, earned: false }],
    };
  }

  if (match.status !== "FINISHED") {
    return {
      resultPoints: 0,
      homeGoalsPoints: 0,
      awayGoalsPoints: 0,
      multiplier,
      total: 0,
      details: [{ description: "Match not finished", points: 0, earned: false }],
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
      details: [{ description: "Match result unavailable", points: 0, earned: false }],
    };
  }

  const predictedResult = getPredictedResult(prediction.home_goals, prediction.away_goals);
  const actualResult = getActualResult(match)!;
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
      const winnerFallback = actualResult === "home" ? tbdLabels.home : tbdLabels.away;
      const loserFallback = actualResult === "home" ? tbdLabels.away : tbdLabels.home;
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
    const resultLabel = actualResult === "draw" 
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
  const homeTeamMatches = !isKnockout || 
    (predictedHomeTeam ? predictedHomeTeam.id === match.homeTeam?.id : !!match.homeTeam?.tla);
  const awayTeamMatches = !isKnockout || 
    (predictedAwayTeam ? predictedAwayTeam.id === match.awayTeam?.id : !!match.awayTeam?.tla);

  // Home goals check
  const correctHomeGoals = homeTeamMatches && prediction.home_goals === actualHome;
  homeGoalsPoints = correctHomeGoals ? POINTS_CORRECT_GOALS : 0;
  details.push({
    description: `${getTeamName(match.homeTeam, tbdLabels.home)} goals (${actualHome})`,
    points: POINTS_CORRECT_GOALS,
    earned: correctHomeGoals,
    // Show as not applicable if predicted team doesn't match actual team
    ...(isKnockout && !homeTeamMatches ? { notApplicable: true } : {}),
  });

  // Away goals check
  const correctAwayGoals = awayTeamMatches && prediction.away_goals === actualAway;
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
  const multiplier = getMultiplier(match);
  const isKnockout = !isGroupStage(match);
  
  return isKnockout 
    ? (2 * multiplier) + 2 
    : POINTS_CORRECT_RESULT + (POINTS_CORRECT_GOALS * 2);
}

/**
 * Calculate total points across multiple matches
 */
export function calculateTotalPoints(
  matches: Match[],
  predictions: Map<number, Prediction>
): number {
  return matches.reduce((total, match) => {
    const prediction = predictions.get(match.id);
    const result = calculateMatchPoints(match, prediction);
    return total + result.total;
  }, 0);
}
