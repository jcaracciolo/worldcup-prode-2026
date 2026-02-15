"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { useDatabase } from "@/contexts/DatabaseContext";
import { LocalPrediction, LocalGroupStandingsOverride } from "@/types/database";
import { FifaMatchId } from "@/types/football";
import { LCE, lceLoading, lceContent, lceError } from "@/types/lce";

// =====================================================================
// TYPES
// =====================================================================

/** Cached data for a single user's predictions */
interface UserPredictionCache {
  predictions: Map<FifaMatchId, LocalPrediction>;
  overrides: LocalGroupStandingsOverride[];
  loading: boolean;
  error: string | null;
  /** Whether local edits exist that haven't been saved to DB */
  dirty: boolean;
}

interface PredictionsContextValue {
  /** Get cached predictions (read-only, returns null if not cached) */
  getCachedPredictions: (userId: string) => UserPredictionCache | null;
  /** Trigger fetch for a user if not already cached (call from useEffect) */
  ensureFetched: (userId: string) => void;
  /** Update a single prediction in the shared cache (marks dirty) */
  updatePrediction: (userId: string, prediction: LocalPrediction) => void;
  /** Update overrides in the shared cache (marks dirty) */
  updateOverrides: (
    userId: string,
    overrides: LocalGroupStandingsOverride[],
  ) => void;
  /** Bulk-set predictions in the shared cache (marks dirty) */
  setPredictions: (
    userId: string,
    predictions: Map<FifaMatchId, LocalPrediction>,
  ) => void;
  /** Save predictions to DB and clear dirty flag */
  savePredictions: (
    userId: string,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Get all users' predictions (for leaderboard) */
  getAllPredictions: () => Promise<
    Map<
      string,
      {
        predictions: LocalPrediction[];
        overrides: LocalGroupStandingsOverride[];
      }
    >
  >;
  /** Cache version counter — increments on any cache mutation to trigger re-renders */
  cacheVersion: number;
}

const PredictionsContext = createContext<PredictionsContextValue | null>(null);

// =====================================================================
// PROVIDER
// =====================================================================

const EMPTY_CACHE: UserPredictionCache = {
  predictions: new Map(),
  overrides: [],
  loading: true,
  error: null,
  dirty: false,
};

export function PredictionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { db } = useDatabase();

  // Shared cache: userId → predictions/overrides/loading/dirty
  const cacheRef = useRef(new Map<string, UserPredictionCache>());
  // Version counter to trigger re-renders when cache mutates
  const [cacheVersion, setCacheVersion] = useState(0);
  // Track in-flight fetches to avoid duplicate requests
  const fetchingRef = useRef(new Set<string>());

  const bumpVersion = useCallback(() => {
    setCacheVersion((v) => v + 1);
  }, []);

  // Fetch predictions from DB and populate cache
  const fetchUserPredictions = useCallback(
    (userId: string) => {
      if (fetchingRef.current.has(userId)) return; // Already fetching
      fetchingRef.current.add(userId);

      // Set loading state
      const existing = cacheRef.current.get(userId);
      if (!existing) {
        cacheRef.current.set(userId, { ...EMPTY_CACHE });
        bumpVersion();
      }

      Promise.all([
        db.predictions.getUserPredictions(userId),
        db.overrides.getUserOverrides(userId),
      ])
        .then(([predictionsResult, overridesResult]) => {
          const predictions = new Map<FifaMatchId, LocalPrediction>();
          (predictionsResult.data || []).forEach((p) =>
            predictions.set(p.match_id as FifaMatchId, {
              match_id: p.match_id,
              home_goals: p.home_goals,
              away_goals: p.away_goals,
              winner_id: p.winner_id,
            }),
          );
          const overrides = (overridesResult.data || []).map((o) => ({
            group_name: o.group_name,
            team_id: o.team_id,
            position: o.position,
          }));

          // Only update cache if not dirty (local edits take priority)
          const current = cacheRef.current.get(userId);
          if (!current?.dirty) {
            cacheRef.current.set(userId, {
              predictions,
              overrides,
              loading: false,
              error: null,
              dirty: false,
            });
          } else {
            // Still mark loading as done
            cacheRef.current.set(userId, {
              ...current,
              loading: false,
            });
          }
          bumpVersion();
        })
        .catch((err) => {
          const current = cacheRef.current.get(userId);
          cacheRef.current.set(userId, {
            predictions: current?.predictions ?? new Map(),
            overrides: current?.overrides ?? [],
            loading: false,
            error: err.message,
            dirty: current?.dirty ?? false,
          });
          bumpVersion();
        })
        .finally(() => {
          fetchingRef.current.delete(userId);
        });
    },
    [db, bumpVersion],
  );

  // Get cached predictions (read-only, no side effects)
  const getCachedPredictions = useCallback(
    (userId: string): UserPredictionCache | null => {
      return cacheRef.current.get(userId) || null;
    },
    [],
  );

  // Ensure fetch is triggered for a user (safe to call in useEffect)
  const ensureFetched = useCallback(
    (userId: string) => {
      if (!cacheRef.current.has(userId)) {
        fetchUserPredictions(userId);
      }
    },
    [fetchUserPredictions],
  );

  // Update a single prediction in the cache
  const updatePrediction = useCallback(
    (userId: string, prediction: LocalPrediction) => {
      const current = cacheRef.current.get(userId);
      if (!current) return;

      const next = new Map(current.predictions);
      next.set(prediction.match_id as FifaMatchId, prediction);
      cacheRef.current.set(userId, {
        ...current,
        predictions: next,
        dirty: true,
      });
      bumpVersion();
    },
    [bumpVersion],
  );

  // Bulk-set predictions in the cache
  const setPredictionsInCache = useCallback(
    (userId: string, predictions: Map<FifaMatchId, LocalPrediction>) => {
      const current = cacheRef.current.get(userId);
      if (!current) return;

      cacheRef.current.set(userId, {
        ...current,
        predictions: new Map(predictions),
        dirty: true,
      });
      bumpVersion();
    },
    [bumpVersion],
  );

  // Update overrides in the cache
  const updateOverrides = useCallback(
    (userId: string, overrides: LocalGroupStandingsOverride[]) => {
      const current = cacheRef.current.get(userId);
      if (!current) return;

      cacheRef.current.set(userId, {
        ...current,
        overrides: [...overrides],
        dirty: true,
      });
      bumpVersion();
    },
    [bumpVersion],
  );

  // Save predictions to DB
  const savePredictions = useCallback(
    async (userId: string) => {
      const current = cacheRef.current.get(userId);
      if (!current) return { success: false, error: "No predictions to save" };

      const predArray = Array.from(current.predictions.values());
      const predResult = await db.predictions.savePredictions(
        userId,
        predArray.map((p) => ({
          match_id: p.match_id,
          home_goals: p.home_goals,
          away_goals: p.away_goals,
          winner_id: p.winner_id,
        })),
      );

      if (!predResult.success) {
        return { success: false, error: predResult.error ?? undefined };
      }

      if (current.overrides.length > 0) {
        const overrideResult = await db.overrides.saveOverrides(
          userId,
          current.overrides.map((o) => ({
            group_name: o.group_name,
            team_id: o.team_id,
            position: o.position,
          })),
        );

        if (!overrideResult.success) {
          return { success: false, error: overrideResult.error ?? undefined };
        }
      }

      // Clear dirty flag on success
      cacheRef.current.set(userId, {
        ...current,
        dirty: false,
      });
      bumpVersion();

      return { success: true };
    },
    [db, bumpVersion],
  );

  // Get all users' predictions (for leaderboard)
  const getAllPredictions = useCallback(async () => {
    const [predictionsResult, overridesResult] = await Promise.all([
      db.predictions.getAllPredictions(),
      db.overrides.getAllOverrides(),
    ]);

    const byUser = new Map<
      string,
      {
        predictions: LocalPrediction[];
        overrides: LocalGroupStandingsOverride[];
      }
    >();

    (predictionsResult.data || []).forEach((p) => {
      if (!byUser.has(p.user_id)) {
        byUser.set(p.user_id, { predictions: [], overrides: [] });
      }
      byUser.get(p.user_id)!.predictions.push({
        match_id: p.match_id,
        home_goals: p.home_goals,
        away_goals: p.away_goals,
        winner_id: p.winner_id,
      });
    });

    (overridesResult.data || []).forEach((o) => {
      if (!byUser.has(o.user_id)) {
        byUser.set(o.user_id, { predictions: [], overrides: [] });
      }
      byUser.get(o.user_id)!.overrides.push({
        group_name: o.group_name,
        team_id: o.team_id,
        position: o.position,
      });
    });

    return byUser;
  }, [db]);

  const value = useMemo(
    (): PredictionsContextValue => ({
      getCachedPredictions,
      ensureFetched,
      updatePrediction,
      updateOverrides,
      setPredictions: setPredictionsInCache,
      savePredictions,
      getAllPredictions,
      cacheVersion,
    }),
    [
      getCachedPredictions,
      ensureFetched,
      updatePrediction,
      updateOverrides,
      setPredictionsInCache,
      savePredictions,
      getAllPredictions,
      cacheVersion,
    ],
  );

  return (
    <PredictionsContext.Provider value={value}>
      {children}
    </PredictionsContext.Provider>
  );
}

// =====================================================================
// HOOKS
// =====================================================================

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
 * Hook to get predictions for a specific user.
 * Returns data from the shared cache in PredictionsContext.
 * Multiple components calling this with the same userId share the same data.
 * Use updatePrediction/updateOverrides to modify (marks cache dirty).
 * Use savePredictions to flush to DB.
 */
export function useUserPredictions(userId: string | null) {
  const ctx = usePredictionsContext();

  // Subscribe to cache changes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _version = ctx.cacheVersion;

  // Trigger fetch in useEffect (not during render)
  useEffect(() => {
    if (userId) {
      ctx.ensureFetched(userId);
    }
  }, [userId, ctx]);

  // Read from cache (returns null if not yet fetched)
  const cached = userId
    ? (ctx.getCachedPredictions(userId) ?? EMPTY_CACHE)
    : EMPTY_CACHE;

  const updatePrediction = useCallback(
    (prediction: LocalPrediction) => {
      if (userId) ctx.updatePrediction(userId, prediction);
    },
    [userId, ctx],
  );

  const updateOverrides = useCallback(
    (overrides: LocalGroupStandingsOverride[]) => {
      if (userId) ctx.updateOverrides(userId, overrides);
    },
    [userId, ctx],
  );

  const setPredictions = useCallback(
    (predictions: Map<FifaMatchId, LocalPrediction>) => {
      if (userId) ctx.setPredictions(userId, predictions);
    },
    [userId, ctx],
  );

  const save = useCallback(async () => {
    if (!userId) return { success: false, error: "Not logged in" };
    return ctx.savePredictions(userId);
  }, [userId, ctx]);

  return {
    predictions: cached.predictions,
    overrides: cached.overrides,
    loading: cached.loading,
    error: cached.error,
    dirty: cached.dirty,
    updatePrediction,
    updateOverrides,
    setPredictions,
    savePredictions: save,
  };
}

/** Type alias for all predictions result */
type AllPredictionsMap = Map<
  string,
  {
    predictions: LocalPrediction[];
    overrides: LocalGroupStandingsOverride[];
  }
>;

/**
 * Hook to get all users' predictions.
 * Automatically refetches when competition changes (via db dependency).
 */
export function useAllPredictions(): LCE<AllPredictionsMap> {
  const { getAllPredictions } = usePredictionsContext();
  const [state, setState] = useState<LCE<AllPredictionsMap>>(lceLoading());

  useEffect(() => {
    setState(lceLoading());
    getAllPredictions()
      .then((predictions) => {
        setState(lceContent(predictions));
      })
      .catch((err) => {
        setState(lceError(err.message));
      });
  }, [getAllPredictions]);

  return state;
}
