/**
 * Prediction validation logic.
 *
 * Extracted from usePredictionEditor — checks for unfilled predictions
 * and ties without penalty winners before saving.
 */

import { MatchWithLiveInfo } from "@/contexts/MatchContext";
import { FifaMatchId } from "@/types/football";
import { LocalPrediction } from "@/types/database";

/**
 * Validate predictions and return a list of warning messages.
 * Returns an empty array if everything is filled correctly.
 */
export function validatePredictions(
  matches: MatchWithLiveInfo[],
  predictions: Map<FifaMatchId, LocalPrediction>,
  opts: {
    groupLocked: boolean;
    knockoutOpen: boolean;
    knockoutLocked: boolean;
    /** Per-match knockout lock — locked matches can no longer be filled, so
     *  they shouldn't be reported as "missing". */
    isKnockoutMatchLocked?: (matchUtcDate: string | Date) => boolean;
  },
): string[] {
  const warnings: string[] = [];

  // Count unfilled group predictions
  if (!opts.groupLocked) {
    const groupMatches = matches.filter((m) => m.stage === "GROUP_STAGE");
    const unfilledGroup = groupMatches.filter((m) => {
      const pred = predictions.get(m.id);
      return !pred || pred.home_goals === null || pred.away_goals === null;
    });
    if (unfilledGroup.length > 0) {
      warnings.push(
        `${unfilledGroup.length} of ${groupMatches.length} group matches are missing predictions`,
      );
    }
  }

  // Count unfilled knockout predictions and ties without winner.
  // Skip matches that have already individually locked (kicked off) — they can
  // no longer be edited, so don't nag about them.
  if (opts.knockoutOpen && !opts.knockoutLocked) {
    const koMatches = matches.filter(
      (m) =>
        m.stage !== "GROUP_STAGE" &&
        !opts.isKnockoutMatchLocked?.(m.utcDate),
    );
    const unfilledKo = koMatches.filter((m) => {
      const pred = predictions.get(m.id);
      return !pred || pred.home_goals === null || pred.away_goals === null;
    });
    if (unfilledKo.length > 0) {
      warnings.push(
        `${unfilledKo.length} of ${koMatches.length} knockout matches are missing predictions`,
      );
    }

    const tiesWithoutWinner = koMatches.filter((m) => {
      const pred = predictions.get(m.id);
      if (!pred || pred.home_goals === null || pred.away_goals === null)
        return false;
      return pred.home_goals === pred.away_goals && !pred.penalty_winner;
    });
    if (tiesWithoutWinner.length > 0) {
      warnings.push(
        `${tiesWithoutWinner.length} knockout match${tiesWithoutWinner.length > 1 ? "es have" : " has"} a tie without a penalty winner selected`,
      );
    }
  }

  return warnings;
}
