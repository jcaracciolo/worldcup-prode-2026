"use client";

import Link from "next/link";
import { useLeaderboard } from "@/contexts/LeaderboardContext";
import { useUser } from "@/contexts/UserContext";
import UserName from "@/components/UserName";

export default function Leaderboard() {
  const { scores } = useLeaderboard();
  const { user } = useUser();
  const currentUserId = user?.id;
  return (
    <div className="glass-card overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center">
          <span className="text-xl sm:text-2xl">🏆</span>
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white">
            Leaderboard
          </h2>
          <p className="text-emerald-100 text-xs sm:text-sm">Top predictions</p>
        </div>
      </div>

      <div className="divide-y divide-white/5">
        {scores.length === 0 ? (
          <div className="p-6 sm:p-8 text-center">
            <div className="text-3xl sm:text-4xl mb-3">📊</div>
            <p className="text-white/60 text-sm sm:text-base">
              No predictions yet
            </p>
            <p className="text-white/40 text-xs sm:text-sm mt-1">
              Be the first to make predictions!
            </p>
          </div>
        ) : (
          scores.map((score) => {
            const isCurrentUser = score.userId === currentUserId;
            const position = score.position;

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
                className={`flex items-center px-3 sm:px-6 py-3 sm:py-4 hover:bg-white/5 transition-all ${
                  isCurrentUser ? "bg-emerald-500/10" : ""
                }`}
              >
                <div
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold text-base sm:text-lg ${
                    badge
                      ? `${badge.bg} border ${badge.border}`
                      : "bg-white/5 text-white/60"
                  }`}
                >
                  {badge ? badge.icon : position}
                </div>
                <div className="flex-1 ml-3 sm:ml-4 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-semibold text-sm sm:text-base truncate ${isCurrentUser ? "text-emerald-400" : "text-white"}`}
                    >
                      <UserName name={score.displayName} country={score.country} />
                    </span>
                    {isCurrentUser && (
                      <span className="px-1.5 sm:px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] sm:text-xs rounded-full font-medium shrink-0">
                        you
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] sm:text-xs text-white/40 mt-0.5 truncate">
                    Group: {score.groupStagePoints} • Bonus:{" "}
                    {score.groupBonusPoints}
                    {score.knockoutPoints > 0 &&
                      ` • Knockout: ${score.knockoutPoints}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-baseline justify-end gap-1">
                    {score.livePoints > 0 && (
                      <span className="text-xs sm:text-sm font-bold text-red-400 live-pulse">
                        +{score.livePoints}
                      </span>
                    )}
                    <div
                      className={`text-xl sm:text-2xl font-bold ${score.livePoints > 0 ? "text-red-400 live-pulse" : "text-white"}`}
                    >
                      {score.totalPoints}
                    </div>
                  </div>
                  <div className="text-[10px] sm:text-xs text-white/40">
                    points
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
