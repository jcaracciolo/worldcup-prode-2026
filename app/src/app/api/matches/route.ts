import { NextResponse } from "next/server";
import { getMatches } from "@/lib/football-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const matches = await getMatches();

    return NextResponse.json({
      matches,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching matches:", error);
    return NextResponse.json(
      { error: "Failed to fetch matches", matches: [] },
      { status: 500 },
    );
  }
}
