import type { Match } from "@/types/football";
import type { LiveMatchData } from "./types";
import { ProviderRateLimitError } from "./types";
import { providerRegistry } from "./provider-registry";
import { fetchBaseMatches } from "./football-data-provider";

// =====================================================================
// STALENESS DETECTION
// =====================================================================

const KICKOFF_BUFFER_MS = 15 * 60 * 1000; // 15 min before kickoff
const POST_MATCH_WINDOW_MS = 3 * 60 * 60 * 1000; // 3h after kickoff

/**
 * Determine if a match's data from football-data.org looks stale.
 *
 * Stale means the base provider's data doesn't match reality:
 * - TIMED/SCHEDULED but kickoff was 15+ min ago → should be live
 * - FINISHED but scores are null → status updated, goals withheld
 * - IN_PLAY/PAUSED → technically not stale, but free tier never shows these
 */
function isMatchDataStale(match: Match): boolean {
  const now = Date.now();
  const kickoff = new Date(match.utcDate).getTime();
  const inTimeWindow =
    now >= kickoff - KICKOFF_BUFFER_MS &&
    now <= kickoff + POST_MATCH_WINDOW_MS;

  if (!inTimeWindow) return false;

  // Should be live but still shows as not started
  if (
    (match.status === "TIMED" || match.status === "SCHEDULED") &&
    now >= kickoff + KICKOFF_BUFFER_MS
  ) {
    return true;
  }

  // Finished but no scores (free tier withholds goals)
  if (
    match.status === "FINISHED" &&
    match.score.fullTime.home === null
  ) {
    return true;
  }

  return false;
}

/**
 * Check if any match in the list has stale data.
 * Only when this is true do we call live providers (saves API quota).
 */
function hasStaleMatches(matches: Match[]): boolean {
  return matches.some(isMatchDataStale);
}

/**
 * Get matches that need a live data overlay.
 */
function getStaleMatches(matches: Match[]): Match[] {
  return matches.filter(isMatchDataStale);
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
 * 2. Check if any match data looks stale (should be live but isn't, or finished without scores)
 * 3. Only if stale: query live providers in priority order, merge results
 *
 * When football-data.org has complete data, live providers are never called.
 * Returns the same Match[] shape — zero changes needed downstream.
 */
export async function getMatchesFromComposite(): Promise<Match[]> {
  // Step 1: Always get base schedule
  const baseMatches = await fetchBaseMatches();

  // Step 2: Check if football-data.org data is stale
  if (!hasStaleMatches(baseMatches)) {
    return baseMatches;
  }

  // Identify stale matches (candidates for overlay)
  const staleMatchList = getStaleMatches(baseMatches);
  const staleIds = new Set(staleMatchList.map((m) => m.id));

  console.log(
    `[composite] ${staleMatchList.length} stale match(es): ${staleMatchList.map(
      (m) => `${m.homeTeam.name} vs ${m.awayTeam.name} (${m.status}, score: ${m.score.fullTime.home ?? "null"})`,
    ).join(", ")}`,
  );

  // Step 3: Try live providers in priority order
  const liveData = await fetchFromLiveProviders();

  if (!liveData || liveData.length === 0) {
    return baseMatches;
  }

  // Step 4: Merge live data onto stale base matches
  return baseMatches.map((match) => {
    if (!staleIds.has(match.id)) return match;

    const liveMatch = findLiveMatch(match, liveData);
    if (!liveMatch) return match;

    const merged = mergeMatchWithLiveData(match, liveMatch);
    console.log(
      `[composite] Live overlay: ${match.homeTeam.name} vs ${match.awayTeam.name}: ` +
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
