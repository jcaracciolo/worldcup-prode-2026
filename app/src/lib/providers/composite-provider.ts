import type { Match } from "@/types/football";
import type { LiveMatchData } from "./types";
import { ProviderRateLimitError } from "./types";
import { providerRegistry } from "./provider-registry";
import { fetchBaseMatches } from "./football-data-provider";

// =====================================================================
// LIVE WINDOW DETECTION
// =====================================================================

const MATCH_DURATION_MS = 2 * 60 * 60 * 1000; // 2h estimated match duration
const PRE_MATCH_BUFFER_MS = 3 * 60 * 1000; // Start checking 3 min before kickoff
const POST_MATCH_BUFFER_MS = 30 * 60 * 1000; // Keep checking 30 min after estimated end

/**
 * Check if a match is in its live window.
 * Does NOT check football-data.org status — we never trust it for live data.
 * Pure time-based: kickoff-3min → kickoff+2.5h
 */
function isInLiveWindow(match: Match): boolean {
  const now = Date.now();
  const kickoff = new Date(match.utcDate).getTime();
  const windowStart = kickoff - PRE_MATCH_BUFFER_MS;
  const windowEnd = kickoff + MATCH_DURATION_MS + POST_MATCH_BUFFER_MS;
  return now >= windowStart && now <= windowEnd;
}

/**
 * Check if a match is upcoming today (not yet in live window but will be).
 */
function isUpcomingToday(match: Match): boolean {
  const now = Date.now();
  const kickoff = new Date(match.utcDate).getTime();
  const windowStart = kickoff - PRE_MATCH_BUFFER_MS;
  // Today = within next 12 hours
  return kickoff > now && now < windowStart && kickoff - now < 12 * 60 * 60 * 1000;
}

// =====================================================================
// DYNAMIC POLLING INTERVAL
// =====================================================================

/** Timestamp of last live provider call */
let lastLiveCallTimestamp = 0;
/** Last calculated polling interval in ms */
let lastCalculatedIntervalMs = 60_000;

const MIN_POLL_INTERVAL_MS = 60_000; // Never poll faster than 60s
const MAX_POLL_INTERVAL_MS = 10 * 60_000; // Never slower than 10 min

/**
 * Calculate the optimal polling interval based on remaining budget and live time.
 *
 * Formula: interval = remainingLiveMinutes × 60s / remainingBudget
 * More providers → more budget → shorter interval (auto-scales).
 */
export function calculatePollingInterval(matches: Match[]): number {
  const remaining = providerRegistry.getTotalRemainingBudget();
  if (remaining <= 0) return MAX_POLL_INTERVAL_MS;

  const liveMatches = matches.filter(isInLiveWindow);
  const upcomingMatches = matches.filter(isUpcomingToday);

  if (liveMatches.length === 0 && upcomingMatches.length === 0) {
    return MAX_POLL_INTERVAL_MS;
  }

  // Estimate remaining live minutes today
  const now = Date.now();
  let totalLiveMinutesRemaining = 0;

  for (const match of liveMatches) {
    const kickoff = new Date(match.utcDate).getTime();
    const matchEnd = kickoff + MATCH_DURATION_MS + POST_MATCH_BUFFER_MS;
    const remainingMs = Math.max(0, matchEnd - now);
    totalLiveMinutesRemaining += remainingMs / 60_000;
  }

  for (const match of upcomingMatches) {
    // Each upcoming match contributes its full duration
    totalLiveMinutesRemaining += (MATCH_DURATION_MS + POST_MATCH_BUFFER_MS) / 60_000;
  }

  if (totalLiveMinutesRemaining <= 0) return MAX_POLL_INTERVAL_MS;

  // interval = (remaining live seconds) / remaining budget
  const intervalSec = (totalLiveMinutesRemaining * 60) / remaining;
  const intervalMs = Math.round(intervalSec * 1000);

  const clamped = Math.max(MIN_POLL_INTERVAL_MS, Math.min(MAX_POLL_INTERVAL_MS, intervalMs));

  console.log(
    `[composite] Poll interval: ${Math.round(clamped / 1000)}s ` +
      `(budget: ${remaining}, live+upcoming: ${liveMatches.length}+${upcomingMatches.length}, ` +
      `live min remaining: ${Math.round(totalLiveMinutesRemaining)})`,
  );

  lastCalculatedIntervalMs = clamped;
  return clamped;
}

/**
 * Check if enough time has elapsed since the last live provider call.
 */
function shouldPollLiveNow(matches: Match[]): boolean {
  const intervalMs = calculatePollingInterval(matches);
  const elapsed = Date.now() - lastLiveCallTimestamp;
  return elapsed >= intervalMs;
}

/** Get the last calculated polling interval (for API response) */
export function getPollingIntervalMs(): number {
  return lastCalculatedIntervalMs;
}

// =====================================================================
// TEAM NAME MATCHING
// =====================================================================

/**
 * Normalize team name for cross-provider matching.
 */
function normalizeTeamName(name: string): string {
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
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();

  return ALIASES[normalized] || normalized;
}

// =====================================================================
// LIVE DATA MATCHING & MERGING
// =====================================================================

/**
 * Find the best matching live data for a base match.
 */
function findLiveMatch(
  baseMatch: Match,
  liveData: LiveMatchData[],
): LiveMatchData | null {
  const baseHome = normalizeTeamName(baseMatch.homeTeam.name);
  const baseAway = normalizeTeamName(baseMatch.awayTeam.name);
  const baseDate = baseMatch.utcDate.slice(0, 10);

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
 * Merge live data onto a base match. Only overlays status and score.
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
 * 1. Fetch base schedule from football-data.org (never for live scores)
 * 2. If any matches are in their live window, query live providers
 * 3. Only poll live providers if the dynamic interval has elapsed
 * 4. Merge live data onto base schedule
 *
 * Returns Match[] + the recommended polling interval for the client.
 */
export async function getMatchesFromComposite(): Promise<Match[]> {
  // Step 1: Get base schedule (teams, venues, dates — never trust scores)
  const baseMatches = await fetchBaseMatches();

  // Step 2: Find matches in live windows
  const liveWindowMatches = baseMatches.filter(isInLiveWindow);

  if (liveWindowMatches.length === 0) {
    // No matches in live window — schedule-only, no live calls
    calculatePollingInterval(baseMatches); // Update interval for API response
    return baseMatches;
  }

  // Step 3: Check if we should poll live providers now
  if (!shouldPollLiveNow(baseMatches)) {
    console.log(
      `[composite] Throttled — ${Math.round((Date.now() - lastLiveCallTimestamp) / 1000)}s since last call, ` +
        `interval is ${Math.round(lastCalculatedIntervalMs / 1000)}s`,
    );
    // Return base matches — the caller (football-api.ts) will merge with
    // individually cached live scores from previous successful calls
    return baseMatches;
  }

  console.log(
    `[composite] ${liveWindowMatches.length} match(es) in live window: ${liveWindowMatches.map(
      (m) => `${m.homeTeam.name} vs ${m.awayTeam.name}`,
    ).join(", ")}`,
  );

  // Step 4: Fetch from live providers (round-robin)
  const liveData = await fetchFromLiveProviders();
  lastLiveCallTimestamp = Date.now();

  if (!liveData || liveData.length === 0) {
    return baseMatches;
  }

  // Step 5: Merge live data onto ALL matches in live windows
  const liveWindowIds = new Set(liveWindowMatches.map((m) => m.id));
  return baseMatches.map((match) => {
    if (!liveWindowIds.has(match.id)) return match;

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
 * Try live providers using round-robin to distribute load evenly.
 * Falls back to next provider on rate-limit or error.
 */
async function fetchFromLiveProviders(): Promise<LiveMatchData[] | null> {
  const available = providerRegistry.getAvailable();

  if (available.length === 0) {
    console.warn("[composite] No live providers available (all exhausted or rate-limited)");
    return null;
  }

  // Try each available provider, starting from round-robin position
  for (let i = 0; i < available.length; i++) {
    const provider = providerRegistry.getNextAvailable();
    if (!provider) break;

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
