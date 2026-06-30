import type { Match, MatchesResponse } from "@/types/football";
import {
  normalizePenaltyShootoutScore,
  type RawFootballDataMatch,
} from "./score-normalization";

const API_BASE_URL = "https://api.football-data.org/v4";
const COMPETITION_CODE = "WC";

/**
 * Base provider: fetches the full schedule from football-data.org.
 * This is NOT a LiveDataProvider — it provides the base Match[] that
 * live providers overlay onto.
 */
export async function fetchBaseMatches(): Promise<Match[]> {
  const token = process.env.FOOTBALL_DATA_API_TOKEN;
  if (!token) {
    throw new Error("FOOTBALL_DATA_API_TOKEN not set");
  }

  const response = await fetch(
    `${API_BASE_URL}/competitions/${COMPETITION_CODE}/matches`,
    {
      headers: { "X-Auth-Token": token },
      next: { revalidate: 60 },
    },
  );

  if (!response.ok) {
    throw new Error(
      `football-data.org API failed: ${response.status} ${response.statusText}`,
    );
  }

  const data: MatchesResponse = await response.json();
  // Normalise penalty-shootout scores (real on-field score + advancer).
  return (data.matches as unknown as RawFootballDataMatch[]).map(
    normalizePenaltyShootoutScore,
  );
}

/**
 * Fetch a single match by API ID from football-data.org.
 */
export async function fetchBaseMatch(matchId: number): Promise<Match | null> {
  const token = process.env.FOOTBALL_DATA_API_TOKEN;
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}`, {
      headers: { "X-Auth-Token": token },
      next: { revalidate: 60 },
    });

    if (!response.ok) return null;
    const raw = (await response.json()) as RawFootballDataMatch;
    return normalizePenaltyShootoutScore(raw);
  } catch {
    return null;
  }
}
