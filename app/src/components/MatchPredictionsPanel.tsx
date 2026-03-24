"use client";

import Link from "next/link";
import { UserMatchPrediction } from "@/hooks/useMatchPredictions";
import { MatchWithLiveInfo } from "@/contexts/MatchContext";
import { getPredictionHighlight } from "@/lib/match-highlight";

interface MatchPredictionsPanelProps {
  match: MatchWithLiveInfo;
  predictions: UserMatchPrediction[];
  loading: boolean;
  currentUserId: string | null;
}

/**
 * Predictions panel shown beside the match score on the match detail page.
 * Lists every user's prediction with highlights and points.
 */
export function MatchPredictionsPanel({
  match,
  predictions,
  loading,
  currentUserId,
}: MatchPredictionsPanelProps) {
  const isGroupStage = match.stage === "GROUP_STAGE";
  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
  const isFinished = match.status === "FINISHED";

  const computeHighlight = (pred: UserMatchPrediction) =>
    getPredictionHighlight(
      pred.homeGoals,
      pred.awayGoals,
      isGroupStage,
      pred.penaltyWinner,
    );

  return (
    <div className="lg:w-56 xl:w-64 bg-slate-900/70 rounded-xl p-3 backdrop-blur-sm border border-white/10">
      <div className="text-xs font-semibold text-white/80 mb-2 flex items-center gap-1.5">
        <span>👥</span>
        <span>Predictions</span>
        {predictions.length > 0 && (
          <span className="text-white/50">({predictions.length})</span>
        )}
      </div>

      {loading ? (
        <div className="text-xs text-white/50 text-center py-2">
          <span className="text-lg animate-bounce-spin inline-block">⚽</span>
        </div>
      ) : predictions.length === 0 ? (
        <div className="text-xs text-white/50 text-center py-2">
          No predictions yet
        </div>
      ) : (
        <div
          className="space-y-1 max-h-[300px] overflow-y-auto relative"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.3) transparent",
          }}
        >
          {predictions.map((pred) => {
            const highlight = computeHighlight(pred);
            const isCurrentUser = currentUserId === pred.userId;

            return (
              <Link
                key={pred.userId}
                href={`/user/${pred.userId}`}
                className={`flex items-center justify-between gap-1.5 px-2 py-2.5 rounded-lg text-xs transition-all hover:bg-white/10 min-h-[44px] ${isCurrentUser ? "bg-sky-500/20 border border-sky-400/40" : ""}`}
              >
                <span
                  className={`truncate flex-1 ${isCurrentUser ? "text-sky-200 font-medium" : "text-white/90"}`}
                >
                  {pred.displayName}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className={`px-1 rounded ${highlight.home ? "bg-amber-400 text-slate-900 font-bold" : "text-white/70"}`}
                  >
                    {pred.homeGoals ?? "-"}
                  </span>
                  <span className="text-white/40">-</span>
                  <span
                    className={`px-1 rounded ${highlight.away ? "bg-amber-400 text-slate-900 font-bold" : "text-white/70"}`}
                  >
                    {pred.awayGoals ?? "-"}
                  </span>
                  {(isFinished || isLive) && (
                    <span
                      className={`ml-1 font-bold ${pred.pointsEarned > 0 ? "text-sky-300" : "text-white/30"} ${isLive ? "live-pulse" : ""}`}
                    >
                      +{pred.pointsEarned}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!currentUserId && predictions.length > 0 && (
        <Link
          href="/login"
          className="block text-center text-xs text-sky-300 hover:text-sky-200 mt-2"
        >
          Log in to highlight yours
        </Link>
      )}
    </div>
  );
}
