// Calculate which 8 of the 12 third-place teams qualify for R32
// Based on FIFA tiebreaker rules:
// 1. Points
// 2. Goal difference
// 3. Goals scored
// 4. Fair play points (not tracked - skip)
// 5. Drawing of lots (random at tie)

import { CalculatedStanding } from "@/types/football";
import { LocalThirdPlaceOverride } from "@/types/database";
import {
  lookupThirdPlaceAssignment,
  THIRD_PLACE_MATCH_ORDER,
} from "./fifa-third-place-table";

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

  // Sort by FIFA tiebreaker rules for ranking best third-placed teams
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
    // 4. Number of wins (descending)
    if (a.won !== b.won) {
      return b.won - a.won;
    }
    // 5. Fair play points (not tracked - skip)
    // 6. Drawing of lots — use alphabetical group order as deterministic fallback
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
    if (a.won !== b.won) return b.won - a.won;
    return a.group.localeCompare(b.group);
  });

  thirdPlaceTeams.forEach((team, index) => {
    team.rank = index + 1;
    team.qualifies = index < 8;
  });

  return thirdPlaceTeams;
}

/**
 * Get the full ranked list of third-place teams, applying manual overrides.
 * Overrides let users reorder tied teams (same pts + GD + GF) to decide
 * which qualify for R32.
 */
export function getRankedThirdPlaceTeamsWithOverrides(
  groupStandings: Map<string, CalculatedStanding[]>,
  overrides: LocalThirdPlaceOverride[],
): ThirdPlaceTeam[] {
  // Start with the natural ranking
  const teams = getRankedThirdPlaceTeams(groupStandings);

  if (overrides.length === 0) return teams;

  // Apply overrides: move each overridden team to its specified rank
  for (const override of overrides) {
    const teamIndex = teams.findIndex((t) => t.group === override.group_name);
    if (teamIndex === -1) continue;

    const [team] = teams.splice(teamIndex, 1);
    // rank is 1-based, insert at rank-1
    const targetIndex = Math.max(0, Math.min(override.rank - 1, teams.length));
    teams.splice(targetIndex, 0, team);
  }

  // Re-assign rank and qualification after overrides
  teams.forEach((team, index) => {
    team.rank = index + 1;
    team.qualifies = index < 8;
  });

  return teams;
}

/**
 * Get qualifying third-place teams with overrides applied.
 * Returns Map<groupName, boolean> like getQualifyingThirdPlaceTeams.
 */
export function getQualifyingThirdPlaceTeamsWithOverrides(
  groupStandings: Map<string, CalculatedStanding[]>,
  overrides: LocalThirdPlaceOverride[],
): Map<string, boolean> {
  const teams = getRankedThirdPlaceTeamsWithOverrides(groupStandings, overrides);
  const result = new Map<string, boolean>();
  teams.forEach((team) => {
    result.set(team.group, team.qualifies);
  });
  return result;
}

/**
 * Check if a third-place team at the given index can be swapped up.
 * Only swappable if same points AND the tied group straddles the
 * qualification cutoff (some qualify, some don't).
 */
export function canSwapThirdPlaceUp(
  teams: ThirdPlaceTeam[],
  index: number,
): boolean {
  if (index <= 0 || index >= teams.length) return false;
  if (teams[index].points !== teams[index - 1].points) return false;
  return tiedGroupStraddlesCutoff(teams, index);
}

/**
 * Check if a third-place team at the given index can be swapped down.
 * Only swappable if same points AND the tied group straddles the
 * qualification cutoff (some qualify, some don't).
 */
export function canSwapThirdPlaceDown(
  teams: ThirdPlaceTeam[],
  index: number,
): boolean {
  if (index < 0 || index >= teams.length - 1) return false;
  if (teams[index].points !== teams[index + 1].points) return false;
  return tiedGroupStraddlesCutoff(teams, index);
}

/**
 * Check if the group of teams tied on points with the team at `index`
 * straddles the qualification cutoff (rank 8/9 boundary).
 */
function tiedGroupStraddlesCutoff(
  teams: ThirdPlaceTeam[],
  index: number,
): boolean {
  const pts = teams[index].points;
  // Find the range of teams with the same points
  let start = index;
  while (start > 0 && teams[start - 1].points === pts) start--;
  let end = index;
  while (end < teams.length - 1 && teams[end + 1].points === pts) end++;
  // Check if the tied range includes both qualifying (index < 8) and non-qualifying (index >= 8)
  return start < 8 && end >= 8;
}

/**
 * R32 matches that have third-place teams as the away team.
 * Each match has a "pool" of groups whose 3rd-place team can be assigned there.
 * Pools derived from the official FIFA 495-entry lookup table.
 * Note: Some matches allow the 3rd-place team from the same group as the
 * home team's group winner (e.g., 3E vs 1E) per FIFA regulations.
 */
const R32_THIRD_PLACE_MATCHES = [
  { matchNumber: 74, homeGroup: "E", pool: ["C", "E", "F", "H", "I"] },
  { matchNumber: 77, homeGroup: "I", pool: ["E", "F", "G", "I", "J"] },
  { matchNumber: 79, homeGroup: "A", pool: ["B", "E", "F", "I", "J"] },
  { matchNumber: 80, homeGroup: "L", pool: ["A", "B", "C", "D", "F"] },
  { matchNumber: 81, homeGroup: "D", pool: ["A", "E", "H", "I", "J"] },
  { matchNumber: 82, homeGroup: "G", pool: ["C", "D", "F", "G", "H"] },
  { matchNumber: 85, homeGroup: "B", pool: ["D", "E", "I", "J", "L"] },
  { matchNumber: 87, homeGroup: "K", pool: ["E", "H", "I", "J", "K"] },
];

/**
 * Get the pool of possible groups for a 3rd place team in a specific R32 match
 */
export function getThirdPlacePoolForMatch(
  matchNumber: number,
): string[] | null {
  const match = R32_THIRD_PLACE_MATCHES.find(
    (m) => m.matchNumber === matchNumber,
  );
  return match?.pool || null;
}

/**
 * Assign qualifying 3rd place teams to R32 matches using the official FIFA lookup table.
 * FIFA has predetermined all 495 possible combinations of which 8 groups qualify
 * and which 3rd place team plays which group winner.
 *
 * @param rankedQualifyingGroups Array of group letters in rank order (best first)
 * @returns Map of FIFA match number -> group letter of 3rd place team
 */
export function assignThirdPlaceToR32(
  rankedQualifyingGroups: string[],
): Map<number, string> {
  const result = new Map<number, string>();

  // Convert qualifying groups to single letters (e.g., "GROUP_A" -> "A")
  const qualifyingLetters = rankedQualifyingGroups.map((g) =>
    g.replace("GROUP_", ""),
  );

  if (qualifyingLetters.length !== 8) {
    return result; // Can't determine assignments with incomplete data
  }

  // Use the official FIFA lookup table for each R32 match
  for (const matchNumber of THIRD_PLACE_MATCH_ORDER) {
    const assignedGroup = lookupThirdPlaceAssignment(
      qualifyingLetters,
      matchNumber,
    );
    if (assignedGroup) {
      result.set(matchNumber, assignedGroup);
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

  const groupKey = usesPrefix
    ? `GROUP_${assignedGroupLetter}`
    : assignedGroupLetter;
  const standings = groupStandings.get(groupKey);

  if (!standings || standings.length < 3) return null;

  return {
    team: standings[2].team,
    group: groupKey,
  };
}
