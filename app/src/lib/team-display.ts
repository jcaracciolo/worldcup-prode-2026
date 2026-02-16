/**
 * Team Display Utilities
 *
 * Centralized logic for displaying team names and crests across the app.
 * Handles all scenarios:
 * - Real teams with data
 * - Placeholder teams (UEFA playoffs, Intercontinental playoffs)
 * - Knockout bracket positions (1A, 2B, 3rd)
 * - R16+ source matches (W73, W74)
 */

import { Team, Match, FifaMatchId, asFifaMatchId } from "@/types/football";
import { CalculatedStanding } from "@/types/football";
import { LocalPrediction } from "@/types/database";
import type { ResolvedTeams } from "@/lib/bracket-resolver";
import {
  r32Bracket,
  r16Bracket,
  qfBracket,
  sfBracket,
} from "@/lib/r32-bracket";
import { isPlaceholderTeamId } from "@/lib/tbd-teams";

// =====================================================================
// HELPERS
// =====================================================================

/**
 * Truncate a team label for compact display.
 * Real TLAs (3 chars) stay at 3; bracket labels like W100, L101 keep 4.
 */
export function shortLabel(label: string): string {
  // Bracket labels with 3-digit match numbers (W100, L101, etc.) → keep full
  if (/^[WL]\d{3}$/.test(label)) return label;
  return label.substring(0, 3);
}

// =====================================================================
// TYPES
// =====================================================================

export interface TeamDisplay {
  /** The resolved team object (null if not yet determined) */
  team: Team | null;
  /** Display label: "USA", "EU1", "1A", "W73", etc. */
  label: string;
  /** Whether this is a placeholder (no real team yet) */
  isPlaceholder: boolean;
}

export interface TeamDisplayContext {
  /** The match being displayed */
  match: Match;
  /** Position in the match */
  position: "home" | "away";
  /** Resolved teams from BracketResolver (if available) */
  resolvedTeams?: ResolvedTeams;
  /** Group standings for R32 resolution (by group name) */
  groupStandings?: Map<string, CalculatedStanding[]>;
  /** User's knockout predictions (for inferring R16+ teams) */
  predictions?: Map<FifaMatchId, LocalPrediction>;
}

// =====================================================================
// TLA OVERRIDES
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

  // Case 1: Real team from API (valid ID, not a placeholder)
  if (
    matchTeam &&
    matchTeam.id !== null &&
    matchTeam.id > 0 &&
    !isPlaceholderTeamId(matchTeam.id)
  ) {
    return {
      team: matchTeam,
      label: getTeamTla(matchTeam),
      isPlaceholder: false,
    };
  }

  // Case 2: Resolved team from BracketResolver
  if (resolvedTeam && resolvedTeam.id !== null) {
    const isPlaceholder = isPlaceholderTeamId(resolvedTeam.id);
    return {
      team: resolvedTeam,
      label: isPlaceholder ? resolvedTeam.tla : getTeamTla(resolvedTeam),
      isPlaceholder,
    };
  }

  // Case 3: Use display name from BracketResolver
  if (resolvedDisplayName) {
    return {
      team: null,
      label: resolvedDisplayName,
      isPlaceholder: true,
    };
  }

  // Case 4: Calculate bracket label for knockout matches
  if (match.stage !== "GROUP_STAGE" && fifaMatchNumber >= 73) {
    const label = getBracketLabel(fifaMatchNumber, position);
    return {
      team: null,
      label,
      isPlaceholder: true,
    };
  }

  // Case 5: Group stage with placeholder team
  if (matchTeam && isPlaceholderTeamId(matchTeam.id)) {
    return {
      team: matchTeam,
      label: matchTeam.tla,
      isPlaceholder: true,
    };
  }

  // Fallback: Unknown team
  return {
    team: null,
    label: "TBD",
    isPlaceholder: true,
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
 * Get the bracket label for a knockout match position.
 * R32: "1A", "2B", "3rd"
 * R16+: "W73", "W74", etc.
 */
export function getBracketLabel(
  fifaMatchNumber: FifaMatchId,
  position: "home" | "away",
): string {
  // R32 matches (73-88): Show group position
  const r32Slot = r32Bracket.find((s) => s.matchNumber === fifaMatchNumber);
  if (r32Slot) {
    const pos =
      position === "home" ? r32Slot.homePosition : r32Slot.awayPosition;
    if (pos) {
      const groupLetter = pos.group.replace("GROUP_", "");
      return `${pos.position}${groupLetter}`;
    }
    return "3rd";
  }

  // R16 matches (89-96): Winner of R32
  const r16Slot = r16Bracket.find((s) => s.matchNumber === fifaMatchNumber);
  if (r16Slot) {
    const sourceMatch =
      position === "home" ? r16Slot.homeFromR32 : r16Slot.awayFromR32;
    return `W${sourceMatch}`;
  }

  // QF matches (97-100): Winner of R16
  const qfSlot = qfBracket.find((s) => s.matchNumber === fifaMatchNumber);
  if (qfSlot) {
    const sourceMatch =
      position === "home" ? qfSlot.homeFromR16 : qfSlot.awayFromR16;
    return `W${sourceMatch}`;
  }

  // SF matches (101-102): Winner of QF
  const sfSlot = sfBracket.find((s) => s.matchNumber === fifaMatchNumber);
  if (sfSlot) {
    const sourceMatch =
      position === "home" ? sfSlot.homeFromQF : sfSlot.awayFromQF;
    return `W${sourceMatch}`;
  }

  // Third place (103): Losers of SF
  if (fifaMatchNumber === 103) {
    return position === "home" ? "L101" : "L102";
  }

  // Final (104): Winners of SF
  if (fifaMatchNumber === 104) {
    return position === "home" ? "W101" : "W102";
  }

  return "TBD";
}

/**
 * Check if a team is a real team (positive ID, not a placeholder)
 */
export function isRealTeam(team: Team | null): boolean {
  return (
    team !== null &&
    team.id !== null &&
    team.id > 0 &&
    !isPlaceholderTeamId(team.id)
  );
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
  // Real team with valid ID
  if (
    team &&
    team.id !== null &&
    team.id !== undefined &&
    team.id > 0 &&
    !isPlaceholderTeamId(team.id)
  ) {
    return {
      team: team as Team,
      label:
        TEAM_TLA_OVERRIDES[team.name || ""] ||
        team.tla ||
        team.shortName ||
        team.name ||
        "TBD",
      isPlaceholder: false,
    };
  }

  // Placeholder team (EU1, IC1, etc.)
  if (
    team &&
    team.id !== null &&
    team.id !== undefined &&
    isPlaceholderTeamId(team.id)
  ) {
    return {
      team: team as Team,
      label: team.tla || "TBD",
      isPlaceholder: true,
    };
  }

  // Team without ID - just use names
  if (team && (team.tla || team.shortName || team.name)) {
    return {
      team: null,
      label:
        TEAM_TLA_OVERRIDES[team.name || ""] ||
        team.tla ||
        team.shortName ||
        team.name ||
        "TBD",
      isPlaceholder: true,
    };
  }

  // Knockout match without team - show bracket label
  if (fifaMatchNumber && fifaMatchNumber >= 73) {
    return {
      team: null,
      label: getBracketLabel(fifaMatchNumber, position),
      isPlaceholder: true,
    };
  }

  // Group stage without team - qualifier placeholder
  return {
    team: null,
    label: "QUA",
    isPlaceholder: true,
  };
}
