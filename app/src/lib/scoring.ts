import {
  Match,
  PointBreakdown,
  CalculatedStanding,
  Team,
  FifaMatchId,
} from "@/types/football";
import { LocalPrediction, LocalGroupStandingsOverride } from "@/types/database";
import {
  getMatchResult,
  getPredictionResult,
  isGroupStageMatch,
} from "./football-api";
import { BracketResolver } from "./bracket-resolver";


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

// =====================================================================
// UTILITY FUNCTIONS - Team display names and helpers
// =====================================================================

/** Team abbreviation overrides for teams with missing or non-standard TLA */
const TEAM_TLA_OVERRIDES: Record<string, string> = {
  Curaçao: "CUW",
  Curacao: "CUW",
  "Côte d'Ivoire": "CIV",
  "Korea Republic": "KOR",
  "South Korea": "KOR",
};

/**
 * Get team abbreviation with fallbacks - use for standings and non-match contexts.
 * Default fallback is "QUA" for teams that haven't qualified to the World Cup yet.
 * For knockout bracket labels, use getTeamDisplayName instead.
 */
export function getTeamLabel(
  team:
    | { tla?: string | null; shortName?: string | null; name?: string | null }
    | null
    | undefined,
  fallback: string = "QUA",
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
  prediction: LocalPrediction | null | undefined,
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

  // Goals points
  // Group stage: 1 point each, Knockout: 2 points each
  // For knockout: only award if the predicted team matches the actual team in that slot
  const goalsPointsPerTeam = isKnockout ? 2 : POINTS_CORRECT_GOALS;
  const homeTeamMatches =
    !isKnockout ||
    !predictedHomeTeam ||
    predictedHomeTeam.id === match.homeTeam?.id;
  const awayTeamMatches =
    !isKnockout ||
    !predictedAwayTeam ||
    predictedAwayTeam.id === match.awayTeam?.id;

  if (homeTeamMatches && prediction.home_goals === actualHome) {
    total += goalsPointsPerTeam;
  }
  if (awayTeamMatches && prediction.away_goals === actualAway) {
    total += goalsPointsPerTeam;
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
 * Get maximum possible points for a match type
 */
export function getMaxPossiblePoints(match: Match): number {
  const multiplier = isGroupStageMatch(match)
    ? 1
    : ROUND_MULTIPLIERS[match.stage] || 1;
  const isKnockout = !isGroupStageMatch(match);

  return isKnockout
    ? 2 * multiplier + 4 // result (2 × multiplier) + goals (2 per team × 2)
    : POINTS_CORRECT_RESULT + POINTS_CORRECT_GOALS * 2;
}

// =====================================================================
// GROUP STAGE SCORING
// =====================================================================

export function calculateGroupStagePoints(
  match: Match,
  prediction: LocalPrediction | undefined,
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
    const homeTla = getTeamLabel(match.homeTeam);
    points.push({
      matchId: match.id,
      description: `Correct goals (${homeTla})`,
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
    const awayTla = getTeamLabel(match.awayTeam);
    points.push({
      matchId: match.id,
      description: `Correct goals (${awayTla})`,
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
  prediction: LocalPrediction | undefined,
  /** User's predicted teams for this match slot (from BracketResolver) */
  predictedTeams: {
    home?: { id: number; tla?: string; crest?: string | null; shortName?: string; name?: string } | null;
    away?: { id: number; tla?: string; crest?: string | null; shortName?: string; name?: string } | null;
  } | undefined,
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

  // match.homeTeam/awayTeam already have resolved teams baked in by MatchContext
  const homeTeam = match.homeTeam;
  const awayTeam = match.awayTeam;

  const matchInfo = {
    homeTeam: {
      tla: homeTeam.tla,
      crest: homeTeam.crest,
      shortName: homeTeam.shortName,
    },
    awayTeam: {
      tla: awayTeam.tla,
      crest: awayTeam.crest,
      shortName: awayTeam.shortName,
    },
    homeGoals: actualHomeGoals,
    awayGoals: actualAwayGoals,
    stage: match.stage,
  };

  const predictionInfo = {
    homeGoals: prediction.home_goals,
    awayGoals: prediction.away_goals,
  };

  // Build predicted team info for display (which teams the user predicted for this slot)
  const predictedTeamInfo = predictedTeams
    ? {
        homeTeam: predictedTeams.home
          ? {
              tla: predictedTeams.home.tla || homeTeam.tla,
              crest: predictedTeams.home.crest ?? homeTeam.crest,
              shortName: predictedTeams.home.shortName || homeTeam.shortName,
            }
          : null,
        awayTeam: predictedTeams.away
          ? {
              tla: predictedTeams.away.tla || awayTeam.tla,
              crest: predictedTeams.away.crest ?? awayTeam.crest,
              shortName: predictedTeams.away.shortName || awayTeam.shortName,
            }
          : null,
      }
    : undefined;

  // For knockout, we award points for correct result (win or tie)
  // R32: single "result" entry (teams are fixed by group standings)
  // R16+: separate win/lose or tie entries (user also predicts which teams play)
  const isR32 = match.stage === "LAST_32";

  if (actualResult === "draw") {
    if (predictedResult === "draw") {
      if (isR32) {
        // R32: single result entry
        points.push({
          matchId: match.id,
          description: `${stageName} tie`,
          points: 2 * multiplier,
          type: "result",
          isLive,
          matchInfo,
          prediction: predictionInfo,
          predictedTeamInfo,
        });
      } else {
        // R16+: separate tie entries per team
        points.push({
          matchId: match.id,
          description: `${stageName} tie${multiplier > 1 ? ` (${multiplier}×)` : ""}`,
          points: 1 * multiplier,
          type: "knockout_tie",
          isLive,
          team: {
            tla: homeTeam.tla,
            crest: homeTeam.crest,
            name: homeTeam.name,
          },
          matchInfo,
          prediction: predictionInfo,
          predictedTeamInfo,
        });
        points.push({
          matchId: match.id,
          description: `${stageName} tie${multiplier > 1 ? ` (${multiplier}×)` : ""}`,
          points: 1 * multiplier,
          type: "knockout_tie",
          isLive,
          team: {
            tla: awayTeam.tla,
            crest: awayTeam.crest,
            name: awayTeam.name,
          },
          matchInfo,
          prediction: predictionInfo,
          predictedTeamInfo,
        });
      }
    }
  } else {
    // Home or Away won
    if (predictedResult === actualResult) {
      if (isR32) {
        // R32: single result entry
        points.push({
          matchId: match.id,
          description: `${stageName} win`,
          points: 2 * multiplier,
          type: "result",
          isLive,
          matchInfo,
          prediction: predictionInfo,
          predictedTeamInfo,
        });
      } else {
        // R16+: separate winner/loser entries
        const winner = actualResult === "home" ? homeTeam : awayTeam;
        const loser = actualResult === "home" ? awayTeam : homeTeam;
        points.push({
          matchId: match.id,
          description: `${stageName} winner${multiplier > 1 ? ` (${multiplier}×)` : ""}`,
          points: 1 * multiplier,
          type: "knockout_win",
          isLive,
          team: { tla: winner.tla, crest: winner.crest, name: winner.name },
          matchInfo,
          prediction: predictionInfo,
          predictedTeamInfo,
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
          predictedTeamInfo,
        });
      }
    }
  }

  // 2 points for exact goals in knockout (no multiplier for goals)
  // Only award if the user's predicted team matches the actual team in that slot
  const homeTeamMatches =
    !predictedTeams ||
    !predictedTeams.home ||
    predictedTeams.home.id === homeTeam.id;
  const awayTeamMatches =
    !predictedTeams ||
    !predictedTeams.away ||
    predictedTeams.away.id === awayTeam.id;

  if (homeTeamMatches && prediction.home_goals === actualHomeGoals) {
    const homeTla = getTeamLabel(homeTeam);
    points.push({
      matchId: match.id,
      description: `Correct goals (${homeTla})`,
      points: 2,
      type: "goals_home",
      isLive,
      team: {
        tla: homeTeam.tla,
        crest: homeTeam.crest,
        name: homeTeam.name,
      },
      matchInfo,
      prediction: predictionInfo,
      predictedTeamInfo,
    });
  }

  if (awayTeamMatches && prediction.away_goals === actualAwayGoals) {
    const awayTla = getTeamLabel(awayTeam);
    points.push({
      matchId: match.id,
      description: `Correct goals (${awayTla})`,
      points: 2,
      type: "goals_away",
      isLive,
      team: {
        tla: awayTeam.tla,
        crest: awayTeam.crest,
        name: awayTeam.name,
      },
      matchInfo,
      prediction: predictionInfo,
      predictedTeamInfo,
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
  predictedThirdPlaceQualifies: boolean = false, // Whether user predicted 3rd place would qualify
): PointBreakdown[] {
  const points: PointBreakdown[] = [];

  // Only award group bonus points when group stage is complete
  if (!groupComplete) {
    return points;
  }

  // Don't award bonus points if user made no predictions for this group
  // (all teams would have played=0, giving arbitrary insertion-order standings)
  const hasAnyPredictions = predictedStandings.some((s) => s.played > 0);
  if (!hasAnyPredictions) {
    return points;
  }

  const groupLetter = groupName.replace("GROUP_", "");

  predictedStandings.forEach((predicted, index) => {
    const predictedPosition = index + 1;
    const actual = actualStandings.find((s) => s.team.id === predicted.team.id);

    if (!actual || !predicted.team) return;

    // User must have predicted team to advance:
    // - Positions 1-2 always advance
    // - Position 3 only advances if user's predicted 3rd place qualifies (best 4 of 12)
    const predictedToAdvance =
      predictedPosition <= 2 ||
      (predictedPosition === 3 && predictedThirdPlaceQualifies);

    // 1 point if user predicted team to advance AND team actually advanced
    if (predictedToAdvance && advancingTeamIds.has(predicted.team.id)) {
      const positionText =
        predictedPosition === 1
          ? "1st"
          : predictedPosition === 2
            ? "2nd"
            : "3rd";
      points.push({
        matchId: 0,
        description: `Predicted ${positionText} to advance from Group ${groupLetter}`,
        points: 1,
        type: "group_advance",
        team: {
          tla: predicted.team.tla || "QUA",
          crest: predicted.team.crest || "",
          name: predicted.team.name || "Qualifier",
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
            tla: predicted.team.tla || "QUA",
            crest: predicted.team.crest || "",
            name: predicted.team.name || "Qualifier",
          },
        });
      }
    }
  });

  return points;
}

export function calculateStandingsFromPredictions(
  groupMatches: (Match & { fifaNumber?: FifaMatchId | null })[],
  predictions: Map<FifaMatchId, LocalPrediction>, // Keyed by FIFA match number
  overrides: LocalGroupStandingsOverride[],
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
  predictions: LocalPrediction[], // Keyed by FIFA match number (match_id)
  groupOverrides: LocalGroupStandingsOverride[],
  actualGroupStandings: Map<string, CalculatedStanding[]>,
  advancingTeamIds: Set<number>,
  predictedThirdPlaceQualifying?: Map<string, boolean>, // User's predicted 3rd place qualifying
): { totalPoints: number; livePoints: number; breakdown: PointBreakdown[] } {
  // Predictions are keyed by FIFA match number
  const predictionMap = new Map<FifaMatchId, LocalPrediction>(
    predictions.map((p) => [p.match_id as FifaMatchId, p]),
  );
  const allBreakdown: PointBreakdown[] = [];

  // Calculate all predicted group standings first (needed for BracketResolver)
  const groupMatches = matches.filter(isGroupStageMatch);
  const groupedMatches = new Map<string, Match[]>();
  groupMatches.forEach((match) => {
    if (!match.group) return;
    if (!groupedMatches.has(match.group)) {
      groupedMatches.set(match.group, []);
    }
    groupedMatches.get(match.group)!.push(match);
  });

  const allPredictedStandings = new Map<string, CalculatedStanding[]>();
  groupedMatches.forEach((groupMatchList, groupName) => {
    const groupOverridesForGroup = groupOverrides.filter(
      (o) => o.group_name === groupName,
    );
    const predictedStandings = calculateStandingsFromPredictions(
      groupMatchList,
      predictionMap,
      groupOverridesForGroup,
    );
    allPredictedStandings.set(groupName, predictedStandings);
  });

  // Run BracketResolver with user's predicted group standings to get their predicted knockout teams
  const userPredictedTeams = new BracketResolver({
    matches,
    predictions: predictionMap,
    groupStandings: allPredictedStandings,
    thirdPlaceQualifying: predictedThirdPlaceQualifying || new Map(),
    useKnockoutPredictions: true, // Use user's knockout predictions for R16+
  }).resolve();

  // Calculate match points - use fifaNumber for prediction lookup
  matches.forEach((match) => {
    // match.id IS the FIFA number (converted at API layer)
    // fifaNumber field is just for enhanced matches with explicit typing
    const fifaNumber = (match.fifaNumber ?? match.id) as FifaMatchId;
    const prediction = predictionMap.get(fifaNumber);

    if (isGroupStageMatch(match)) {
      allBreakdown.push(...calculateGroupStagePoints(match, prediction));
    } else {
      // For knockout, pass the user's predicted teams for this match
      const predictedTeams = userPredictedTeams.get(fifaNumber);
      allBreakdown.push(
        ...calculateKnockoutPoints(match, prediction, predictedTeams),
      );
    }
  });

  // Calculate group standings bonus points
  groupedMatches.forEach((groupMatchList, groupName) => {
    const predictedStandings = allPredictedStandings.get(groupName);
    const actualStandings = actualGroupStandings.get(groupName);

    // Check if all matches in this group are finished (6 matches per group)
    const finishedMatches = groupMatchList.filter(
      (m) => m.status === "FINISHED",
    );
    const groupComplete =
      finishedMatches.length === groupMatchList.length &&
      groupMatchList.length > 0;

    if (actualStandings && predictedStandings) {
      const thirdPlaceQualifies =
        predictedThirdPlaceQualifying?.get(groupName) || false;
      allBreakdown.push(
        ...calculateGroupStandingsBonusPoints(
          groupName,
          predictedStandings,
          actualStandings,
          advancingTeamIds,
          groupComplete,
          thirdPlaceQualifies,
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
