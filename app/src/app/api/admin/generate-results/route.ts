import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { stage } = await request.json();

    // Get all matches
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/matches`,
    );
    const { matches } = await res.json();

    if (!matches || matches.length === 0) {
      return NextResponse.json({ error: "No matches found" }, { status: 400 });
    }

    // Filter by stage
    const targetMatches =
      stage === "group"
        ? matches.filter((m: { stage: string }) => m.stage === "GROUP_STAGE")
        : matches.filter((m: { stage: string }) => m.stage !== "GROUP_STAGE");

    // Generate random results and update cache
    const serviceClient = await createServiceClient();

    for (const match of targetMatches) {
      const homeGoals = Math.floor(Math.random() * 5);
      const awayGoals = Math.floor(Math.random() * 5);

      // Create a mock match result
      const updatedMatch = {
        ...match,
        status: "FINISHED",
        score: {
          winner:
            homeGoals > awayGoals
              ? "HOME_TEAM"
              : awayGoals > homeGoals
                ? "AWAY_TEAM"
                : "DRAW",
          duration: "REGULAR",
          fullTime: { home: homeGoals, away: awayGoals },
          halfTime: {
            home: Math.floor(homeGoals / 2),
            away: Math.floor(awayGoals / 2),
          },
        },
      };

      // Store in cache
      await serviceClient.from("matches_cache").upsert({
        match_id: match.id,
        data: updatedMatch,
        updated_at: new Date().toISOString(),
      });
    }

    // Clear the main matches cache to force refresh
    await serviceClient.from("matches_cache").delete().eq("match_id", 0);

    return NextResponse.json({
      success: true,
      matchesUpdated: targetMatches.length,
    });
  } catch (error) {
    console.error("Error generating results:", error);
    return NextResponse.json(
      { error: "Failed to generate results" },
      { status: 500 },
    );
  }
}
