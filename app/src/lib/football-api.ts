import {
  Match,
  FifaMatchId,
  StandingsResponse,
  TeamsResponse,
} from "@/types/football";
import {
  initializeProviders,
  getMatchesFromComposite,
  getPollingIntervalMs,
  fetchBaseMatch,
} from "@/lib/providers";
import { buildApiToFifaMapping } from "@/lib/api-client";
import { createServerDatabaseService } from "@/lib/services/database-service";
import { resolveAllTbdTeams } from "@/lib/tbd-teams";

const API_BASE_URL = "https://api.football-data.org/v4";
const COMPETITION_CODE = "WC";
const CACHE_DURATION_MS = 60 * 1000; // 1 minute

async function fetchFromAPI<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "X-Auth-Token": process.env.FOOTBALL_DATA_API_TOKEN!,
    },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

// =====================================================================
// API ID → FIFA ID CONVERSION
// =====================================================================

function convertToFifaIds(matches: Match[]): Match[] {
  const apiToFifa = buildApiToFifaMapping(matches);
  return matches
    .map((match) => {
      const fifaNumber = apiToFifa.get(match.id);
      if (fifaNumber === undefined) return null;
      return { ...match, id: fifaNumber as unknown as FifaMatchId };
    })
    .filter((m): m is Match => m !== null);
}

// =====================================================================
// PUBLIC API
// =====================================================================

/** Result from getMatches — includes polling hint for the client */
export interface MatchesResult {
  matches: Match[];
  pollIntervalMs: number;
}

const isFinishedWithScore = (m: Match | undefined): m is Match =>
  !!m &&
  m.status === "FINISHED" &&
  m.score.fullTime.home !== null &&
  m.score.fullTime.away !== null;

type DbService = Awaited<ReturnType<typeof createServerDatabaseService>>;

/**
 * In-flight refresh lock (module-level → shared across requests on this
 * instance). Ensures only ONE refresh runs at a time and lets a stale read
 * kick off a background refresh without blocking the response (option C).
 */
let refreshInFlight: Promise<Match[]> | null = null;

/**
 * Refresh the match cache from upstream and persist the MERGED result.
 *
 * This is the only place that talks to the (slow, unreliable) upstream. It:
 *   1. Loads the per-match individual cache (frozen finished results) and
 *      fetches the composite provider IN PARALLEL (option A).
 *   2. Freezes any newly-finished match into the individual cache.
 *   3. Merges frozen finals + live scores over the composite base.
 *   4. Stores the ALREADY-MERGED list in the bulk cache so the hot read path
 *      needs a single query and no merge work (option B).
 */
async function refreshMatchCache(db: DbService): Promise<Match[]> {
  const [{ data: individualCaches }, composite] = await Promise.all([
    db.matchesCache.getIndividualCachedMatches(),
    getMatchesFromComposite(),
  ]);

  const cachedMatchMap = new Map<number, Match>(
    (individualCaches || []).map((c) => [c.match_id, c.data as unknown as Match]),
  );

  // FREEZE finished results: once a match has been recorded FINISHED with a
  // score, never overwrite that entry. This stops an unreliable upstream
  // (football-data.org) from flapping the final scoreline of an already
  // finished match. Live/paused matches still update each refresh.
  const toPersist = composite.filter(
    (m) =>
      (m.status === "IN_PLAY" ||
        m.status === "PAUSED" ||
        m.status === "FINISHED") &&
      m.score.fullTime.home !== null &&
      m.score.fullTime.away !== null &&
      !isFinishedWithScore(cachedMatchMap.get(m.id)),
  );
  await Promise.all(
    toPersist.map(async (m) => {
      await db.matchesCache.updateIndividualMatchCache(m.id, m);
      cachedMatchMap.set(m.id, m);
    }),
  );

  // Merge individually cached results (frozen finals + live) over the base.
  // Precedence:
  //   1. A frozen FINISHED cached result wins over the (untrusted) base score.
  //   2. Otherwise, if the base says FINISHED, use the base.
  //   3. Otherwise prefer the cached entry if it is more advanced (live score).
  let merged = composite;
  if (cachedMatchMap.size > 0) {
    merged = composite.map((match) => {
      const cached = cachedMatchMap.get(match.id);
      if (!cached) return match;
      if (isFinishedWithScore(cached)) return cached;
      if (match.status === "FINISHED") return match;
      return cached;
    });
  }

  // Persist the MERGED list so reads are a single query with no merge.
  await db.matchesCache.updateMatchesCache(merged);
  return merged;
}

/** Start (or join) the single in-flight refresh. */
function triggerRefresh(db: DbService): Promise<Match[]> {
  if (!refreshInFlight) {
    refreshInFlight = refreshMatchCache(db).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * Fetch all matches — the single entry point for match data.
 *
 * Hot path (cache present): a SINGLE read of the already-merged bulk cache,
 * then API→FIFA conversion + TBD resolution (CPU only). If the cache is older
 * than the TTL, a refresh is kicked off in the BACKGROUND and the current
 * (slightly stale) data is returned immediately — no user request ever blocks
 * on the slow upstream. Only a completely-empty cache forces a synchronous
 * refresh.
 *
 * Returns matches with FIFA IDs + recommended polling interval for client.
 */
export async function getMatches(): Promise<MatchesResult> {
  initializeProviders();
  const db = await createServerDatabaseService();

  const { data: cacheData } = await db.matchesCache.getCachedMatches();
  const cacheAge = cacheData?.updated_at
    ? Date.now() - new Date(cacheData.updated_at).getTime()
    : Infinity;

  let matches: Match[];
  if (cacheData) {
    matches = (cacheData.data as unknown as { matches: Match[] }).matches || [];
    // Stale → refresh in the background; serve the current data right now.
    if (cacheAge >= CACHE_DURATION_MS) {
      void triggerRefresh(db).catch((err) =>
        console.error("[football-api] background refresh failed:", err),
      );
    }
  } else {
    // No cache at all (first run / cleared) — must refresh synchronously.
    matches = await triggerRefresh(db);
  }

  let fifaMatches = convertToFifaIds(matches);
  fifaMatches = resolveAllTbdTeams(fifaMatches);

  return {
    matches: fifaMatches,
    pollIntervalMs: getPollingIntervalMs(),
  };
}

export async function getMatch(matchId: number): Promise<Match | null> {
  return fetchBaseMatch(matchId);
}

export async function getStandings(): Promise<StandingsResponse> {
  return fetchFromAPI<StandingsResponse>(
    `/competitions/${COMPETITION_CODE}/standings`,
  );
}

export async function getTeams(): Promise<TeamsResponse> {
  return fetchFromAPI<TeamsResponse>(`/competitions/${COMPETITION_CODE}/teams`);
}

export async function getTodaysMatches(): Promise<Match[]> {
  const { matches } = await getMatches();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get today's matches
  let todaysMatches = matches.filter((match) => {
    const matchDate = new Date(match.utcDate);
    return matchDate >= today && matchDate < tomorrow;
  });

  // If no matches today, get nearest upcoming
  if (todaysMatches.length === 0) {
    const upcomingMatches = matches
      .filter((match) => new Date(match.utcDate) > today)
      .sort(
        (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
      );

    if (upcomingMatches.length > 0) {
      const nextMatchDate = new Date(upcomingMatches[0].utcDate);
      nextMatchDate.setHours(0, 0, 0, 0);
      const nextDayEnd = new Date(nextMatchDate);
      nextDayEnd.setDate(nextDayEnd.getDate() + 1);

      todaysMatches = upcomingMatches.filter((match) => {
        const matchDate = new Date(match.utcDate);
        return matchDate >= nextMatchDate && matchDate < nextDayEnd;
      });
    }
  }

  return todaysMatches;
}

// Re-export pure match utilities (client-safe) so existing server-side
// imports from "@/lib/football-api" continue to work.
export {
  getGroupMatches,
  getKnockoutMatches,
  isGroupStageMatch,
  isKnockoutMatch,
  getMatchResult,
  getPredictionResult,
} from "./match-utils";
