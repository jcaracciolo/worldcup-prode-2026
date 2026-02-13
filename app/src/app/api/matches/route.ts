import { NextResponse } from "next/server";
import { createServerDatabaseService } from "@/lib/services/database-service";
import { getMatches } from "@/lib/football-api";
import { Match } from "@/types/football";

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
    const { data: individualCaches } = await db.matchesCache.getIndividualCachedMatches();

    // Merge individual cached results into matches
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

    return NextResponse.json({ matches, fetchedAt: now.toISOString() });
  } catch (error) {
    console.error("Error fetching matches:", error);
    return NextResponse.json(
      { error: "Failed to fetch matches", matches: [] },
      { status: 500 },
    );
  }
}
