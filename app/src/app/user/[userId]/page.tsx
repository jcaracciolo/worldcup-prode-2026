"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
import { Prediction, GroupStandingsOverride, Profile } from "@/types/database";
import PointsBreakdown from "@/components/PointsBreakdown";
import UserKnockoutSection from "@/components/UserKnockoutSection";
import UserGroupSection from "@/components/UserGroupSection";
import Link from "next/link";

export default function UserPredictionsPage() {
  const params = useParams();
  const userId = params.userId as string;
  const supabase = createClient();
  const { matches, loading: matchesLoading } = useMatches();
  const { getCurrentTime, simulationEnabled } = useSimulation();
  const { user: currentProfile } = useUser();

  // Check if viewing own profile
  const isOwnPredictions = currentProfile?.id === userId;

  // Use cached predictions if viewing own profile
  const {
    predictions: cachedPredictions,
    overrides: cachedOverrides,
    loading: cachedLoading,
  } = useUserPredictions(isOwnPredictions ? userId : null);

  // State for data (used when viewing others' predictions)
  const [targetProfile, setTargetProfile] = useState<Profile | null>(null);
  const [fetchedPredictions, setFetchedPredictions] = useState<Prediction[]>(
    [],
  );
  const [fetchedOverrides, setFetchedOverrides] = useState<
    GroupStandingsOverride[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Fetch user data (always fetch profile, only fetch predictions for others)
  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // Get target user profile
      const { data: target } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (!target) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setTargetProfile(target);

      // Skip fetching predictions if viewing own profile (use cache)
      if (isOwnPredictions) {
        setLoading(false);
        return;
      }

      // Get predictions for other users
      const { data: preds } = await supabase
        .from("predictions")
        .select("*")
        .eq("user_id", userId);
      setFetchedPredictions(preds || []);

      // Get group standings overrides
      const { data: overrides } = await supabase
        .from("group_standings_overrides")
        .select("*")
        .eq("user_id", userId);
      setFetchedOverrides(overrides || []);

      setLoading(false);
    }

    fetchData();
  }, [userId, supabase, isOwnPredictions]);

  // Use cached data for own profile, fetched data for others
  const predictions: Prediction[] = isOwnPredictions
    ? Array.from(cachedPredictions.values())
    : fetchedPredictions;
  const groupOverrides = isOwnPredictions ? cachedOverrides : fetchedOverrides;
  const isLoading = isOwnPredictions
    ? loading || cachedLoading
    : loading;

  // Stage lock status (uses simulation time if enabled)
  const lockStatus = useMemo(() => {
    const time = getCurrentTime();
    return getStageLockStatus(time);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
