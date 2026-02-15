import { NextResponse } from "next/server";
import { createServerDatabaseService } from "@/lib/services/database-service";
import { getMatches } from "@/lib/football-api";
import { Match } from "@/types/football";
import { buildApiToFifaMapping } from "@/lib/api-client";
import { resolveAllTbdTeams } from "@/lib/tbd-teams";

export const dynamic = "force-dynamic";

const CACHE_DURATION_MS = 60 * 1000; // 1 minute

export async function GET() {
  try {
    const db = await createServerDatabaseService();

    // Check cache first for the full matches list
    const { data: cacheData } = await db.matchesCache.getCachedMatches();

    const now = new Date();
    const cacheAge = cacheData?.updated_at
      ? now.getTime() - new Date(cacheData.updated_at).getTime()
      : Infinity;

    let matches: Match[];

    // Return cached data if fresh
    if (cacheData && cacheAge < CACHE_DURATION_MS) {
      const cachedData = cacheData.data as unknown as { matches: Match[] };
      matches = cachedData.matches || [];
    } else {
      // Fetch fresh data from API
      matches = await getMatches();

      // Update cache using database service
      await db.matchesCache.updateMatchesCache(matches);
    }

    // Get any individually cached match results (from generated results)
    const { data: individualCaches } =
      await db.matchesCache.getIndividualCachedMatches();

    // Merge individual cached results into matches (by API ID, before conversion)
    if (individualCaches && individualCaches.length > 0) {
      const cachedMatchMap = new Map(
        individualCaches.map((c) => [c.match_id, c.data]),
      );

      matches = matches.map((match) => {
        const cached = cachedMatchMap.get(match.id);
        if (cached) {
          return cached as unknown as Match;
        }
        return match;
      });
    }

    // Convert API IDs to FIFA match numbers (1-104) before returning.
    // This is the ONLY place where API IDs are translated to FIFA IDs.
    // All consumers receive FIFA IDs as match.id.
    const apiToFifa = buildApiToFifaMapping(matches);
    let fifaMatches = matches
      .map((match) => {
        const fifaNumber = apiToFifa.get(match.id);
        if (fifaNumber === undefined) return null;
        return { ...match, id: fifaNumber as number };
      })
      .filter((m): m is Match => m !== null);

    // Replace TBD teams with placeholder teams (EU playoff winners, IC playoff winners)
    // This ensures all matches have valid team objects with IDs
    fifaMatches = resolveAllTbdTeams(fifaMatches);

    return NextResponse.json({
      matches: fifaMatches,
      fetchedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("Error fetching matches:", error);
    return NextResponse.json(
      { error: "Failed to fetch matches", matches: [] },
      { status: 500 },
    );
  }
}
