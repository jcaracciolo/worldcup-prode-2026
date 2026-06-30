import { useMemo } from "react";
import { useMatches, useMatch } from "@/contexts/MatchContext";
import { useUser, useAllProfiles } from "@/contexts/UserContext";
import { useAllPredictions } from "@/contexts/PredictionsContext";
import { useMatchPointsForAllUsers } from "@/contexts/LeaderboardContext";
import { useTime } from "@/contexts/TimeContext";
import { getMaxPossiblePoints } from "@/lib/scoring";
import { Profile } from "@/types/database";
import { FifaMatchId } from "@/types/football";

export interface UserMatchPrediction {
  userId: string;
  displayName: string;
  country: string | null;
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
  const { stageLockStatus, isKnockoutMatchLocked } = useTime();

  const loading = profiles.loading || allPredictions.loading;

  const predictions = useMemo(() => {
    if (!match || !match.id) return [];
    if (!profiles.content || !allPredictions.content) return [];

    // Determine if other users' predictions should be visible
    // Group predictions: visible after group stage locks
    // Knockout predictions: visible per-match once that match locks (kicks off
    // before the deadline, or the deadline passes)
    const isGroupMatch = match.stage === "GROUP_STAGE";
    const othersVisible = isGroupMatch
      ? stageLockStatus.groupStageLocked
      : isKnockoutMatchLocked(match.utcDate);
    const isAdmin = profile?.is_admin === true;

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
      // Before stage locks, only show current user's own prediction (admins see all)
      if (!othersVisible && !isAdmin && profileData.id !== profile?.id) return;

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
        country: profileData.country ?? null,
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
    profile?.is_admin,
    stageLockStatus.groupStageLocked,
    isKnockoutMatchLocked,
  ]);

  return {
    match,
    matchesLoading,
    predictions,
    loading,
    currentUserId: profile?.id ?? null,
  };
}
