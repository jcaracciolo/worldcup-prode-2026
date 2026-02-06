import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMatches } from "@/lib/football-api";
import { Match } from "@/types/football";

export const dynamic = "force-dynamic";

const CACHE_DURATION_MS = 60 * 1000; // 1 minute

export async function GET() {
  try {
    const supabase = await createClient();

    // Check cache first for the full matches list
    const { data: cacheData } = await supabase
      .from("matches_cache")
      .select("*")
      .eq("match_id", 0) // Use match_id 0 for the full matches list cache
      .single();

    const now = new Date();
    const cacheAge = cacheData?.updated_at
      ? now.getTime() - new Date(cacheData.updated_at).getTime()
      : Infinity;

    let matches: Match[];

    // Return cached data if fresh
    if (cacheData && cacheAge < CACHE_DURATION_MS) {
      matches = cacheData.data.matches || [];
    } else {
      // Fetch fresh data from API
      matches = await getMatches();

      // Update cache (upsert)
      await supabase.from("matches_cache").upsert({
        match_id: 0,
        data: { matches, fetchedAt: now.toISOString() },
        updated_at: now.toISOString(),
      });
    }

    // Get any individually cached match results (from generated results)
    const { data: individualCaches } = await supabase
      .from("matches_cache")
      .select("*")
      .neq("match_id", 0);

    // Merge individual cached results into matches
    if (individualCaches && individualCaches.length > 0) {
      const cachedMatchMap = new Map(
        individualCaches.map((c) => [c.match_id, c.data]),
      );

      matches = matches.map((match) => {
        const cached = cachedMatchMap.get(match.id);
        if (cached) {
          return cached as Match;
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
