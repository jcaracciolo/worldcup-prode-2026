import { NextResponse } from "next/server";
import { getMatches } from "@/lib/football-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { matches, pollIntervalMs } = await getMatches();

    return NextResponse.json({
      matches,
      pollIntervalMs,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching matches:", error);
    return NextResponse.json(
      { error: "Failed to fetch matches", matches: [], pollIntervalMs: 60000 },
      { status: 500 },
    );
  }
}
