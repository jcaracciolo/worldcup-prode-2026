"use client";

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { useTime } from "@/contexts/TimeContext";
import { useMatches } from "@/contexts/MatchContext";
import { useAllPredictions } from "@/contexts/PredictionsContext";
import { useAllProfiles } from "@/contexts/UserContext";
import { UserScore, CalculatedStanding, FifaMatchId } from "@/types/football";
import { LocalPrediction, Prediction } from "@/types/database";
import { calculateTotalPoints } from "@/lib/scoring";
import { getQualifyingThirdPlaceTeams } from "@/lib/third-place-ranking";
import { calculateAllGroupStandings } from "@/lib/standings";

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
  const { matches } = useMatches();
  const profiles = useAllProfiles();
  const allPredictions = useAllPredictions();

  // Derive loading from LCE hooks
  const loading = profiles.loading || allPredictions.loading;

  // Calculate scores using useMemo - recalculates when dependencies change
  const scores = useMemo(() => {
    if (loading) return [];

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
        totalPoints: 0,
        livePoints: 0,
        groupStagePoints: 0,
        groupBonusPoints: 0,
        knockoutPoints: 0,
        position: 0,
      }));
    }

    // Calculate actual standings from finished matches
    const groupMatches = matches.filter((m) => m.stage === "GROUP_STAGE");
    const groups = new Map<string, typeof matches>();
    groupMatches.forEach((m) => {
      if (!m.group) return;
      if (!groups.has(m.group)) groups.set(m.group, []);
      groups.get(m.group)!.push(m);
    });

    const actualGroupStandings = new Map<string, CalculatedStanding[]>();
    groups.forEach((groupMatchList, groupName) => {
      const teamStats = new Map<number, CalculatedStanding>();

      groupMatchList.forEach((match) => {
        [match.homeTeam, match.awayTeam].forEach((team) => {
          if (!teamStats.has(team.id)) {
            teamStats.set(team.id, {
              team,
              position: 0,
              points: 0,
              goalsFor: 0,
              goalsAgainst: 0,
              goalDifference: 0,
              played: 0,
              won: 0,
              drawn: 0,
              lost: 0,
            });
          }
        });
      });

      groupMatchList.forEach((match) => {
        if (match.status !== "FINISHED") return;
        const homeGoals = match.score.fullTime.home;
        const awayGoals = match.score.fullTime.away;
        if (homeGoals === null || awayGoals === null) return;

        const homeStats = teamStats.get(match.homeTeam.id)!;
        const awayStats = teamStats.get(match.awayTeam.id)!;

        homeStats.played++;
        awayStats.played++;
        homeStats.goalsFor += homeGoals;
        homeStats.goalsAgainst += awayGoals;
        awayStats.goalsFor += awayGoals;
        awayStats.goalsAgainst += homeGoals;
        homeStats.goalDifference = homeStats.goalsFor - homeStats.goalsAgainst;
        awayStats.goalDifference = awayStats.goalsFor - awayStats.goalsAgainst;

        if (homeGoals > awayGoals) {
          homeStats.won++;
          homeStats.points += 3;
          awayStats.lost++;
        } else if (awayGoals > homeGoals) {
          awayStats.won++;
          awayStats.points += 3;
          homeStats.lost++;
        } else {
          homeStats.drawn++;
          awayStats.drawn++;
          homeStats.points += 1;
          awayStats.points += 1;
        }
      });

      const standings = Array.from(teamStats.values())
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.goalDifference !== a.goalDifference)
            return b.goalDifference - a.goalDifference;
          return b.goalsFor - a.goalsFor;
        })
        .map((s, i) => ({ ...s, position: i + 1 }));

      actualGroupStandings.set(groupName, standings);
    });

    // Calculate advancing teams
    const thirdPlaceQualifying =
      getQualifyingThirdPlaceTeams(actualGroupStandings);
    const advancingTeamIds = new Set<number>();
    actualGroupStandings.forEach((standings, groupName) => {
      standings.forEach((standing, index) => {
        if (index < 2) {
          advancingTeamIds.add(standing.team.id);
        } else if (index === 2 && thirdPlaceQualifying.get(groupName)) {
          advancingTeamIds.add(standing.team.id);
        }
      });
    });

    // Calculate scores for each user
    const calculatedScores: UserScore[] = profileList.map((profile) => {
      const userData = predictionsMap.get(profile.id);
      const predictions = userData?.predictions || [];
      const groupOverrides = userData?.overrides || [];

      const matchesWithFifa = matches.map((m) => ({
        ...m,
        fifaNumber: m.fifaNumber as FifaMatchId | null,
      }));

      // Calculate user's predicted standings to determine their 3rd place qualifying
      const predictionMap = new Map<number, LocalPrediction>(
        predictions.map((p: Prediction) => [p.match_id, p]),
      );
      const userPredictedStandings = calculateAllGroupStandings(
        matches,
        predictionMap,
      );
      const userThirdPlaceQualifying = getQualifyingThirdPlaceTeams(
        userPredictedStandings,
      );

      const { totalPoints, livePoints, breakdown } = calculateTotalPoints(
        matchesWithFifa,
        predictions,
        groupOverrides,
        actualGroupStandings,
        advancingTeamIds,
        userThirdPlaceQualifying,
      );

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
    loading,
    matches,
    stageLockStatus.groupStageLocked,
    stageLockStatus.knockoutStageLocked,
    profiles.content,
    allPredictions.content,
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
    if (!userId || loading || !scores.length) {
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
  const { scores, loading } = useLeaderboard();

  return useMemo(() => {
    if (loading) {
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
      .filter((u) => u.breakdown.length > 0 || scores.some(s => s.userId === u.userId)); // Include users even with 0 points

    return { loading: false, matchPoints };
  }, [matchId, scores, loading]);
}
