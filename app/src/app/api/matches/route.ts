import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMatches } from "@/lib/football-api";

export const dynamic = "force-dynamic";

const CACHE_DURATION_MS = 60 * 1000; // 1 minute

export async function GET() {
  try {
    const supabase = await createClient();

    // Check cache first
    const { data: cacheData } = await supabase
      .from("matches_cache")
      .select("*")
      .eq("match_id", 0) // Use match_id 0 for the full matches list cache
      .single();

    const now = new Date();
    const cacheAge = cacheData?.updated_at
      ? now.getTime() - new Date(cacheData.updated_at).getTime()
      : Infinity;

    // Return cached data if fresh
    if (cacheData && cacheAge < CACHE_DURATION_MS) {
      return NextResponse.json(cacheData.data);
    }

    // Fetch fresh data from API
    const matches = await getMatches();
    const responseData = { matches, fetchedAt: now.toISOString() };

    // Update cache (upsert)
    await supabase.from("matches_cache").upsert({
      match_id: 0,
      data: responseData,
      updated_at: now.toISOString(),
    });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error fetching matches:", error);
    return NextResponse.json(
      { error: "Failed to fetch matches", matches: [] },
      { status: 500 },
    );
  }
}
