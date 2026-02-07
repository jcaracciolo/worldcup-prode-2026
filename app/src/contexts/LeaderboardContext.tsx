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
import { UserScore } from "@/types/football";

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
  const [scores, setScores] = useState<UserScore[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch leaderboard from API
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard");
      const data = await res.json();
      if (data.scores) {
        setScores(data.scores);
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and refetch on tick/lock status changes
  useEffect(() => {
    fetchLeaderboard();
  }, [
    fetchLeaderboard,
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

  const value: LeaderboardContextValue = useMemo(
    () => ({
      scores,
      loading,
      getPosition,
      getUserScore,
      refresh: fetchLeaderboard,
    }),
    [scores, loading, getPosition, getUserScore, fetchLeaderboard],
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
