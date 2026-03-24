/**
 * Standings business logic utilities.
 *
 * Swap eligibility rules extracted from StandingsTable component.
 */

import { CalculatedStanding } from "@/types/football";

/**
 * Check if a team at the given index can swap up (with the team above).
 * Only teams with equal points can be swapped (manual tiebreaker override).
 */
export function canSwapUp(
  standings: CalculatedStanding[],
  index: number,
): boolean {
  if (index === 0) return false;
  return standings[index].points === standings[index - 1].points;
}

/**
 * Check if a team at the given index can swap down (with the team below).
 * Only teams with equal points can be swapped (manual tiebreaker override).
 */
export function canSwapDown(
  standings: CalculatedStanding[],
  index: number,
): boolean {
  if (index >= standings.length - 1) return false;
  return standings[index].points === standings[index + 1].points;
}
