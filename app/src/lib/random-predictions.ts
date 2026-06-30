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
 *   20% chance of 0 goals
 *   35% chance of 1 goal
 *   30% chance of 2 goals
 *   15% chance of 3 goals
 */
export function randomScore(): number {
  const r = Math.random();
  if (r < 0.2) return 0;
  if (r < 0.55) return 1;
  if (r < 0.85) return 2;
  return 3;
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
    /** Per-match knockout lock — a match that has individually kicked off is
     *  locked even before the global deadline. */
    isKnockoutMatchLocked?: (matchUtcDate: string | Date) => boolean;
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
    if (!isGroupStage) {
      if (!opts.knockoutOpen || opts.knockoutLocked) return;
      // Don't fill a knockout match that has individually locked (kicked off).
      if (opts.isKnockoutMatchLocked?.(match.utcDate)) return;
    }

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
