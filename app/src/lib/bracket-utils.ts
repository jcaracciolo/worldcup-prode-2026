/**
 * Shared types and utilities for bracket resolvers.
 *
 * Contains ResolvedTeams (the single source of truth for the interface),
 * isValidApiTeam, and other helpers shared by BracketResolver and
 * LiveBracketResolver.
 */

import { Team, FifaMatchId, Match } from "@/types/football";
import { getBracketLabel } from "./team-display";

// =====================================================================
// TYPES
// =====================================================================

export interface ResolvedTeams {
  home: Team | null;
  away: Team | null;
  /** Ready-to-use display name for home team (e.g., "USA", "1A", "W73", "3rd") */
  homeDisplayName: string;
  /** Ready-to-use display name for away team */
  awayDisplayName: string;
}

// =====================================================================
// TEAM VALIDATION
// =====================================================================

/**
 * Check if a team from the API is a real team (not a bracket-label placeholder).
 * Placeholder teams with negative IDs (EU1, IC2, etc.) ARE valid — they represent
 * real teams in the simulation/tournament.
 *
 * Rejects patterns: "1A", "28A", "TBD", "TBA", "W73", "L101"
 */
export function isValidApiTeam(team: Team | null): boolean {
  if (!team) return false;
  if (!team.id || team.id === 0) return false;
  if (!team.tla || team.tla.length === 0) return false;
  // Bracket-label patterns like "1A", "28A", "TBD", "W73", "L101" are NOT real teams
  if (/^\d+[A-Z]$/.test(team.tla)) return false;
  if (/^[WL]\d+$/.test(team.tla)) return false;
  if (team.tla === "TBD" || team.tla === "TBA") return false;
  return true;
}

// =====================================================================
// SHARED HELPERS
// =====================================================================

/**
 * Helper to build a ResolvedTeams object with computed display names.
 * If team exists: uses team.tla; if null: uses bracket label (1A, W73, L101, etc.)
 */
export function buildResolvedTeams(
  fifaNumber: FifaMatchId,
  home: Team | null,
  away: Team | null,
): ResolvedTeams {
  const homeDisplayName = home?.tla ?? getBracketLabel(fifaNumber, "home");
  const awayDisplayName = away?.tla ?? getBracketLabel(fifaNumber, "away");
  return { home, away, homeDisplayName, awayDisplayName };
}

/** Determine which side won a finished match */
export function getWinningSide(match: Match): "home" | "away" | null {
  if (match.status !== "FINISHED") return null;
  const home = match.score.fullTime.home ?? 0;
  const away = match.score.fullTime.away ?? 0;
  if (home > away) return "home";
  if (away > home) return "away";
  // Tie — check winner field (penalties/extra time)
  if (match.score.winner === "HOME_TEAM") return "home";
  if (match.score.winner === "AWAY_TEAM") return "away";
  return "home"; // fallback
}
