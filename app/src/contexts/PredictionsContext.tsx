"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { Prediction, GroupStandingsOverride } from "@/types/database";

// =====================================================================
// TYPES
// =====================================================================

export interface UserPredictions {
  userId: string;
  predictions: Map<number, Prediction>;
  overrides: GroupStandingsOverride[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

interface PredictionsContextValue {
  /** Get predictions for a user (loads if not cached) */
  getUserPredictions: (userId: string) => Promise<UserPredictions>;
  /** Get cached predictions (returns undefined if not loaded) */
  getCachedPredictions: (userId: string) => UserPredictions | undefined;
  /** Refresh predictions for a user */
  refreshUserPredictions: (userId: string) => Promise<void>;
  /** Update a single prediction (optimistic update) */
  updatePrediction: (userId: string, prediction: Prediction) => void;
  /** Update overrides for a user */
  updateOverrides: (
    userId: string,
    overrides: GroupStandingsOverride[],
  ) => void;
  /** Save all predictions to database */
  savePredictions: (
    userId: string,
    predictions: Map<number, Prediction>,
    overrides: GroupStandingsOverride[],
  ) => Promise<{ success: boolean; error?: string }>;
  /** Clear cache for a user */
  clearCache: (userId: string) => void;
  /** Clear all caches */
  clearAllCaches: () => void;
}

const PredictionsContext = createContext<PredictionsContextValue | null>(null);

// =====================================================================
// PROVIDER
// =====================================================================

interface PredictionsProviderProps {
  children: React.ReactNode;
}

export function PredictionsProvider({ children }: PredictionsProviderProps) {
  const [cache, setCache] = useState<Map<string, UserPredictions>>(new Map());
  const supabase = useMemo(() => createClient(), []);

  // Fetch predictions for a user from Supabase
  const fetchPredictions = useCallback(
    async (userId: string): Promise<UserPredictions> => {
      try {
        // Fetch predictions
        const { data: predictionsData, error: predictionsError } =
          await supabase.from("predictions").select("*").eq("user_id", userId);

        if (predictionsError) throw predictionsError;

        // Fetch overrides
        const { data: overridesData, error: overridesError } = await supabase
          .from("group_standings_overrides")
          .select("*")
          .eq("user_id", userId);

        if (overridesError) throw overridesError;

        // Build predictions map
        const predictionsMap = new Map<number, Prediction>();
        (predictionsData || []).forEach((p: Prediction) => {
          predictionsMap.set(p.match_id, p);
        });

        return {
          userId,
          predictions: predictionsMap,
          overrides: overridesData || [],
          loading: false,
          error: null,
          lastUpdated: new Date(),
        };
      } catch (error) {
        console.error(`Failed to fetch predictions for user ${userId}:`, error);
        return {
          userId,
          predictions: new Map(),
          overrides: [],
          loading: false,
          error: error instanceof Error ? error.message : "Unknown error",
          lastUpdated: null,
        };
      }
    },
    [supabase],
  );

  // Get user predictions (loads if not cached)
  const getUserPredictions = useCallback(
    async (userId: string): Promise<UserPredictions> => {
      const cached = cache.get(userId);
      if (cached && cached.lastUpdated) {
        return cached;
      }

      // Set loading state
      setCache((prev) => {
        const newCache = new Map(prev);
        newCache.set(userId, {
          userId,
          predictions: cached?.predictions || new Map(),
          overrides: cached?.overrides || [],
          loading: true,
          error: null,
          lastUpdated: cached?.lastUpdated || null,
        });
        return newCache;
      });

      const result = await fetchPredictions(userId);

      setCache((prev) => {
        const newCache = new Map(prev);
        newCache.set(userId, result);
        return newCache;
      });

      return result;
    },
    [cache, fetchPredictions],
  );

  // Get cached predictions without fetching
  const getCachedPredictions = useCallback(
    (userId: string): UserPredictions | undefined => {
      return cache.get(userId);
    },
    [cache],
  );

  // Refresh predictions for a user
  const refreshUserPredictions = useCallback(
    async (userId: string): Promise<void> => {
      const result = await fetchPredictions(userId);
      setCache((prev) => {
        const newCache = new Map(prev);
        newCache.set(userId, result);
        return newCache;
      });
    },
    [fetchPredictions],
  );

  // Update a single prediction (optimistic update)
  const updatePrediction = useCallback(
    (userId: string, prediction: Prediction): void => {
      setCache((prev) => {
        const newCache = new Map(prev);
        const existing = newCache.get(userId);
        if (existing) {
          const newPredictions = new Map(existing.predictions);
          newPredictions.set(prediction.match_id, prediction);
          newCache.set(userId, {
            ...existing,
            predictions: newPredictions,
          });
        }
        return newCache;
      });
    },
    [],
  );

  // Update overrides for a user
  const updateOverrides = useCallback(
    (userId: string, overrides: GroupStandingsOverride[]): void => {
      setCache((prev) => {
        const newCache = new Map(prev);
        const existing = newCache.get(userId);
        if (existing) {
          newCache.set(userId, {
            ...existing,
            overrides,
          });
        }
        return newCache;
      });
    },
    [],
  );

  // Clear cache for a user
  const clearCache = useCallback((userId: string): void => {
    setCache((prev) => {
      const newCache = new Map(prev);
      newCache.delete(userId);
      return newCache;
    });
  }, []);

  // Clear all caches
  const clearAllCaches = useCallback((): void => {
    setCache(new Map());
  }, []);

  // Save predictions to database
  const savePredictions = useCallback(
    async (
      userId: string,
      predictions: Map<number, Prediction>,
      overrides: GroupStandingsOverride[],
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        // Convert predictions to array for upsert
        const predictionsArray = Array.from(predictions.values())
          .filter((p) => p.home_goals !== null || p.away_goals !== null)
          .map((p) => ({
            user_id: userId,
            match_id: p.match_id,
            home_goals: p.home_goals,
            away_goals: p.away_goals,
            winner_id: p.winner_id,
          }));

        // Upsert predictions
        const { error: predError } = await supabase
          .from("predictions")
          .upsert(predictionsArray, { onConflict: "user_id,match_id" });

        if (predError) throw predError;

        // Upsert overrides
        if (overrides.length > 0) {
          const { error: overrideError } = await supabase
            .from("group_standings_overrides")
            .upsert(
              overrides.map((o) => ({
                user_id: userId,
                group_name: o.group_name,
                team_id: o.team_id,
                position: o.position,
              })),
              { onConflict: "user_id,group_name,team_id" },
            );

          if (overrideError) throw overrideError;
        }

        // Update cache with saved data
        setCache((prev) => {
          const newCache = new Map(prev);
          newCache.set(userId, {
            userId,
            predictions: new Map(predictions),
            overrides: [...overrides],
            loading: false,
            error: null,
            lastUpdated: new Date(),
          });
          return newCache;
        });

        return { success: true };
      } catch (error) {
        console.error("Failed to save predictions:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to save",
        };
      }
    },
    [supabase],
  );

  const value: PredictionsContextValue = {
    getUserPredictions,
    getCachedPredictions,
    refreshUserPredictions,
    updatePrediction,
    updateOverrides,
    savePredictions,
    clearCache,
    clearAllCaches,
  };

  return (
    <PredictionsContext.Provider value={value}>
      {children}
    </PredictionsContext.Provider>
  );
}

// =====================================================================
// HOOKS
// =====================================================================

/**
 * Hook to access predictions context
 */
export function usePredictionsContext(): PredictionsContextValue {
  const context = useContext(PredictionsContext);
  if (!context) {
    throw new Error(
      "usePredictionsContext must be used within a PredictionsProvider",
    );
  }
  return context;
}

/**
 * Hook to get predictions for a specific user
 * Automatically fetches if not cached
 */
export function useUserPredictions(userId: string | null): {
  predictions: Map<number, Prediction>;
  overrides: GroupStandingsOverride[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updatePrediction: (prediction: Prediction) => void;
  updateOverrides: (overrides: GroupStandingsOverride[]) => void;
  savePredictions: (
    predictions: Map<number, Prediction>,
    overrides: GroupStandingsOverride[],
  ) => Promise<{ success: boolean; error?: string }>;
} {
  const {
    getUserPredictions,
    getCachedPredictions,
    refreshUserPredictions,
    updatePrediction: contextUpdatePrediction,
    updateOverrides: contextUpdateOverrides,
    savePredictions: contextSavePredictions,
  } = usePredictionsContext();
  const [state, setState] = useState<UserPredictions | null>(null);

  // Load predictions on mount or userId change
  React.useEffect(() => {
    if (!userId) {
      setState(null);
      return;
    }

    // Check cache first
    const cached = getCachedPredictions(userId);
    if (cached) {
      setState(cached);
    }

    // Fetch (will use cache if available)
    getUserPredictions(userId).then(setState);
  }, [userId, getCachedPredictions, getUserPredictions]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    await refreshUserPredictions(userId);
    const updated = getCachedPredictions(userId);
    if (updated) setState(updated);
  }, [userId, refreshUserPredictions, getCachedPredictions]);

  const updatePrediction = useCallback(
    (prediction: Prediction) => {
      if (!userId) return;
      contextUpdatePrediction(userId, prediction);
      // Also update local state for immediate UI feedback
      setState((prev) => {
        if (!prev) return prev;
        const newPredictions = new Map(prev.predictions);
        newPredictions.set(prediction.match_id, prediction);
        return { ...prev, predictions: newPredictions };
      });
    },
    [userId, contextUpdatePrediction],
  );

  const updateOverrides = useCallback(
    (overrides: GroupStandingsOverride[]) => {
      if (!userId) return;
      contextUpdateOverrides(userId, overrides);
      setState((prev) => (prev ? { ...prev, overrides } : prev));
    },
    [userId, contextUpdateOverrides],
  );

  const savePredictions = useCallback(
    async (
      predictions: Map<number, Prediction>,
      overrides: GroupStandingsOverride[],
    ): Promise<{ success: boolean; error?: string }> => {
      if (!userId) return { success: false, error: "Not logged in" };
      const result = await contextSavePredictions(userId, predictions, overrides);
      if (result.success) {
        // Update local state with saved data
        setState((prev) =>
          prev
            ? { ...prev, predictions: new Map(predictions), overrides: [...overrides] }
            : prev,
        );
      }
      return result;
    },
    [userId, contextSavePredictions],
  );

  return {
    predictions: state?.predictions || new Map(),
    overrides: state?.overrides || [],
    loading: state?.loading ?? true,
    error: state?.error || null,
    refresh,
    updatePrediction,
    updateOverrides,
    savePredictions,
  };
}


