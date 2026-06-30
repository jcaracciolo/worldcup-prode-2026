"use client";

import { useState, useEffect } from "react";
import { MatchDayNavProvider } from "@/hooks/useMatchDayNav";
import TodaysMatches from "@/components/TodaysMatches";
import TodaysPredictions from "@/components/TodaysPredictions";
import TeamsPassed from "@/components/TeamsPassed";
import Leaderboard from "@/components/Leaderboard";
import { useUser } from "@/contexts/UserContext";
import { useTime } from "@/contexts/TimeContext";
import Link from "next/link";

export default function HomePage() {
  const { user: profile } = useUser();
  const { stageLockStatus, getCurrentTime } = useTime();
  const daysLeft = stageLockStatus?.daysUntilKnockoutLocks;

  // Avoid hydration mismatch by only showing banner after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showBanner = mounted && daysLeft !== null && daysLeft !== undefined;

  // From June 28 (local) onward it's the final stretch before knockouts lock
  // (deadline is Jun 29 17:00 UTC). The banner is already hidden once locked
  // (daysLeft === null), so this just switches the copy for the last day.
  const isKnockoutLastDay =
    mounted && getCurrentTime().toLocaleDateString("en-CA") >= "2026-06-28";

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-4 sm:py-8">
        {/* Knockout warning banner */}
        {showBanner && (
          <Link href="/predictions">
            <div className="mb-4 sm:mb-6 bg-red-800/70 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-red-800/90 transition-colors border border-red-500/30 text-center">
              <div className="flex items-center justify-center gap-3">
                <span className="text-lg">⚠️</span>
                <span className="text-white text-sm font-medium">
                  {isKnockoutLastDay
                    ? "LAST DAY TO FILL IN YOUR KNOCKOUTS!"
                    : "COMPLETE THE RSA-CAN match today!"}
                </span>
              </div>
              <div className="text-red-200/60 text-[11px] mt-0.5">
                {isKnockoutLastDay
                  ? "Predictions lock soon — fill them in now! →"
                  : "Or you won't get points for that match! →"}
              </div>
            </div>
          </Link>
        )}

        <MatchDayNavProvider>
          <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Matches (mobile: 1st, desktop: top-left) */}
            <div className="order-1 lg:col-span-2 lg:col-start-1 lg:row-start-1">
              <TodaysMatches />
            </div>

            {/* Leaderboard (mobile: 2nd, desktop: right column, full height) */}
            <div className="order-2 lg:col-start-3 lg:row-start-1 lg:row-span-2">
              <Leaderboard />
            </div>

            {/* Predictions + Teams passed (mobile: last, desktop: below matches) */}
            <div className="order-3 lg:col-span-2 lg:col-start-1 lg:row-start-2 space-y-6 sm:space-y-8">
              <TodaysPredictions />
              <TeamsPassed />
            </div>
          </div>
        </MatchDayNavProvider>
      </main>

      <footer className="border-t border-white/10 mt-auto">
        <div className="container mx-auto px-4 py-4 sm:py-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-xl sm:text-2xl">⚽</span>
            <span className="text-base sm:text-lg font-bold text-white">
              WorldCupProde
            </span>
          </div>
          <p className="text-white/40 text-xs sm:text-sm">
            FIFA World Cup 2026 Predictions
          </p>
          <p className="text-white/30 text-[10px] sm:text-xs mt-1">
            Not a real betting application
          </p>
        </div>
      </footer>
    </div>
  );
}
