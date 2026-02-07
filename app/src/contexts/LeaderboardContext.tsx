"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { useTime } from "@/contexts/TimeContext";
import { useMatches } from "@/contexts/MatchContext";
import { usePredictionsContext } from "@/contexts/PredictionsContext";
import { useUser } from "@/contexts/UserContext";
import { UserScore, CalculatedStanding, FifaMatchId } from "@/types/football";
import { calculateTotalPoints } from "@/lib/scoring";
import { getQualifyingThirdPlaceTeams } from "@/lib/third-place-ranking";

// =====================================================================
// TYPES
// =====================================================================

interface LeaderboardContextValue {
  /** All user scores with positions (sorted by total points) */
  scores: UserScore[];
  /** Whether the leaderboard is loading */
  loading: boolean;
  /** Get position for a specific user (with tie handling) */
  getPosition: (userId: string) => number | null;
  /** Get a user's full score info */
  getUserScore: (userId: string) => UserScore | null;
  /** Force refresh the leaderboard */
  refresh: () => Promise<void>;
}

const LeaderboardContext = createContext<LeaderboardContextValue | null>(null);

// =====================================================================
// PROVIDER
// =====================================================================

interface LeaderboardProviderProps {
  children: ReactNode;
}

export function LeaderboardProvider({ children }: LeaderboardProviderProps) {
  const { tick, stageLockStatus } = useTime();
  const { matches } = useMatches();
  const { getAllProfiles } = useUser();
  const { getAllPredictions } = usePredictionsContext();
  const [scores, setScores] = useState<UserScore[]>([]);
  const [loading, setLoading] = useState(true);

  // Calculate leaderboard locally from matches and predictions
  const calculateLeaderboard = useCallback(async () => {
    try {
      setLoading(true);

      // Get all profiles and predictions
      const [profiles, allPredictions] = await Promise.all([
        getAllProfiles(),
        getAllPredictions(),
      ]);

      if (!profiles || profiles.length === 0) {
        setScores([]);
        return;
      }

      // If nothing is locked, everyone has 0 points
      if (!stageLockStatus.groupStageLocked && !stageLockStatus.knockoutStageLocked) {
        setScores(
          profiles.map((p) => ({
            userId: p.id,
            displayName: p.display_name,
            totalPoints: 0,
            livePoints: 0,
            groupStagePoints: 0,
            groupBonusPoints: 0,
            knockoutPoints: 0,
            position: 0,
          }))
        );
        return;
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
          if (!teamStats.has(match.homeTeam.id)) {
            teamStats.set(match.homeTeam.id, {
              team: match.homeTeam,
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
          if (!teamStats.has(match.awayTeam.id)) {
            teamStats.set(match.awayTeam.id, {
              team: match.awayTeam,
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
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
            return b.goalsFor - a.goalsFor;
          })
          .map((s, i) => ({ ...s, position: i + 1 }));

        actualGroupStandings.set(groupName, standings);
      });

      // Calculate advancing teams
      const actualThirdPlaceQualifying = getQualifyingThirdPlaceTeams(actualGroupStandings);
      const advancingTeamIds = new Set<number>();
      actualGroupStandings.forEach((standings, groupName) => {
        standings.forEach((standing, index) => {
          if (index < 2) {
            advancingTeamIds.add(standing.team.id);
          } else if (index === 2 && actualThirdPlaceQualifying.get(groupName)) {
            advancingTeamIds.add(standing.team.id);
          }
        });
      });

      // Calculate scores for each user
      const calculatedScores: UserScore[] = profiles.map((profile) => {
        const userData = allPredictions.get(profile.id);
        const predictions = userData?.predictions || [];
        const groupOverrides = userData?.overrides || [];

        // Add fifaNumber to matches for calculateTotalPoints
        const matchesWithFifa = matches.map((m) => ({
          ...m,
          fifaNumber: m.fifaNumber as FifaMatchId | null,
        }));

        const { totalPoints, livePoints, breakdown } = calculateTotalPoints(
          matchesWithFifa,
          predictions,
          groupOverrides,
          actualGroupStandings,
          advancingTeamIds
        );

        // Categorize points
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
        };
      });

      // Sort by total points and assign positions
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

      setScores(calculatedScores);
    } catch (err) {
      console.error("Failed to calculate local leaderboard:", err);
    } finally {
      setLoading(false);
    }
  }, [matches, stageLockStatus, getAllProfiles, getAllPredictions]);

  // Calculate leaderboard on mount and when matches/tick changes
  useEffect(() => {
    calculateLeaderboard();
  }, [
    calculateLeaderboard,
    tick,
    stageLockStatus.groupStageLocked,
    stageLockStatus.knockoutStageLocked,
  ]);

  // Get position for a specific user
  const getPosition = useCallback(
    (userId: string): number | null => {
      const userScore = scores.find((s) => s.userId === userId);
      return userScore?.position ?? null;
    },
    [scores],
  );

  // Get full score info for a user
  const getUserScore = useCallback(
    (userId: string): UserScore | null => {
      return scores.find((s) => s.userId === userId) ?? null;
    },
    [scores],
  );

  // Manual refresh function
  const refresh = useCallback(async () => {
    await calculateLeaderboard();
  }, [calculateLeaderboard]);

  const value: LeaderboardContextValue = useMemo(
    () => ({
      scores,
      loading,
      getPosition,
      getUserScore,
      refresh,
    }),
    [scores, loading, getPosition, getUserScore, refresh],
  );

  return (
    <LeaderboardContext.Provider value={value}>
      {children}
    </LeaderboardContext.Provider>
  );
}

// =====================================================================
// HOOK
// =====================================================================

export function useLeaderboard(): LeaderboardContextValue {
  const context = useContext(LeaderboardContext);
  if (!context) {
    throw new Error("useLeaderboard must be used within a LeaderboardProvider");
  }
  return context;
}

/**
 * Hook to get position info for a specific user
 * Returns null if user not found or leaderboard not loaded
 */
export function useUserPosition(userId: string | null) {
  const { scores, loading, getUserScore } = useLeaderboard();

  return useMemo(() => {
    if (!userId || loading || scores.length === 0) {
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

    // Find neighbors (leaderboard is already sorted)
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
