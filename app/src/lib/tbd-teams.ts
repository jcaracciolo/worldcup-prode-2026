/**
 * TBD Team Placeholders for FIFA World Cup 2026
 *
 * The 48-team World Cup has 6 TBD slots:
 * - 4 UEFA Nations League playoff winners (teams from Europe's playoff system)
 * - 2 Inter-confederation playoff winners (teams from playoff between confederations)
 *
 * These teams appear in groups A, B, D, F, I, K based on the draw.
 * We assign synthetic IDs (negative numbers) to avoid collision with real team IDs.
 */

import { Team, Match } from "@/types/football";

// Placeholder team definitions with negative IDs
// Using -1xxx for UEFA playoff winners, -2xxx for Inter-confederation
export const TBD_TEAMS: Record<string, Team> = {
  // UEFA Nations League Playoff Winners
  GROUP_A: {
    id: -1001,
    name: "UEFA Playoff Winner 1",
    shortName: "UEFA PO1",
    tla: "PO1",
    crest: null,
  },
  GROUP_B: {
    id: -1002,
    name: "UEFA Playoff Winner 2",
    shortName: "UEFA PO2",
    tla: "PO2",
    crest: null,
  },
  GROUP_D: {
    id: -1003,
    name: "UEFA Playoff Winner 3",
    shortName: "UEFA PO3",
    tla: "PO3",
    crest: null,
  },
  GROUP_F: {
    id: -1004,
    name: "UEFA Playoff Winner 4",
    shortName: "UEFA PO4",
    tla: "PO4",
    crest: null,
  },
  // Inter-confederation Playoff Winners
  GROUP_I: {
    id: -2001,
    name: "Intercontinental PO 1",
    shortName: "IC PO1",
    tla: "IC1",
    crest: null,
  },
  GROUP_K: {
    id: -2002,
    name: "Intercontinental PO 2",
    shortName: "IC PO2",
    tla: "IC2",
    crest: null,
  },
};

/**
 * Check if a team is a TBD placeholder (null or invalid)
 */
function isTbdTeam(team: Team | null): boolean {
  return !team || team.id === null || team.id === undefined;
}

/**
 * Get the placeholder team for a group's TBD slot
 */
export function getPlaceholderTeam(group: string): Team | null {
  return TBD_TEAMS[group] || null;
}

/**
 * Replace TBD teams in a match with placeholder teams
 * This ensures all matches have valid team objects with IDs
 */
export function resolveTbdTeams(match: Match): Match {
  const group = match.group;
  if (!group || match.stage !== "GROUP_STAGE") {
    return match;
  }

  const placeholder = getPlaceholderTeam(group);
  if (!placeholder) {
    return match;
  }

  let homeTeam = match.homeTeam;
  let awayTeam = match.awayTeam;

  if (isTbdTeam(homeTeam)) {
    homeTeam = placeholder;
  }
  if (isTbdTeam(awayTeam)) {
    awayTeam = placeholder;
  }

  // Only create new object if something changed
  if (homeTeam === match.homeTeam && awayTeam === match.awayTeam) {
    return match;
  }

  return {
    ...match,
    homeTeam,
    awayTeam,
  };
}

/**
 * Apply TBD team resolution to all matches
 */
export function resolveAllTbdTeams(matches: Match[]): Match[] {
  return matches.map(resolveTbdTeams);
}

/**
 * Check if a team ID is a placeholder (negative ID)
 */
export function isPlaceholderTeamId(teamId: number): boolean {
  return teamId < 0;
}

/**
 * Get all placeholder team IDs
 */
export function getAllPlaceholderTeamIds(): number[] {
  return Object.values(TBD_TEAMS).map((t) => t.id);
}
