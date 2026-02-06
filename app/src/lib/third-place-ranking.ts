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
  groupStandings: Map<string, CalculatedStanding[]>,
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
  groupStandings: Map<string, CalculatedStanding[]>,
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
    if (a.goalDifference !== b.goalDifference)
      return b.goalDifference - a.goalDifference;
    if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
    return a.group.localeCompare(b.group);
  });

  thirdPlaceTeams.forEach((team, index) => {
    team.rank = index + 1;
    team.qualifies = index < 8;
  });

  return thirdPlaceTeams;
}

/**
 * R32 matches that have third-place teams as the away team
 * Each match has a "pool" of groups the 3rd place team can come from
 * The group letter cannot match the home team's group winner
 */
const R32_THIRD_PLACE_MATCHES = [
  { matchNumber: 74, homeGroup: "E", pool: ["A", "B", "C", "D", "F"] },
  { matchNumber: 77, homeGroup: "I", pool: ["C", "D", "F", "G", "H"] },
  { matchNumber: 79, homeGroup: "A", pool: ["C", "E", "F", "H", "I"] },
  { matchNumber: 80, homeGroup: "L", pool: ["E", "H", "I", "J", "K"] },
  { matchNumber: 81, homeGroup: "D", pool: ["B", "E", "F", "I", "J"] },
  { matchNumber: 82, homeGroup: "G", pool: ["A", "E", "H", "I", "J"] },
  { matchNumber: 85, homeGroup: "B", pool: ["E", "F", "G", "I", "J"] },
  { matchNumber: 87, homeGroup: "K", pool: ["D", "E", "I", "J", "L"] },
];

/**
 * Assign qualifying 3rd place teams to R32 matches
 * Uses a greedy assignment that respects the pool constraints
 * Returns map of FIFA match number -> group letter of 3rd place team
 */
export function assignThirdPlaceToR32(
  qualifyingGroups: string[],
): Map<number, string> {
  const result = new Map<number, string>();
  const assigned = new Set<string>();

  // Convert qualifying groups to single letters (e.g., "GROUP_A" -> "A")
  const groups = qualifyingGroups.map((g) => g.replace("GROUP_", ""));

  // Sort matches by pool size (smallest first for better assignment)
  const sortedMatches = [...R32_THIRD_PLACE_MATCHES].sort(
    (a, b) => {
      const aAvailable = a.pool.filter(g => groups.includes(g)).length;
      const bAvailable = b.pool.filter(g => groups.includes(g)).length;
      return aAvailable - bAvailable;
    }
  );

  // Greedy assignment
  for (const match of sortedMatches) {
    // Find the best qualifying group for this match
    const availableFromPool = match.pool.filter(
      (g) => groups.includes(g) && !assigned.has(g)
    );

    if (availableFromPool.length > 0) {
      // Pick the first available (they're sorted by pool size, so this works)
      const selectedGroup = availableFromPool[0];
      result.set(match.matchNumber, `GROUP_${selectedGroup}`);
      assigned.add(selectedGroup);
    }
  }

  return result;
}

/**
 * Get which 3rd place team plays in a specific R32 match
 * @param matchNumber FIFA match number (74, 77, 79, 80, 81, 82, 85, 87)
 * @param groupStandings All group standings
 * @returns The 3rd place team that plays in this match, or null
 */
export function getThirdPlaceTeamForMatch(
  matchNumber: number,
  groupStandings: Map<string, CalculatedStanding[]>,
): { team: CalculatedStanding["team"]; group: string } | null {
  // Get qualifying 3rd place groups
  const qualifyingMap = getQualifyingThirdPlaceTeams(groupStandings);
  const qualifyingGroups = Array.from(qualifyingMap.entries())
    .filter(([, qualifies]) => qualifies)
    .map(([group]) => group);

  // Get assignment
  const assignments = assignThirdPlaceToR32(qualifyingGroups);
  const assignedGroup = assignments.get(matchNumber);

  if (!assignedGroup) return null;

  // Get the team from standings
  const standings = groupStandings.get(assignedGroup);
  if (!standings || standings.length < 3) return null;

  return {
    team: standings[2].team,
    group: assignedGroup,
  };
}
