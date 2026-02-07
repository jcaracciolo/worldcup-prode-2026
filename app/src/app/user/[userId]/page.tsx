"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useMatches } from "@/contexts/MatchContext";
import { useTime } from "@/contexts/TimeContext";
import { useUser } from "@/contexts/UserContext";
import { useUserPredictions } from "@/contexts/PredictionsContext";
import { useUserPosition } from "@/contexts/LeaderboardContext";
import { calculateTotalPoints } from "@/lib/scoring";
import { getQualifyingThirdPlaceTeams } from "@/lib/third-place-ranking";
import {
  calculateAllGroupStandings,
  calculateAllActualStandings,
} from "@/lib/standings";
import { Prediction, Profile } from "@/types/database";
import PointsBreakdown from "@/components/PointsBreakdown";
import UserKnockoutSection from "@/components/UserKnockoutSection";
import UserGroupSection from "@/components/UserGroupSection";
import Link from "next/link";

export default function UserPredictionsPage() {
  const params = useParams();
  const userId = params.userId as string;
  const { matches, loading: matchesLoading } = useMatches();
  const { stageLockStatus } = useTime();
  const { user: currentProfile, getProfile } = useUser();

  // Check if viewing own profile
  const isOwnPredictions = currentProfile?.id === userId;

  // Use cached predictions from PredictionsContext
  const {
    predictions: cachedPredictions,
    overrides: cachedOverrides,
    loading: predictionsLoading,
  } = useUserPredictions(userId);

  // State for target profile - use own profile if available
  const [targetProfile, setTargetProfile] = useState<Profile | null>(() =>
    isOwnPredictions ? currentProfile : null,
  );
  const [loading, setLoading] = useState(
    () => !isOwnPredictions || !currentProfile,
  );
  const [notFound, setNotFound] = useState(false);

  // Fetch target user profile using context (getProfile is cached)
  useEffect(() => {
    // If viewing own profile, use it directly
    if (isOwnPredictions && currentProfile) {
      // Use queueMicrotask to avoid sync setState warning
      queueMicrotask(() => {
        setTargetProfile(currentProfile);
        setLoading(false);
      });
      return;
    }

    // Fetch other user's profile
    let cancelled = false;
    async function fetchProfile() {
      const profile = await getProfile(userId);

      if (cancelled) return;

      if (!profile) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setTargetProfile(profile);
      setLoading(false);
    }

    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [userId, getProfile, isOwnPredictions, currentProfile]);

  // Use predictions from context
  const predictions: Prediction[] = Array.from(cachedPredictions.values());
  const groupOverrides = cachedOverrides;
  // Only show loading on initial load when we have no data
  const isLoading = loading || (predictionsLoading && predictions.length === 0);

  // Stage lock status from time context (simulation-transparent)
  const { groupStageLocked, knockoutStageOpen, knockoutStageLocked } =
    stageLockStatus;

  // Also get isSimulated from time context
  const { isSimulated } = useTime();

  // Calculate predicted standings
  const predictionMap = useMemo(
    () => new Map(predictions.map((p) => [p.match_id, p])),
    [predictions],
  );

  const predictedStandings = useMemo(
    () => calculateAllGroupStandings(matches, predictionMap),
    [matches, predictionMap],
  );

  const thirdPlaceQualifying = useMemo(
    () => getQualifyingThirdPlaceTeams(predictedStandings),
    [predictedStandings],
  );

  // Calculate actual standings (for scoring)
  const actualStandings = useMemo(
    () => calculateAllActualStandings(matches),
    [matches],
  );

  const actualThirdPlaceQualifying = useMemo(
    () => getQualifyingThirdPlaceTeams(actualStandings),
    [actualStandings],
  );

  // Determine which teams actually advanced
  const advancingTeamIds = useMemo(() => {
    const ids = new Set<number>();
    actualStandings.forEach((standings, groupName) => {
      standings.forEach((standing, index) => {
        if (index < 2) {
          ids.add(standing.team.id);
        } else if (index === 2 && actualThirdPlaceQualifying.get(groupName)) {
          ids.add(standing.team.id);
        }
      });
    });
    return ids;
  }, [actualStandings, actualThirdPlaceQualifying]);

  // Calculate points
  const { totalPoints, livePoints, breakdown } = useMemo(() => {
    if (predictions.length === 0 || matches.length === 0) {
      return { totalPoints: 0, livePoints: 0, breakdown: [] };
    }
    return calculateTotalPoints(
      matches,
      predictions,
      groupOverrides,
      actualStandings,
      advancingTeamIds,
    );
  }, [matches, predictions, groupOverrides, actualStandings, advancingTeamIds]);

  // Get user's position from centralized leaderboard context
  const positionInfo = useUserPosition(userId);

  // Calculate point breakdown from breakdown items
  const pointBreakdown = useMemo(() => {
    let groupStagePoints = 0;
    let groupBonusPoints = 0;
    let knockoutPoints = 0;

    breakdown.forEach((item) => {
      if (item.type === "group_advance" || item.type === "group_position") {
        groupBonusPoints += item.points;
      } else if (
        item.type === "knockout_win" ||
        item.type === "knockout_lose" ||
        item.type === "knockout_tie"
      ) {
        knockoutPoints += item.points;
      } else if (item.matchId) {
        const match = matches.find((m) => m.id === item.matchId);
        if (match?.stage === "GROUP_STAGE") {
          groupStagePoints += item.points;
        } else {
          knockoutPoints += item.points;
        }
      }
    });

    return { groupStagePoints, groupBonusPoints, knockoutPoints };
  }, [breakdown, matches]);

  // Visibility rules - also show predictions when in simulation mode
  const showGroupPredictions =
    isOwnPredictions || groupStageLocked || isSimulated;
  const showKnockoutPredictions =
    isOwnPredictions || knockoutStageLocked || isSimulated;

  if (isLoading || (matchesLoading && matches.length === 0)) {
    return (
      <div className="min-h-screen">
        <main className="container mx-auto px-4 py-8">
          <div className="text-center text-white/50 py-12">Loading...</div>
        </main>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen">
        <main className="container mx-auto px-4 py-8">
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
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8">
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
            <div className="p-4 grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-xs text-emerald-400 uppercase tracking-wider mb-1">
                  Group Stage
                </div>
                <div className="text-2xl font-bold text-white">
                  {pointBreakdown.groupStagePoints}
                </div>
              </div>
              <div className="text-center p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="text-xs text-blue-400 uppercase tracking-wider mb-1">
                  Group Bonus
                </div>
                <div className="text-2xl font-bold text-white">
                  {pointBreakdown.groupBonusPoints}
                </div>
              </div>
              <div className="text-center p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="text-xs text-amber-400 uppercase tracking-wider mb-1">
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
                          className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-white/50 text-sm">
                              #{positionInfo.above.position}
                            </span>
                            <span className="text-white font-medium">
                              {positionInfo.above.displayName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-400 font-bold">
                              {positionInfo.above.totalPoints} pts
                            </span>
                            <span className="text-xs text-red-400">
                              ▲ {positionInfo.above.totalPoints - totalPoints}{" "}
                              ahead
                            </span>
                          </div>
                        </Link>
                      )}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 text-sm font-bold">
                            #{positionInfo.position}
                          </span>
                          <span className="text-white font-bold">
                            {targetProfile?.display_name}
                          </span>
                          {isOwnPredictions && (
                            <span className="text-xs text-emerald-400">
                              (You)
                            </span>
                          )}
                        </div>
                        <span className="text-emerald-400 font-bold">
                          {totalPoints} pts
                        </span>
                      </div>
                      {positionInfo.below && (
                        <Link
                          href={`/user/${positionInfo.below.userId}`}
                          className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-white/50 text-sm">
                              #{positionInfo.below.position}
                            </span>
                            <span className="text-white font-medium">
                              {positionInfo.below.displayName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-amber-400 font-bold">
                              {positionInfo.below.totalPoints} pts
                            </span>
                            <span className="text-xs text-emerald-400">
                              ▼ {totalPoints - positionInfo.below.totalPoints}{" "}
                              behind
                            </span>
                          </div>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Knockout Stage - shown first when knockout is locked */}
        {knockoutStageLocked && (
          <UserKnockoutSection
            matches={matches}
            predictions={predictions}
            groupStandings={predictedStandings}
            thirdPlaceQualifying={thirdPlaceQualifying}
            knockoutOpen={knockoutStageOpen}
            knockoutLocked={knockoutStageLocked}
            showPredictions={showKnockoutPredictions}
          />
        )}

        {/* Group Stage */}
        <UserGroupSection
          matches={matches}
          predictions={predictions}
          thirdPlaceQualifying={thirdPlaceQualifying}
          showPredictions={showGroupPredictions}
        />

        {/* Knockout Stage - shown after groups when not locked */}
        {!knockoutStageLocked && (
          <UserKnockoutSection
            matches={matches}
            predictions={predictions}
            groupStandings={predictedStandings}
            thirdPlaceQualifying={thirdPlaceQualifying}
            knockoutOpen={knockoutStageOpen}
            knockoutLocked={knockoutStageLocked}
            showPredictions={showKnockoutPredictions}
          />
        )}

        {/* Points Breakdown */}
        {(groupStageLocked || knockoutStageLocked) && (
          <section id="points-breakdown">
            <PointsBreakdown
              breakdown={breakdown}
              totalPoints={totalPoints}
              livePoints={livePoints}
            />
          </section>
        )}
      </main>

      <footer className="bg-black/20 text-white py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-sm">
          <p className="text-white/50">
            WorldCupProde - FIFA World Cup 2026 Predictions
          </p>
        </div>
      </footer>
    </div>
  );
}
