"use client";

import { useState, useEffect } from "react";
import TodaysMatches from "@/components/TodaysMatches";
import Leaderboard from "@/components/Leaderboard";
import { useUser } from "@/contexts/UserContext";
import { useTime } from "@/contexts/TimeContext";
import Link from "next/link";

export default function HomePage() {
  const { user: profile } = useUser();
  const { stageLockStatus } = useTime();
  const daysLeft = stageLockStatus?.daysUntilKnockoutLocks;

  // Avoid hydration mismatch by only showing banner after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showBanner = mounted && daysLeft !== null && daysLeft !== undefined;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-4 sm:py-8">
        {/* Knockout warning banner */}
        {showBanner && (
          <Link href="/predictions">
            <div className="mb-4 sm:mb-6 bg-red-600/90 rounded-lg px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-red-600 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                <span className="text-white text-sm font-medium">
                  {daysLeft === 0
                    ? "Knockout predictions lock today!"
                    : daysLeft === 1
                      ? "Only 1 day left for knockout predictions!"
                      : `${daysLeft} days left for knockout predictions`}
                </span>
              </div>
              <span className="text-white/80 text-sm">Set predictions →</span>
            </div>
          </Link>
        )}

        <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Matches Section */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <span className="text-lg sm:text-xl">📅</span>
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Today&apos;s Matches
                </h2>
                <p className="text-white/50 text-xs sm:text-sm">
                  World Cup 2026
                </p>
              </div>
            </div>

            <TodaysMatches />
          </div>

          {/* Leaderboard Section */}
          <div className="lg:col-span-1">
            <Leaderboard />
          </div>
        </div>
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
