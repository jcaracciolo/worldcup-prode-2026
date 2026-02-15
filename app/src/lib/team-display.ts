/**
 * Team Display Utilities
 *
 * Centralized logic for displaying team names and crests across the app.
 * Handles all scenarios:
 * - Real teams with data
 * - Knockout bracket positions (1A, 2B, 3rd)
 * - R16+ source matches (W73, W74)
 *
 * Note: TBD/placeholder teams (UEFA playoffs, Inter-confederation playoffs) are
 * resolved at the API layer (see api-client.ts / tbd-teams.ts) before data
 * reaches the rest of the application. This module does not need to distinguish
 * between real and placeholder teams.
 */

import { Team, Match, FifaMatchId, asFifaMatchId } from "@/types/football";
import { CalculatedStanding } from "@/types/football";
import { LocalPrediction } from "@/types/database";
import { getKnockoutTbdLabel } from "@/lib/r32-bracket";

// =====================================================================
// TYPES
// =====================================================================

export interface TeamDisplay {
  /** The resolved team object (null if not yet determined) */
  team: Team | null;
  /** Display label: "USA", "PO1", "1A", "W73", etc. */
  label: string;
}

export interface TeamDisplayContext {
  /** The match being displayed */
  match: Match;
  /** Position in the match */
  position: "home" | "away";
  /** Resolved teams from BracketResolver (if available) */
  resolvedTeams?: {
    home: Team | null;
    away: Team | null;
    homeDisplayName?: string;
    awayDisplayName?: string;
  };
  /** Group standings for R32 resolution (by group name) */
  groupStandings?: Map<string, CalculatedStanding[]>;
  /** User knockout predictions (for inferring R16+ teams) */
  predictions?: Map<FifaMatchId, LocalPrediction>;
}

// =====================================================================
// TLA OVERRIDES - Single source of truth for team abbreviation corrections
// =====================================================================

const TEAM_TLA_OVERRIDES: Record<string, string> = {
  "Côte d'Ivoire": "CIV",
  "Korea Republic": "KOR",
  "South Korea": "KOR",
};

// =====================================================================
// MAIN FUNCTION
// =====================================================================

/**
 * Get the display information for a team in a match.
 *
 * Priority order:
 * 1. Real team from match data (API has determined the team)
 * 2. Resolved team from BracketResolver
 * 3. Bracket position label (1A, W73, etc.)
 */
export function getTeamDisplay(context: TeamDisplayContext): TeamDisplay {
  const { match, position, resolvedTeams } = context;
  const fifaMatchNumber = asFifaMatchId(match.id);

  // Get the team from match or resolved teams
  const matchTeam = position === "home" ? match.homeTeam : match.awayTeam;
  const resolvedTeam =
    position === "home" ? resolvedTeams?.home : resolvedTeams?.away;
  const resolvedDisplayName =
    position === "home"
      ? resolvedTeams?.homeDisplayName
      : resolvedTeams?.awayDisplayName;

  // Case 1: Team from API with valid data
  if (matchTeam && matchTeam.id !== null && matchTeam.id !== undefined) {
    return {
      team: matchTeam,
      label: getTeamTla(matchTeam),
    };
  }

  // Case 2: Resolved team from BracketResolver
  if (resolvedTeam && resolvedTeam.id !== null) {
    return {
      team: resolvedTeam,
      label: getTeamTla(resolvedTeam),
    };
  }

  // Case 3: Use display name from BracketResolver
  if (resolvedDisplayName) {
    return {
      team: null,
      label: resolvedDisplayName,
    };
  }

  // Case 4: Calculate bracket label for knockout matches
  if (match.stage !== "GROUP_STAGE" && fifaMatchNumber >= 73) {
    return {
      team: null,
      label: getKnockoutTbdLabel(fifaMatchNumber, position),
    };
  }

  // Fallback: Unknown team
  return {
    team: null,
    label: "TBD",
  };
}

// =====================================================================
// HELPER FUNCTIONS
// =====================================================================

/**
 * Get the TLA for a team, with overrides for special cases
 */
function getTeamTla(team: Team): string {
  if (team.name && TEAM_TLA_OVERRIDES[team.name]) {
    return TEAM_TLA_OVERRIDES[team.name];
  }
  return team.tla || team.shortName || team.name || "TBD";
}

/**
 * Simple team display helper for when you only have a team object.
 * Use this in components that don't have full match context (e.g., TeamName).
 * For knockout resolution with bracket-resolver, use the full getTeamDisplay.
 */
export function getTeamDisplaySimple(
  team:
    | Team
    | {
        id?: number | null;
        tla?: string | null;
        shortName?: string | null;
        name?: string | null;
        crest?: string | null;
      }
    | null
    | undefined,
  matchId: number,
  position: "home" | "away",
  fifaMatchNumber?: FifaMatchId,
): TeamDisplay {
  // Team with valid data
  if (team && (team.tla || team.shortName || team.name)) {
    return {
      team: (team.id !== null && team.id !== undefined ? team : null) as Team | null,
      label:
        TEAM_TLA_OVERRIDES[team.name || ""] ||
        team.tla ||
        team.shortName ||
        team.name ||
        "TBD",
    };
  }

  // Knockout match without team - show bracket label
  if (fifaMatchNumber && fifaMatchNumber >= 73) {
    return {
      team: null,
      label: getKnockoutTbdLabel(fifaMatchNumber, position),
    };
  }

  // Group stage without team - qualifier placeholder
  return {
    team: null,
    label: "QUA",
  };
}
