import type { Match } from "@/types/football";
import type { LiveMatchData } from "./types";
import { ProviderRateLimitError } from "./types";
import { providerRegistry } from "./provider-registry";
import { fetchBaseMatches } from "./football-data-provider";

// =====================================================================
// TIME-WINDOW GATING
// =====================================================================

const LIVE_WINDOW_BEFORE_MS = 15 * 60 * 1000; // 15 min before kickoff
const LIVE_WINDOW_AFTER_MS = 3 * 60 * 60 * 1000; // 3h after kickoff (covers ET/pens)

/**
 * Check if any match is in its live window based on scheduled kickoff times.
 * This determines whether we bother calling live providers at all.
 */
function hasMatchesInLiveWindow(matches: Match[]): boolean {
  const now = Date.now();
  return matches.some((m) => {
    if (m.status === "FINISHED" || m.status === "CANCELLED") return false;
    const kickoff = new Date(m.utcDate).getTime();
    return (
      now >= kickoff - LIVE_WINDOW_BEFORE_MS &&
      now <= kickoff + LIVE_WINDOW_AFTER_MS
    );
  });
}

/**
 * Get base matches that are in the live window (candidates for live overlay).
 */
function getMatchesInLiveWindow(matches: Match[]): Match[] {
  const now = Date.now();
  return matches.filter((m) => {
    if (m.status === "FINISHED" || m.status === "CANCELLED") return false;
    const kickoff = new Date(m.utcDate).getTime();
    return (
      now >= kickoff - LIVE_WINDOW_BEFORE_MS &&
      now <= kickoff + LIVE_WINDOW_AFTER_MS
    );
  });
}

// =====================================================================
// TEAM NAME MATCHING
// =====================================================================

/**
 * Normalize team name for cross-provider matching.
 * Handles common differences: "Korea Republic" vs "South Korea", accents, etc.
 */
function normalizeTeamName(name: string): string {
  // Common aliases used across different APIs
  const ALIASES: Record<string, string> = {
    "korea republic": "south korea",
    "korea, republic of": "south korea",
    "ir iran": "iran",
    "iran, islamic republic of": "iran",
    "côte d'ivoire": "ivory coast",
    "cote divoire": "ivory coast",
    "usa": "united states",
    "türkiye": "turkey",
    "turkiye": "turkey",
    "czech republic": "czechia",
    "cabo verde": "cape verde",
    "congo dr": "dr congo",
    "saudi arabia": "ksa",
  };

  let normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9\s]/g, "") // remove punctuation
    .trim();

  return ALIASES[normalized] || normalized;
}

// =====================================================================
// LIVE DATA MATCHING & MERGING
// =====================================================================

/**
 * Find the best matching live data for a base match.
 * Matches by normalized team names on the same calendar day (UTC).
 */
function findLiveMatch(
  baseMatch: Match,
  liveData: LiveMatchData[],
): LiveMatchData | null {
  const baseHome = normalizeTeamName(baseMatch.homeTeam.name);
  const baseAway = normalizeTeamName(baseMatch.awayTeam.name);
  const baseDate = baseMatch.utcDate.slice(0, 10); // "YYYY-MM-DD"

  return (
    liveData.find((live) => {
      const liveHome = normalizeTeamName(live.homeTeamName);
      const liveAway = normalizeTeamName(live.awayTeamName);
      const liveDate = live.utcDate.slice(0, 10);

      return (
        liveDate === baseDate && liveHome === baseHome && liveAway === baseAway
      );
    }) ?? null
  );
}

/**
 * Merge live data onto a base match. Only overlays status and score —
 * everything else (id, stage, group, venue, referees, teams) comes from base.
 */
function mergeMatchWithLiveData(base: Match, live: LiveMatchData): Match {
  return {
    ...base,
    status: live.status,
    score: {
      ...base.score,
      winner:
        live.homeGoals !== null && live.awayGoals !== null
          ? live.homeGoals > live.awayGoals
            ? "HOME_TEAM"
            : live.awayGoals > live.homeGoals
              ? "AWAY_TEAM"
              : "DRAW"
          : null,
      fullTime: {
        home: live.homeGoals,
        away: live.awayGoals,
      },
    },
  };
}

// =====================================================================
// COMPOSITE PROVIDER
// =====================================================================

/**
 * Fetch matches using the composite strategy:
 * 1. Always fetch base schedule from football-data.org
 * 2. If any match is in its live window, query live providers in priority order
 * 3. Merge live data onto base matches
 *
 * Returns the same Match[] shape — zero changes needed downstream.
 */
export async function getMatchesFromComposite(): Promise<Match[]> {
  // Step 1: Always get base schedule
  const baseMatches = await fetchBaseMatches();

  // Step 2: Check if any match is in its live window
  if (!hasMatchesInLiveWindow(baseMatches)) {
    return baseMatches;
  }

  // Step 3: Try live providers in priority order
  const liveData = await fetchFromLiveProviders();

  if (!liveData || liveData.length === 0) {
    // No live data available from any provider — return base as-is
    return baseMatches;
  }

  // Step 4: Merge live data onto base matches in the live window
  const candidateMatches = getMatchesInLiveWindow(baseMatches);
  const candidateIds = new Set(candidateMatches.map((m) => m.id));

  return baseMatches.map((match) => {
    if (!candidateIds.has(match.id)) return match;

    const liveMatch = findLiveMatch(match, liveData);
    if (!liveMatch) return match;

    const merged = mergeMatchWithLiveData(match, liveMatch);
    console.log(
      `[composite] Live overlay for ${match.homeTeam.name} vs ${match.awayTeam.name}: ` +
        `${match.status} → ${merged.status}, score: ${merged.score.fullTime.home}-${merged.score.fullTime.away}`,
    );
    return merged;
  });
}

/**
 * Try each available live provider in priority order.
 * Returns on first success. Handles rate-limits and errors with failover.
 */
async function fetchFromLiveProviders(): Promise<LiveMatchData[] | null> {
  const available = providerRegistry.getAvailable();

  if (available.length === 0) {
    console.warn("[composite] No live providers available");
    return null;
  }

  for (const provider of available) {
    try {
      console.log(`[composite] Trying live provider: ${provider.name}`);
      const data = await provider.fetchLiveMatches();
      providerRegistry.recordSuccess(provider.name);
      console.log(
        `[composite] ${provider.name} returned ${data.length} live match(es)`,
      );
      return data;
    } catch (error) {
      if (error instanceof ProviderRateLimitError) {
        providerRegistry.recordRateLimit(
          provider.name,
          error.retryAfterSeconds,
        );
        console.warn(
          `[composite] ${provider.name} rate-limited, trying next...`,
        );
      } else {
        const message = error instanceof Error ? error.message : String(error);
        providerRegistry.recordError(provider.name, message);
        console.error(`[composite] ${provider.name} error: ${message}`);
      }
    }
  }

  console.warn("[composite] All live providers failed");
  return null;
}
