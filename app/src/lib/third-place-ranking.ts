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
 * Get the pool of possible groups for a 3rd place team in a specific R32 match
 */
export function getThirdPlacePoolForMatch(matchNumber: number): string[] | null {
  const match = R32_THIRD_PLACE_MATCHES.find((m) => m.matchNumber === matchNumber);
  return match?.pool || null;
}

/**
 * Assign qualifying 3rd place teams to R32 matches based on their ranking.
 * Process matches in order of match number.
 * For each match, assign the highest-ranked qualifying 3rd place team
 * from that match's pool that hasn't been assigned yet.
 * 
 * @param rankedQualifyingGroups Array of group letters in rank order (best first)
 * @returns Map of FIFA match number -> group letter of 3rd place team
 */
export function assignThirdPlaceToR32(
  rankedQualifyingGroups: string[],
): Map<number, string> {
  const result = new Map<number, string>();
  const assigned = new Set<string>();

  // Convert qualifying groups to single letters (e.g., "GROUP_A" -> "A")
  const rankedLetters = rankedQualifyingGroups.map((g) => g.replace("GROUP_", ""));

  // Process matches in order of match number (deterministic)
  const matchesInOrder = [...R32_THIRD_PLACE_MATCHES].sort(
    (a, b) => a.matchNumber - b.matchNumber
  );

  for (const match of matchesInOrder) {
    // Find the highest-ranked qualifying group from this pool that hasn't been assigned
    for (const letter of rankedLetters) {
      if (match.pool.includes(letter) && !assigned.has(letter)) {
        result.set(match.matchNumber, letter);
        assigned.add(letter);
        break;
      }
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
  // Get ranked third place teams (already sorted by points/GD/goals)
  const rankedTeams = getRankedThirdPlaceTeams(groupStandings);
  
  // Get qualifying groups in rank order (top 8)
  const rankedQualifyingGroups = rankedTeams
    .filter((t) => t.qualifies)
    .map((t) => t.group);

  if (rankedQualifyingGroups.length < 8) {
    // Not enough qualifying teams yet (incomplete predictions)
    return null;
  }

  // Determine the key format used in groupStandings (could be "A" or "GROUP_A")
  const firstKey = groupStandings.keys().next().value;
  const usesPrefix = firstKey?.startsWith("GROUP_");

  // Get deterministic assignment based on ranked groups
  const assignments = assignThirdPlaceToR32(rankedQualifyingGroups);
  const assignedGroupLetter = assignments.get(matchNumber);

  if (!assignedGroupLetter) return null;

  const groupKey = usesPrefix ? `GROUP_${assignedGroupLetter}` : assignedGroupLetter;
  const standings = groupStandings.get(groupKey);
  
  if (!standings || standings.length < 3) return null;

  return {
    team: standings[2].team,
    group: groupKey,
  };
}
