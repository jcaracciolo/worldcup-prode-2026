import { NextResponse } from "next/server";
import { gzipSync } from "node:zlib";
import { getMatches } from "@/lib/football-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const start = Date.now();
  try {
    const { matches, pollIntervalMs } = await getMatches();
    const serverMs = Date.now() - start;

    const body = JSON.stringify({
      matches,
      pollIntervalMs,
      fetchedAt: new Date().toISOString(),
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      // Ground-truth server-side time for getMatches (visible in devtools).
      "Server-Timing": `getMatches;dur=${serverMs}`,
    };

    // Compress the (large, ~95KB) JSON payload when the client supports it.
    // Next.js standalone on Azure was returning this uncompressed; gzip cuts
    // the transfer by ~85%, which dominates load time on slow/distant links.
    const acceptsGzip = (request.headers.get("accept-encoding") || "").includes(
      "gzip",
    );
    if (acceptsGzip) {
      const gz = gzipSync(body);
      headers["Content-Encoding"] = "gzip";
      headers["Vary"] = "Accept-Encoding";
      return new NextResponse(gz, { status: 200, headers });
    }

    return new NextResponse(body, { status: 200, headers });
  } catch (error) {
    console.error("Error fetching matches:", error);
    return NextResponse.json(
      { error: "Failed to fetch matches", matches: [], pollIntervalMs: 60000 },
      { status: 500 },
    );
  }
}
