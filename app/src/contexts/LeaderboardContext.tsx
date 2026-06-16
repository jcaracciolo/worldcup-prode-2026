"use client";

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { useTime } from "@/contexts/TimeContext";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useMatches } from "@/contexts/MatchContext";
import { useAllPredictions } from "@/contexts/PredictionsContext";
import { useAllProfiles } from "@/contexts/UserContext";
import { UserScore, FifaMatchId } from "@/types/football";
import { calculateTotalPoints } from "@/lib/scoring";

// =====================================================================
// TYPES
// =====================================================================

interface LeaderboardContextValue {
  scores: UserScore[];
  loading: boolean;
  getPosition: (userId: string) => number | null;
  getUserScore: (userId: string) => UserScore | null;
}

const LeaderboardContext = createContext<LeaderboardContextValue | null>(null);

// =====================================================================
// PROVIDER
// =====================================================================

export function LeaderboardProvider({ children }: { children: ReactNode }) {
  const { stageLockStatus } = useTime();
  const { matches, liveBracket, loading: matchesLoading } = useMatches();
  const { competitionLoading, currentCompetitionId } = useDatabase();
  const profiles = useAllProfiles();
  const allPredictions = useAllPredictions();

  // A score is only meaningful when computed from a COMPLETE input set —
  // profiles, predictions AND match results. Match results arrive on their
  // own schedule (separate fetch). Computing before they land would
  // undercount finished games and briefly show a wrong total (e.g. 17 then
  // jump to 21). We therefore require matches to have loaded before producing
  // any scores. This is safe against the "blank on reload" bug because all
  // three inputs persist once loaded — they only ever move forward, never
  // regress — so this gate only suppresses output during the very first load
  // when there is no prior data to preserve anyway.
  const inputsReady =
    !matchesLoading &&
    matches.length > 0 &&
    !!profiles.content &&
    !!allPredictions.content;

  // Loading is informational only — exposed for consumers that want a
  // spinner. It is true until the first complete score can be produced, so a
  // consumer can show a loader instead of a misleading "no data" empty state.
  const loading =
    !inputsReady ||
    competitionLoading ||
    !currentCompetitionId ||
    profiles.loading ||
    allPredictions.loading;

  // Calculate scores using useMemo - recalculates when dependencies change
  const scores = useMemo(() => {
    if (!inputsReady) return [];

    const profileList = profiles.content || [];
    const predictionsMap = allPredictions.content || new Map();

    if (!profileList.length) return [];

    // If nothing locked, everyone has 0 points
    if (
      !stageLockStatus.groupStageLocked &&
      !stageLockStatus.knockoutStageLocked
    ) {
      return profileList.map((p) => ({
        userId: p.id,
        displayName: p.display_name,
        country: p.country ?? null,
        totalPoints: 0,
        livePoints: 0,
        groupStagePoints: 0,
        groupBonusPoints: 0,
        knockoutPoints: 0,
        position: 0,
      }));
    }

    // Use actual standings from the live bracket for advancing team determination
    // (advancingTeamIds is now computed inside calculateTotalPoints)

    // Calculate scores for each user
    const calculatedScores: UserScore[] = profileList.map((profile) => {
      const userData = predictionsMap.get(profile.id);
      const predictions = userData?.predictions || [];
      const groupOverrides = userData?.overrides || [];
      const thirdPlaceOverrides = userData?.thirdPlaceOverrides || [];

      const matchesWithFifa = matches.map((m) => ({
        ...m,
        fifaNumber: m.fifaNumber as FifaMatchId | null,
      }));

      const { totalPoints, livePoints, breakdown } = calculateTotalPoints(
        matchesWithFifa,
        predictions,
        groupOverrides,
        liveBracket,
        thirdPlaceOverrides,
      );

      let groupStagePoints = 0;
      let groupBonusPoints = 0;
      let knockoutPoints = 0;

      breakdown.forEach((item) => {
        if (item.type === "group_advance" || item.type === "group_position") {
          groupBonusPoints += item.points;
        } else {
          const match = matches.find((m) => m.id === item.matchId);
          if (match?.stage === "GROUP_STAGE") {
            groupStagePoints += item.points;
          } else {
            knockoutPoints += item.points;
          }
        }
      });

      return {
        userId: profile.id,
        displayName: profile.display_name,
        country: profile.country ?? null,
        totalPoints,
        livePoints,
        groupStagePoints,
        groupBonusPoints,
        knockoutPoints,
        position: 0,
        breakdown, // Store full breakdown for per-match scoring access
      };
    });

    // Sort and assign positions
    calculatedScores.sort((a, b) => b.totalPoints - a.totalPoints);
    let currentPosition = 1;
    let previousScore: number | null = null;
    calculatedScores.forEach((score, index) => {
      if (previousScore !== null && score.totalPoints === previousScore) {
        score.position = currentPosition;
      } else {
        currentPosition = index + 1;
        score.position = currentPosition;
      }
      previousScore = score.totalPoints;
    });

    return calculatedScores;
  }, [
    inputsReady,
    matches,
    stageLockStatus.groupStageLocked,
    stageLockStatus.knockoutStageLocked,
    profiles.content,
    allPredictions.content,
    liveBracket,
  ]);

  const getPosition = useCallback(
    (userId: string) =>
      scores.find((s) => s.userId === userId)?.position ?? null,
    [scores],
  );

  const getUserScore = useCallback(
    (userId: string) => scores.find((s) => s.userId === userId) ?? null,
    [scores],
  );

  const value = useMemo(
    () => ({ scores, loading, getPosition, getUserScore }),
    [scores, loading, getPosition, getUserScore],
  );

  return (
    <LeaderboardContext.Provider value={value}>
      {children}
    </LeaderboardContext.Provider>
  );
}

// =====================================================================
// HOOKS
// =====================================================================

export function useLeaderboard(): LeaderboardContextValue {
  const context = useContext(LeaderboardContext);
  if (!context) {
    throw new Error("useLeaderboard must be used within a LeaderboardProvider");
  }
  return context;
}

export function useUserPosition(userId: string | null) {
  const { scores, loading, getUserScore } = useLeaderboard();

  return useMemo(() => {
    if (!userId || !scores.length) {
      return {
        position: null,
        total: scores.length,
        userScore: null,
        above: null,
        below: null,
        loading,
      };
    }

    const userScore = getUserScore(userId);
    if (!userScore) {
      return {
        position: null,
        total: scores.length,
        userScore: null,
        above: null,
        below: null,
        loading,
      };
    }

    const userIndex = scores.findIndex((s) => s.userId === userId);
    const above = userIndex > 0 ? scores[userIndex - 1] : null;
    const below = userIndex < scores.length - 1 ? scores[userIndex + 1] : null;

    return {
      position: userScore.position,
      total: scores.length,
      userScore,
      above,
      below,
      loading,
    };
  }, [userId, scores, loading, getUserScore]);
}

/**
 * Hook to get all users' points for a specific match.
 * Returns points calculated centrally (with proper knockout team matching).
 */
export function useMatchPointsForAllUsers(matchId: number) {
  const { scores } = useLeaderboard();

  return useMemo(() => {
    if (!scores.length) {
      return { loading: true, matchPoints: [] };
    }

    const matchPoints = scores
      .map((userScore) => {
        // Filter breakdown to only items for this match
        const matchBreakdown = (userScore.breakdown || []).filter(
          (item) => item.matchId === matchId,
        );
        const points = matchBreakdown.reduce((sum, p) => sum + p.points, 0);

        return {
          userId: userScore.userId,
          displayName: userScore.displayName,
          pointsEarned: points,
          breakdown: matchBreakdown,
        };
      })
      .filter(
        (u) =>
          u.breakdown.length > 0 || scores.some((s) => s.userId === u.userId),
      ); // Include users even with 0 points

    return { loading: false, matchPoints };
  }, [matchId, scores]);
}
