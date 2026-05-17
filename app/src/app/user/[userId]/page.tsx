"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMatches } from "@/contexts/MatchContext";
import { useTime } from "@/contexts/TimeContext";
import { useUser, useProfile } from "@/contexts/UserContext";
import {
  useUserPredictions,
  usePredictedMatches,
} from "@/contexts/PredictionsContext";
import { useUserPosition } from "@/contexts/LeaderboardContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import { LocalPrediction } from "@/types/database";
import { FifaMatchId } from "@/types/football";
import PointsBreakdown from "@/components/PointsBreakdown";
import LockedCard from "@/components/LockedCard";
import { KnockoutStageSection } from "@/components/predictions";
import UserGroupSection from "@/components/UserGroupSection";
import Link from "next/link";

export default function UserPredictionsPage() {
  const params = useParams();
  const userId = params.userId as string;
  const { matches, loading: matchesLoading } = useMatches();
  const { stageLockStatus } = useTime();
  const { user: currentProfile } = useUser();

  // Check if viewing own profile
  const isOwnPredictions = currentProfile?.id === userId;

  // Use profile from hook - if viewing own profile, prefer currentProfile
  const targetProfileState = useProfile(isOwnPredictions ? null : userId);
  const targetProfile = isOwnPredictions
    ? currentProfile
    : targetProfileState.content;
  const profileLoading = isOwnPredictions ? false : targetProfileState.loading;
  const notFound =
    !isOwnPredictions &&
    !targetProfileState.loading &&
    !targetProfileState.content;

  // Use cached predictions from PredictionsContext
  const { predictions: predictionsMap, loading: predictionsLoading } =
    useUserPredictions(userId);

  // Use predictions from context
  const predictions: LocalPrediction[] = Array.from(predictionsMap.values());
  // Only show loading on initial load when we have no data
  const isLoading =
    profileLoading || (predictionsLoading && predictions.length === 0);

  // Stage lock status from time context (simulation-transparent)
  const { groupStageLocked, knockoutStageOpen, knockoutStageLocked } =
    stageLockStatus;

  // Tab state - default to group if group stage is still playing, knockout if group stage is done
  const [activeTab, setActiveTab] = useState<"group" | "knockout">(() =>
    groupStageLocked ? "knockout" : "group",
  );

  // Get matches with user's predicted knockout teams baked in.
  const { matches: predictedMatches, knockoutStages } =
    usePredictedMatches(userId);

  // Predictions keyed by FIFA match number (for knockout)
  const fifaPredictionMap = useMemo(
    () =>
      new Map<FifaMatchId, LocalPrediction>(
        predictions.map((p) => [p.match_id as FifaMatchId, p]),
      ),
    [predictions],
  );

  // Get user's score and position from centralized leaderboard context
  // (avoids re-computing scores that LeaderboardContext already calculated)
  const positionInfo = useUserPosition(userId);
  const userScore = positionInfo.userScore;
  const totalPoints = userScore?.totalPoints ?? 0;
  const livePoints = userScore?.livePoints ?? 0;
  const pointBreakdown = useMemo(
    () => ({
      groupStagePoints: userScore?.groupStagePoints ?? 0,
      groupBonusPoints: userScore?.groupBonusPoints ?? 0,
      knockoutPoints: userScore?.knockoutPoints ?? 0,
    }),
    [userScore],
  );

  // Visibility rules - show predictions when stage is locked
  const showGroupPredictions = isOwnPredictions || groupStageLocked;
  const showKnockoutPredictions = isOwnPredictions || knockoutStageLocked;

  if (isLoading || (matchesLoading && matches.length === 0)) {
    return <LoadingSpinner />;
  }

  if (notFound) {
    return (
      <div className="flex-1 flex flex-col">
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-white mb-4">
              User Not Found
            </h1>
            <p className="text-white/50 mb-6">
              The user you&apos;re looking for doesn&apos;t exist.
            </p>
            <Link href="/" className="text-blue-400 hover:text-blue-300">
              Go back home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Header with name */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">
            {targetProfile?.display_name}&apos;s Predictions
          </h1>
          {isOwnPredictions && (
            <p className="text-white/50 text-sm mt-1">This is you!</p>
          )}
        </div>

        {/* Score Summary Card - only shown when predictions are locked */}
        {(groupStageLocked || knockoutStageLocked) && (
          <div
            className="mb-8 glass-card overflow-hidden cursor-pointer hover:ring-2 hover:ring-emerald-500/50 transition-all"
            onClick={() => {
              document
                .getElementById("points-breakdown")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            {/* Main Score Display */}
            <div className="bg-gradient-to-r from-emerald-600/30 to-green-600/30 p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                {/* Position Badge */}
                <div className="flex items-center gap-4">
                  {positionInfo.position !== null && (
                    <div className="relative">
                      <div
                        className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black ${
                          positionInfo.position === 1
                            ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-yellow-900"
                            : positionInfo.position === 2
                              ? "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-700"
                              : positionInfo.position === 3
                                ? "bg-gradient-to-br from-orange-400 to-orange-600 text-orange-900"
                                : "bg-white/10 text-white"
                        }`}
                      >
                        #{positionInfo.position}
                      </div>
                      <div className="absolute -bottom-1 -right-1 px-2 py-0.5 bg-slate-800 rounded-full text-xs text-white/70 border border-white/10">
                        of {positionInfo.total}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-white/50 text-sm uppercase tracking-wider">
                      Total Points
                    </div>
                    <div className="flex items-baseline gap-2">
                      <div className="text-5xl font-black text-white">
                        {totalPoints}
                      </div>
                      {livePoints > 0 && (
                        <div className="text-xl font-bold text-red-400 animate-pulse">
                          +{livePoints} 🔴
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Trophy Icon */}
                <div className="text-6xl opacity-30">
                  {positionInfo?.position === 1
                    ? "🏆"
                    : positionInfo?.position === 2
                      ? "🥈"
                      : positionInfo?.position === 3
                        ? "🥉"
                        : "⚽"}
                </div>
              </div>
              {/* Click hint */}
              <div className="mt-3 text-center text-xs text-white/40">
                Click for detailed breakdown ↓
              </div>
            </div>

            {/* Point Breakdown */}
            <div className="p-4 grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-[10px] text-emerald-400 uppercase tracking-wider mb-1">
                  Group
                </div>
                <div className="text-2xl font-bold text-white">
                  {pointBreakdown.groupStagePoints}
                </div>
              </div>
              <div className="text-center p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="text-[10px] text-blue-400 uppercase tracking-wider mb-1">
                  Bonus
                </div>
                <div className="text-2xl font-bold text-white">
                  {pointBreakdown.groupBonusPoints}
                </div>
              </div>
              <div className="text-center p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="text-[10px] text-amber-400 uppercase tracking-wider mb-1">
                  Knockout
                </div>
                <div className="text-2xl font-bold text-white">
                  {pointBreakdown.knockoutPoints}
                </div>
              </div>
            </div>

            {/* Neighbors on Leaderboard */}
            {positionInfo.position !== null &&
              (positionInfo.above || positionInfo.below) && (
                <div className="px-4 pb-4">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-xs text-white/50 uppercase tracking-wider mb-2 text-center">
                      Leaderboard Neighbors
                    </div>
                    <div className="space-y-2">
                      {positionInfo.above && (
                        <Link
                          href={`/user/${positionInfo.above.userId}`}
                          scroll={true}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          <span className="text-white/50 text-xs shrink-0">
                            #{positionInfo.above.position}
                          </span>
                          <span className="text-white font-medium text-sm truncate min-w-0 flex-1">
                            {positionInfo.above.displayName}
                          </span>
                          <span className="text-[10px] text-red-400 shrink-0 whitespace-nowrap">
                            ▲{positionInfo.above.totalPoints - totalPoints}
                          </span>
                          <span className="text-emerald-400 font-bold text-sm shrink-0">
                            {positionInfo.above.totalPoints}
                          </span>
                        </Link>
                      )}
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                        <span className="text-emerald-400 text-xs font-bold shrink-0">
                          #{positionInfo.position}
                        </span>
                        <span className="text-white font-bold text-sm truncate min-w-0 flex-1">
                          {targetProfile?.display_name}
                        </span>
                        {isOwnPredictions && (
                          <span className="text-[10px] text-emerald-400 shrink-0">
                            You
                          </span>
                        )}
                        <span className="text-emerald-400 font-bold text-sm shrink-0">
                          {totalPoints}
                        </span>
                      </div>
                      {positionInfo.below && (
                        <Link
                          href={`/user/${positionInfo.below.userId}`}
                          scroll={true}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          <span className="text-white/50 text-xs shrink-0">
                            #{positionInfo.below.position}
                          </span>
                          <span className="text-white font-medium text-sm truncate min-w-0 flex-1">
                            {positionInfo.below.displayName}
                          </span>
                          <span className="text-[10px] text-emerald-400 shrink-0 whitespace-nowrap">
                            ▼{totalPoints - positionInfo.below.totalPoints}
                          </span>
                          <span className="text-amber-400 font-bold text-sm shrink-0">
                            {positionInfo.below.totalPoints}
                          </span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Stage Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("group")}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
              activeTab === "group"
                ? "bg-emerald-600 text-white"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
          >
            Group Stage
          </button>
          <button
            onClick={() => setActiveTab("knockout")}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
              activeTab === "knockout"
                ? "bg-amber-600 text-white"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
          >
            Knockout Stage
          </button>
        </div>

        {/* Group Stage */}
        {activeTab === "group" && (
          <UserGroupSection
            showPredictions={showGroupPredictions}
            userId={userId}
          />
        )}

        {/* Knockout Stage */}
        {activeTab === "knockout" && (
          <>
            {!knockoutStageOpen ? (
              <section className="mb-8">
                <LockedCard message="Knockout predictions will be available after group stage locks" />
              </section>
            ) : !showKnockoutPredictions ? (
              <section className="mb-8">
                <LockedCard message="Predictions will be visible after knockout stage locks" />
              </section>
            ) : (
              <KnockoutStageSection
                knockoutStages={knockoutStages}
                predictions={fifaPredictionMap}
                userId={userId}
                mode="predictions"
              />
            )}
          </>
        )}

        {/* Points Breakdown */}
        {(groupStageLocked || knockoutStageLocked) && (
          <section id="points-breakdown">
            <PointsBreakdown userId={userId} />
          </section>
        )}
      </main>

      <footer className="bg-black/20 text-white py-4 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm">
          <p className="text-white/50">
            WorldCupProde - FIFA World Cup 2026 Predictions
          </p>
        </div>
      </footer>
    </div>
  );
}
