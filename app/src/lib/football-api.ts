import {
  Match,
  FifaMatchId,
  StandingsResponse,
  TeamsResponse,
} from "@/types/football";
import {
  initializeProviders,
  getMatchesFromComposite,
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

/**
 * Fetch all matches — the single entry point for match data.
 *
 * Handles everything internally:
 * 1. DB cache (1-min TTL)
 * 2. Composite provider (base schedule + live overlay)
 * 3. Persist live scores to DB (survives deploys)
 * 4. Merge individually cached match results
 * 5. API ID → FIFA ID conversion
 * 6. TBD team resolution
 *
 * Returns Match[] with FIFA IDs, ready for the client.
 */
export async function getMatches(): Promise<Match[]> {
  initializeProviders();
  const db = await createServerDatabaseService();

  // Step 1: Check DB cache
  const { data: cacheData } = await db.matchesCache.getCachedMatches();
  const now = new Date();
  const cacheAge = cacheData?.updated_at
    ? now.getTime() - new Date(cacheData.updated_at).getTime()
    : Infinity;

  let matches: Match[];

  if (cacheData && cacheAge < CACHE_DURATION_MS) {
    const cachedData = cacheData.data as unknown as { matches: Match[] };
    matches = cachedData.matches || [];
  } else {
    // Step 2: Fetch from composite provider (base + live overlay)
    matches = await getMatchesFromComposite();

    // Step 3: Persist live scores individually (survives restarts/deploys)
    const liveMatches = matches.filter(
      (m) =>
        (m.status === "IN_PLAY" || m.status === "PAUSED" || m.status === "FINISHED") &&
        m.score.fullTime.home !== null &&
        m.score.fullTime.away !== null,
    );
    for (const liveMatch of liveMatches) {
      await db.matchesCache.updateIndividualMatchCache(liveMatch.id, liveMatch);
    }

    // Update bulk cache
    await db.matchesCache.updateMatchesCache(matches);
  }

  // Step 4: Merge individually cached match results (live scores + admin overrides)
  const { data: individualCaches } = await db.matchesCache.getIndividualCachedMatches();
  if (individualCaches && individualCaches.length > 0) {
    const cachedMatchMap = new Map(
      individualCaches.map((c) => [c.match_id, c.data]),
    );
    matches = matches.map((match) => {
      const cached = cachedMatchMap.get(match.id);
      return cached ? (cached as unknown as Match) : match;
    });
  }

  // Step 5: Convert API IDs → FIFA IDs
  let fifaMatches = convertToFifaIds(matches);

  // Step 6: Resolve TBD teams
  fifaMatches = resolveAllTbdTeams(fifaMatches);

  return fifaMatches;
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
  const matches = await getMatches();
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

export function getGroupMatches(matches: Match[]): Map<string, Match[]> {
  const groupMatches = new Map<string, Match[]>();

  matches
    .filter((match) => match.stage === "GROUP_STAGE" && match.group)
    .forEach((match) => {
      const group = match.group!;
      if (!groupMatches.has(group)) {
        groupMatches.set(group, []);
      }
      groupMatches.get(group)!.push(match);
    });

  return groupMatches;
}

export function getKnockoutMatches(matches: Match[]): Map<string, Match[]> {
  const knockoutStages = [
    "LAST_32",
    "LAST_16",
    "QUARTER_FINALS",
    "SEMI_FINALS",
    "THIRD_PLACE",
    "FINAL",
  ];

  const knockoutMatches = new Map<string, Match[]>();

  knockoutStages.forEach((stage) => {
    knockoutMatches.set(stage, []);
  });

  matches
    .filter((match) => knockoutStages.includes(match.stage))
    .forEach((match) => {
      knockoutMatches.get(match.stage)!.push(match);
    });

  return knockoutMatches;
}

export function isGroupStageMatch(match: Match): boolean {
  return match.stage === "GROUP_STAGE";
}

export function isKnockoutMatch(match: Match): boolean {
  return !isGroupStageMatch(match);
}

export function getMatchResult(match: Match): "home" | "away" | "draw" | null {
  if (
    match.status !== "FINISHED" &&
    match.status !== "IN_PLAY" &&
    match.status !== "PAUSED"
  )
    return null;

  const homeGoals = match.score.fullTime.home;
  const awayGoals = match.score.fullTime.away;

  if (homeGoals === null || awayGoals === null) return null;

  if (homeGoals > awayGoals) return "home";
  if (awayGoals > homeGoals) return "away";
  return "draw";
}

export function getPredictionResult(
  homeGoals: number,
  awayGoals: number,
): "home" | "away" | "draw" {
  if (homeGoals > awayGoals) return "home";
  if (awayGoals > homeGoals) return "away";
  return "draw";
}
