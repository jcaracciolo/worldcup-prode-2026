"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useMatches } from "@/contexts/MatchContext";
import { useSimulation } from "@/contexts/SimulationContext";
import { useUser } from "@/contexts/UserContext";
import { useUserPredictions } from "@/contexts/PredictionsContext";
import { getStageLockStatus } from "@/lib/time";
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
  const { getCurrentTime } = useSimulation();
  const { user: currentProfile, getProfile } = useUser();

  // Check if viewing own profile
  const isOwnPredictions = currentProfile?.id === userId;

  // Use cached predictions from PredictionsContext
  const {
    predictions: cachedPredictions,
    overrides: cachedOverrides,
    loading: predictionsLoading,
  } = useUserPredictions(userId);

  // State for target profile
  const [targetProfile, setTargetProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Fetch target user profile using context
  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);

      const profile = await getProfile(userId);

      if (!profile) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setTargetProfile(profile);
      setLoading(false);
    }

    fetchProfile();
  }, [userId, getProfile]);

  // Use predictions from context
  const predictions: Prediction[] = Array.from(cachedPredictions.values());
  const groupOverrides = cachedOverrides;
  const isLoading = loading || predictionsLoading;

  // Stage lock status (uses simulation time if enabled)
  const lockStatus = useMemo(() => {
    const time = getCurrentTime();
    return getStageLockStatus(time);
  }, [getCurrentTime]);

  const { groupStageLocked, knockoutStageOpen, knockoutStageLocked } =
    lockStatus;

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
  const { totalPoints, breakdown } = useMemo(() => {
    if (predictions.length === 0 || matches.length === 0) {
      return { totalPoints: 0, breakdown: [] };
    }
    return calculateTotalPoints(
      matches,
      predictions,
      groupOverrides,
      actualStandings,
      advancingTeamIds,
    );
  }, [matches, predictions, groupOverrides, actualStandings, advancingTeamIds]);

  // Visibility rules
  const showGroupPredictions = isOwnPredictions || groupStageLocked;
  const showKnockoutPredictions = isOwnPredictions || knockoutStageLocked;

  if (isLoading || matchesLoading) {
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">
            {targetProfile?.display_name}&apos;s Predictions
          </h1>
          {isOwnPredictions && (
            <p className="text-white/50 text-sm mt-1">This is you!</p>
          )}
        </div>

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
          <section>
            <PointsBreakdown breakdown={breakdown} totalPoints={totalPoints} />
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
