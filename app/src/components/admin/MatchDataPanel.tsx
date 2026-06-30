"use client";

import { useState } from "react";
import { useDatabaseService } from "@/contexts/DatabaseContext";
import { useMatches } from "@/contexts/MatchContext";

type Status = "idle" | "working" | "done" | "error";

/**
 * Admin tool to force-refresh match results from the API.
 *
 * Finished scores are "frozen" in the cache (so an unreliable upstream can't
 * flap an already-final scoreline). If a match froze on a WRONG result, this
 * clears the cached results (bulk + per-match frozen finals) and re-fetches,
 * causing every result to be re-pulled fresh from the API and re-frozen.
 */
export default function MatchDataPanel() {
  const db = useDatabaseService();
  const { refresh } = useMatches();

  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  const handleForceRefresh = async () => {
    if (
      !window.confirm(
        "Force-refresh all match results from the API?\n\n" +
          "This clears the cached (frozen) results and re-fetches them. " +
          "Use this if a match is stuck showing a wrong score.",
      )
    ) {
      return;
    }

    setStatus("working");
    setMessage("Clearing cached results…");
    try {
      const result = await db.matchesCache.clearMatchCaches();
      if (!result.success) {
        throw new Error(result.error || "Failed to clear match caches");
      }

      setMessage("Re-fetching results from the API…");
      await refresh();

      setStatus("done");
      setMessage("Results refreshed from the API.");
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "Failed to refresh match results",
      );
    }
  };

  const working = status === "working";

  return (
    <section className="glass-card p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🔄 Match Data
          </h2>
          <p className="text-sm text-white/50 mt-1">
            Force-refresh match results from the API. Use this if a match is
            frozen on a wrong score.
          </p>
        </div>
        <button
          onClick={handleForceRefresh}
          disabled={working}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {working ? "Refreshing…" : "Force Refresh Results"}
        </button>
      </div>

      {status !== "idle" && message && (
        <div
          className={`rounded-lg p-3 text-sm border ${
            status === "error"
              ? "bg-red-500/10 border-red-500/30 text-red-300"
              : status === "done"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-white/5 border-white/10 text-white/70"
          }`}
        >
          {message}
        </div>
      )}
    </section>
  );
}
