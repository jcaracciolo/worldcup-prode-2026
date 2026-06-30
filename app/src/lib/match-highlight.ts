/**
 * Match result highlighting utilities.
 *
 * Consolidated logic for determining winner/loser/draw highlighting
 * on match results and predictions.
 */

import { MatchWithLiveInfo } from "@/contexts/MatchContext";

export interface MatchHighlight {
  homeWon: boolean;
  awayWon: boolean;
  isDraw: boolean;
  homeHighlight: boolean;
  awayHighlight: boolean;
}

/**
 * Compute match result highlighting for a finished (or live) match.
 * In group stage draws, both teams are highlighted.
 */
export function getMatchHighlight(match: MatchWithLiveInfo): MatchHighlight {
  const isFinished = match.status === "FINISHED";
  const homeGoals = match.score.fullTime.home;
  const awayGoals = match.score.fullTime.away;
  const hasScore =
    (isFinished || match.isLive) && homeGoals !== null && awayGoals !== null;
  const homeWon = isFinished && hasScore && homeGoals! > awayGoals!;
  const awayWon = isFinished && hasScore && awayGoals! > homeGoals!;
  const isDraw = isFinished && hasScore && homeGoals === awayGoals;
  const isGroupStage = match.stage === "GROUP_STAGE";
  const isKnockout = !isGroupStage;

  // A knockout match drawn in regular/extra time is decided on penalties: the
  // advancer is carried in score.winner. Highlight that team (the yellow bg),
  // mirroring the group-stage "both teams on a draw" behavior.
  const knockoutHomeAdvances =
    isDraw && isKnockout && match.score.winner === "HOME_TEAM";
  const knockoutAwayAdvances =
    isDraw && isKnockout && match.score.winner === "AWAY_TEAM";

  return {
    homeWon,
    awayWon,
    isDraw,
    homeHighlight: homeWon || (isGroupStage && isDraw) || knockoutHomeAdvances,
    awayHighlight: awayWon || (isGroupStage && isDraw) || knockoutAwayAdvances,
  };
}

export interface PredictionHighlight {
  home: boolean;
  away: boolean;
}

/**
 * Compute highlighting for a user's prediction score.
 * Handles group stage draws (both highlighted) and knockout penalty winners.
 */
export function getPredictionHighlight(
  homeGoals: number | null,
  awayGoals: number | null,
  isGroupStage: boolean,
  penaltyWinner?: "HOME" | "AWAY" | null,
): PredictionHighlight {
  const hasScore = homeGoals !== null && awayGoals !== null;
  if (!hasScore) return { home: false, away: false };

  const homeWins = homeGoals! > awayGoals!;
  const awayWins = awayGoals! > homeGoals!;
  const isDraw = homeGoals === awayGoals;
  const isKnockout = !isGroupStage;

  return {
    home:
      homeWins ||
      (isDraw && isGroupStage) ||
      (isDraw && isKnockout && penaltyWinner === "HOME"),
    away:
      awayWins ||
      (isDraw && isGroupStage) ||
      (isDraw && isKnockout && penaltyWinner === "AWAY"),
  };
}
