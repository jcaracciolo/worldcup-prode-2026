// Calculate which 8 of the 12 third-place teams qualify for R32
// Based on FIFA tiebreaker rules:
// 1. Points
// 2. Goal difference
// 3. Goals scored
// 4. Fair play points (not tracked - skip)
// 5. Drawing of lots (random at tie)

import { CalculatedStanding } from "@/types/football";

export interface ThirdPlaceTeam extends CalculatedStanding {
  group: string;
  qualifies: boolean;
  rank: number; // 1-12, where 1-8 qualify
}

/**
 * Takes all group standings and returns which third-place teams qualify
 * @param groupStandings Map of group name to standings array
 * @returns Map of group name to boolean (true if 3rd place qualifies)
 */
export function getQualifyingThirdPlaceTeams(
  groupStandings: Map<string, CalculatedStanding[]>
): Map<string, boolean> {
  const thirdPlaceTeams: ThirdPlaceTeam[] = [];

  // Collect all third place teams
  groupStandings.forEach((standings, group) => {
    if (standings.length >= 3) {
      const thirdPlace = standings[2]; // Index 2 = 3rd place
      thirdPlaceTeams.push({
        ...thirdPlace,
        group,
        qualifies: false,
        rank: 0,
      });
    }
  });

  // Sort by FIFA tiebreaker rules
  thirdPlaceTeams.sort((a, b) => {
    // 1. Points (descending)
    if (a.points !== b.points) {
      return b.points - a.points;
    }
    // 2. Goal difference (descending)
    if (a.goalDifference !== b.goalDifference) {
      return b.goalDifference - a.goalDifference;
    }
    // 3. Goals scored (descending)
    if (a.goalsFor !== b.goalsFor) {
      return b.goalsFor - a.goalsFor;
    }
    // 4. If still tied, use alphabetical group order (deterministic fallback)
    return a.group.localeCompare(b.group);
  });

  // Top 8 qualify
  thirdPlaceTeams.forEach((team, index) => {
    team.rank = index + 1;
    team.qualifies = index < 8;
  });

  // Create result map
  const result = new Map<string, boolean>();
  thirdPlaceTeams.forEach((team) => {
    result.set(team.group, team.qualifies);
  });

  return result;
}

/**
 * Get the full ranked list of third-place teams with their standings
 */
export function getRankedThirdPlaceTeams(
  groupStandings: Map<string, CalculatedStanding[]>
): ThirdPlaceTeam[] {
  const thirdPlaceTeams: ThirdPlaceTeam[] = [];

  groupStandings.forEach((standings, group) => {
    if (standings.length >= 3) {
      const thirdPlace = standings[2];
      thirdPlaceTeams.push({
        ...thirdPlace,
        group,
        qualifies: false,
        rank: 0,
      });
    }
  });

  thirdPlaceTeams.sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
    if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
    return a.group.localeCompare(b.group);
  });

  thirdPlaceTeams.forEach((team, index) => {
    team.rank = index + 1;
    team.qualifies = index < 8;
  });

  return thirdPlaceTeams;
}
