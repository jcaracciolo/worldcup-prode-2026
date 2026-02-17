import { useMemo } from "react";
import { useMatches, useMatch } from "@/contexts/MatchContext";
import { useUser, useAllProfiles } from "@/contexts/UserContext";
import { useAllPredictions } from "@/contexts/PredictionsContext";
import { useMatchPointsForAllUsers } from "@/contexts/LeaderboardContext";
import { getMaxPossiblePoints } from "@/lib/scoring";
import { Profile } from "@/types/database";
import { FifaMatchId } from "@/types/football";

export interface UserMatchPrediction {
  userId: string;
  displayName: string;
  homeGoals: number | null;
  awayGoals: number | null;
  penaltyWinner: "HOME" | "AWAY" | null;
  pointsEarned: number;
  maxPoints: number;
}

/**
 * Joins profiles, predictions, and centrally-calculated match points
 * into a sorted list of UserMatchPrediction for a single match.
 */
export function useMatchPredictions(fifaId: FifaMatchId) {
  const { user: profile } = useUser();
  const profiles = useAllProfiles();
  const allPredictions = useAllPredictions();
  const { loading: matchesLoading } = useMatches();
  const match = useMatch(fifaId);
  const { matchPoints } = useMatchPointsForAllUsers(fifaId);

  const loading = profiles.loading || allPredictions.loading;

  const predictions = useMemo(() => {
    if (!match || !match.id) return [];
    if (!profiles.content || !allPredictions.content) return [];

    const profilesList = profiles.content;
    const allPredictionsMap = allPredictions.content;

    const maxPoints = getMaxPossiblePoints(match);

    // Build a map of userId -> points from centralized calculation
    const pointsByUser = new Map<string, number>();
    matchPoints.forEach((mp) => {
      pointsByUser.set(mp.userId, mp.pointsEarned);
    });

    const userPredictions: UserMatchPrediction[] = [];

    profilesList.forEach((profileData: Profile) => {
      const userData = allPredictionsMap.get(profileData.id);
      if (!userData) return;

      const pred = userData.predictions.find(
        (p) => (p.match_id as FifaMatchId) === match.id,
      );

      if (!pred) return;

      const pointsEarned = pointsByUser.get(profileData.id) || 0;

      userPredictions.push({
        userId: profileData.id,
        displayName: profileData.display_name,
        homeGoals: pred.home_goals,
        awayGoals: pred.away_goals,
        penaltyWinner: pred.penalty_winner,
        pointsEarned,
        maxPoints,
      });
    });

    // Sort: current user first, then by points (highest first), then by name
    userPredictions.sort((a, b) => {
      if (a.userId === profile?.id) return -1;
      if (b.userId === profile?.id) return 1;
      if (b.pointsEarned !== a.pointsEarned)
        return b.pointsEarned - a.pointsEarned;
      return a.displayName.localeCompare(b.displayName);
    });

    return userPredictions;
  }, [
    match,
    profiles.content,
    allPredictions.content,
    matchPoints,
    profile?.id,
  ]);

  return {
    match,
    matchesLoading,
    predictions,
    loading,
    currentUserId: profile?.id ?? null,
  };
}
