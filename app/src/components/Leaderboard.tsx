"use client";

import { UserScore } from "@/types/football";
import Link from "next/link";

interface LeaderboardProps {
  scores: UserScore[];
  currentUserId?: string;
}

export default function Leaderboard({
  scores,
  currentUserId,
}: LeaderboardProps) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
          <span className="text-2xl">🏆</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Leaderboard</h2>
          <p className="text-emerald-100 text-sm">Top predictions</p>
        </div>
      </div>

      <div className="divide-y divide-white/5">
        {scores.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-white/60">No predictions yet</p>
            <p className="text-white/40 text-sm mt-1">
              Be the first to make predictions!
            </p>
          </div>
        ) : (
          scores.map((score, index) => {
            const isCurrentUser = score.userId === currentUserId;
            const position = index + 1;

            const getBadge = () => {
              if (position === 1)
                return {
                  icon: "🥇",
                  bg: "bg-amber-500/20",
                  border: "border-amber-500/30",
                };
              if (position === 2)
                return {
                  icon: "🥈",
                  bg: "bg-slate-400/20",
                  border: "border-slate-400/30",
                };
              if (position === 3)
                return {
                  icon: "🥉",
                  bg: "bg-orange-600/20",
                  border: "border-orange-600/30",
                };
              return null;
            };

            const badge = getBadge();

            return (
              <Link
                key={score.userId}
                href={`/user/${score.userId}`}
                className={`flex items-center px-6 py-4 hover:bg-white/5 transition-all ${
                  isCurrentUser ? "bg-emerald-500/10" : ""
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                    badge
                      ? `${badge.bg} border ${badge.border}`
                      : "bg-white/5 text-white/60"
                  }`}
                >
                  {badge ? badge.icon : position}
                </div>
                <div className="flex-1 ml-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-semibold ${isCurrentUser ? "text-emerald-400" : "text-white"}`}
                    >
                      {score.displayName}
                    </span>
                    {isCurrentUser && (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full font-medium">
                        you
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-white/40 mt-0.5">
                    Group: {score.groupStagePoints} • Bonus:{" "}
                    {score.groupBonusPoints} • Knockout: {score.knockoutPoints}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">
                    {score.totalPoints}
                  </div>
                  <div className="text-xs text-white/40">points</div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
