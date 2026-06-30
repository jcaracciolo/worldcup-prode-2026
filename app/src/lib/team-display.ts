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

import { Team, FifaMatchId } from "@/types/football";
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
// TLA OVERRIDES
// =====================================================================

const TEAM_TLA_OVERRIDES: Record<string, string> = {
  Curaçao: "CUW",
  Curacao: "CUW",
  "Côte d'Ivoire": "CIV",
  "Korea Republic": "KOR",
  "South Korea": "KOR",
};

/**
 * Get team abbreviation with fallbacks — for standings and non-match contexts.
 * Default fallback is "QUA" for teams that haven't qualified yet.
 * For knockout bracket labels, use getTeamDisplaySimple instead.
 */
export function getTeamLabel(
  team:
    | { tla?: string | null; shortName?: string | null; name?: string | null }
    | null
    | undefined,
  fallback: string = "QUA",
): string {
  if (!team) return fallback;
  if (team.name && TEAM_TLA_OVERRIDES[team.name]) {
    return TEAM_TLA_OVERRIDES[team.name];
  }
  return team.tla || team.shortName || team.name || fallback;
}

// =====================================================================
// HELPER FUNCTIONS
// =====================================================================

/**
 * Third-place qualifier pools per R32 match (FIFA official, regulations
 * numbering). The away slot of these matches is a "best third" from one of the
 * listed groups; FIFA shows the eligible-group pool rather than a generic "3rd".
 * Source: FIFA match calendar (PlaceHolderB), api.fifa.com.
 */
const THIRD_PLACE_POOLS: Record<number, string> = {
  74: "ABCDF",
  77: "CDFGH",
  79: "CEFHI",
  80: "EHIJK",
  81: "BEFIJ",
  82: "AEHIJ",
  85: "EFGIJ",
  87: "DEIJL",
};

/**
 * Get the bracket label for a knockout match position.
 * R32: "1A", "2B", "3ABCDF"
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
    // Dynamic third-place slot — show the eligible-group pool (FIFA style).
    const pool = THIRD_PLACE_POOLS[fifaMatchNumber as number];
    return pool ? `3${pool}` : "3rd";
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
 * Get the display label for a team.
 *
 * Works with any team object — matches should already have their teams
 * baked in (by MatchContext for actual teams, or usePredictedMatches for
 * predicted teams). This is the single team display function used across
 * the entire app.
 *
 * Priority order:
 * 1. Real team with valid ID (returns TLA, not a placeholder)
 * 2. Placeholder team (EU1, IC1, etc.)
 * 3. Team without ID but with name/TLA
 * 4. Knockout bracket label (1A, W73, etc.)
 * 5. Fallback: "QUA" for group stage, bracket label for knockout
 */
export function getTeamDisplaySimple(
  team: Partial<Team> | null | undefined,
  fifaMatchId: FifaMatchId,
  position: "home" | "away",
): string {
  // Real team with valid ID
  if (
    team &&
    team.id !== null &&
    team.id !== undefined &&
    team.id > 0 &&
    !isPlaceholderTeamId(team.id)
  ) {
    return (
      TEAM_TLA_OVERRIDES[team.name || ""] ||
      team.tla ||
      team.shortName ||
      team.name ||
      "TBD"
    );
  }

  // Placeholder team (EU1, IC1, etc.)
  if (
    team &&
    team.id !== null &&
    team.id !== undefined &&
    isPlaceholderTeamId(team.id)
  ) {
    return team.tla || "TBD";
  }

  // Team without ID - just use names
  if (team && (team.tla || team.shortName || team.name)) {
    return (
      TEAM_TLA_OVERRIDES[team.name || ""] ||
      team.tla ||
      team.shortName ||
      team.name ||
      "TBD"
    );
  }

  // Knockout match without team - show bracket label
  if (fifaMatchId && fifaMatchId >= 73) {
    return getBracketLabel(fifaMatchId, position);
  }

  // Group stage without team - qualifier placeholder
  return "QUA";
}
