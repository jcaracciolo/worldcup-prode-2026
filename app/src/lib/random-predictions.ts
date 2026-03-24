/**
 * Random score generator for predictions.
 *
 * Extracted from usePredictionEditor — fills empty prediction slots
 * with random scores using a realistic distribution.
 */

import { MatchWithLiveInfo } from "@/contexts/MatchContext";
import { FifaMatchId } from "@/types/football";
import { LocalPrediction } from "@/types/database";

/**
 * Generate a random score using a realistic distribution:
 *   40% chance of 0 goals
 *   30% chance of 1 goal
 *   15% chance of 2 goals
 *   10% chance of 3 goals
 *    5% chance of 4 goals
 */
export function randomScore(): number {
  const r = Math.random();
  if (r < 0.4) return 0;
  if (r < 0.7) return 1;
  if (r < 0.85) return 2;
  if (r < 0.95) return 3;
  return 4;
}

/**
 * Fill empty predictions with random scores.
 * Returns a new Map with unfilled slots populated.
 * Does not modify locked stages.
 */
export function randomFillPredictions(
  matches: MatchWithLiveInfo[],
  predictions: Map<FifaMatchId, LocalPrediction>,
  opts: {
    groupLocked: boolean;
    knockoutOpen: boolean;
    knockoutLocked: boolean;
  },
): Map<FifaMatchId, LocalPrediction> {
  const newPredictions = new Map(predictions);

  matches.forEach((match) => {
    const fifaNumber = match.id;

    const existing = newPredictions.get(fifaNumber);
    if (
      existing &&
      existing.home_goals !== null &&
      existing.away_goals !== null
    ) {
      return;
    }

    const isGroupStage = match.stage === "GROUP_STAGE";
    if (isGroupStage && opts.groupLocked) return;
    if (!isGroupStage && (!opts.knockoutOpen || opts.knockoutLocked)) return;

    const homeGoals = randomScore();
    const awayGoals = randomScore();

    let penaltyWinner: "HOME" | "AWAY" | null = null;
    if (!isGroupStage && homeGoals === awayGoals) {
      penaltyWinner = Math.random() < 0.5 ? "HOME" : "AWAY";
    }

    newPredictions.set(fifaNumber, {
      match_id: fifaNumber,
      home_goals: homeGoals,
      away_goals: awayGoals,
      penalty_winner: penaltyWinner,
    });
  });

  return newPredictions;
}
