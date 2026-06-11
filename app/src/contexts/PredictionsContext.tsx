"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { useDatabase } from "@/contexts/DatabaseContext";
import { useMatches, MatchWithLiveInfo } from "@/contexts/MatchContext";
import { LocalPrediction, LocalGroupStandingsOverride, LocalThirdPlaceOverride } from "@/types/database";
import { FifaMatchId, CalculatedStanding } from "@/types/football";
import { LCE, lceLoading, lceContent, lceError } from "@/types/lce";
import { PredictionBracketResolver } from "@/lib/prediction-bracket-resolver";
import { ThirdPlaceTeam } from "@/lib/third-place-ranking";
import { getTeamDisplaySimple } from "@/lib/team-display";
import { useCachedData } from "@/hooks/useCachedData";

// =====================================================================
// TYPES
// =====================================================================

/** Cached data for a single user's predictions */
interface UserPredictionCache {
  predictions: Map<FifaMatchId, LocalPrediction>;
  overrides: LocalGroupStandingsOverride[];
  thirdPlaceOverrides: LocalThirdPlaceOverride[];
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
  /** Update third-place overrides in the shared cache (marks dirty) */
  updateThirdPlaceOverrides: (
    userId: string,
    overrides: LocalThirdPlaceOverride[],
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
        thirdPlaceOverrides: LocalThirdPlaceOverride[];
      }
    >
  >;
  /** Get cached allPredictions result (null if not yet fetched) */
  getCachedAllPredictions: () => AllPredictionsMap | null;
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
  thirdPlaceOverrides: [],
  loading: true,
  error: null,
  dirty: false,
};

/** Type alias for all predictions result */
type AllPredictionsMap = Map<
  string,
  {
    predictions: LocalPrediction[];
    overrides: LocalGroupStandingsOverride[];
    thirdPlaceOverrides: LocalThirdPlaceOverride[];
  }
>;

export function PredictionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { db } = useDatabase();

  // Centralized cache — predictions are global (not per-competition),
  // so use a stable dependency that never triggers invalidation
  const cache = useCachedData<string, UserPredictionCache, AllPredictionsMap>(true);
  const cacheGet = cache.get;
  const cacheHas = cache.has;
  const cacheSet = cache.set;
  const cacheBulkGet = cache.bulk.get;
  const cacheBulkSet = cache.bulk.set;
  const cacheBulkClear = cache.bulk.clear;
  const cacheFetchingStart = cache.fetching.start;
  const cacheFetchingDone = cache.fetching.done;
  const cacheIsCurrentGeneration = cache.isCurrentGeneration;
  const cacheGeneration = cache.generation;
  const cacheVersion = cache.version;

  // Fetch predictions from DB and populate cache
  const fetchUserPredictions = useCallback(
    (userId: string) => {
      if (!cacheFetchingStart(userId)) return; // Already fetching
      const gen = cacheGeneration;

      // Set loading state
      const existing = cacheGet(userId);
      if (!existing) {
        cacheSet(userId, { ...EMPTY_CACHE });
      }

      Promise.all([
        db.predictions.getUserPredictions(userId),
        db.overrides.getUserOverrides(userId),
        db.thirdPlaceOverrides.getUserThirdPlaceOverrides(userId),
      ])
        .then(([predictionsResult, overridesResult, thirdPlaceResult]) => {
          const predictions = new Map<FifaMatchId, LocalPrediction>();
          (predictionsResult.data || []).forEach((p) =>
            predictions.set(p.match_id as FifaMatchId, {
              match_id: p.match_id as FifaMatchId,
              home_goals: p.home_goals,
              away_goals: p.away_goals,
              penalty_winner: p.penalty_winner,
            }),
          );
          const overrides = (overridesResult.data || []).map((o) => ({
            group_name: o.group_name,
            team_id: o.team_id,
            position: o.position,
          }));
          const thirdPlaceOverrides = (thirdPlaceResult.data || []).map((o) => ({
            group_name: o.group_name,
            rank: o.rank,
          }));

          if (!cacheIsCurrentGeneration(gen)) return;

          // Only update cache if not dirty (local edits take priority)
          const current = cacheGet(userId);
          if (!current?.dirty) {
            cacheSet(userId, {
              predictions,
              overrides,
              thirdPlaceOverrides,
              loading: false,
              error: null,
              dirty: false,
            });
          } else {
            // Still mark loading as done
            cacheSet(userId, {
              ...current,
              loading: false,
            });
          }
        })
        .catch((err) => {
          const current = cacheGet(userId);
          cacheSet(userId, {
            predictions: current?.predictions ?? new Map(),
            overrides: current?.overrides ?? [],
            thirdPlaceOverrides: current?.thirdPlaceOverrides ?? [],
            loading: false,
            error: err.message,
            dirty: current?.dirty ?? false,
          });
        })
        .finally(() => {
          cacheFetchingDone(userId);
        });
    },
    [
      db,
      cacheFetchingStart,
      cacheGeneration,
      cacheGet,
      cacheSet,
      cacheIsCurrentGeneration,
      cacheFetchingDone,
    ],
  );

  // Get cached predictions (read-only, no side effects)
  const getCachedPredictions = useCallback(
    (userId: string): UserPredictionCache | null => {
      return cacheGet(userId) || null;
    },
    [cacheGet],
  );

  // Ensure fetch is triggered for a user (safe to call in useEffect)
  const ensureFetched = useCallback(
    (userId: string) => {
      if (!cacheHas(userId)) {
        fetchUserPredictions(userId);
      }
    },
    [cacheHas, fetchUserPredictions],
  );

  // Update a single prediction in the cache
  const updatePrediction = useCallback(
    (userId: string, prediction: LocalPrediction) => {
      const current = cacheGet(userId);
      if (!current) return;

      const next = new Map(current.predictions);
      next.set(prediction.match_id as FifaMatchId, prediction);
      cacheSet(userId, {
        ...current,
        predictions: next,
        dirty: true,
      });
    },
    [cacheGet, cacheSet],
  );

  // Bulk-set predictions in the cache
  const setPredictionsInCache = useCallback(
    (userId: string, predictions: Map<FifaMatchId, LocalPrediction>) => {
      const current = cacheGet(userId);
      if (!current) return;

      cacheSet(userId, {
        ...current,
        predictions: new Map(predictions),
        dirty: true,
      });
    },
    [cacheGet, cacheSet],
  );

  // Update overrides in the cache
  const updateOverrides = useCallback(
    (userId: string, overrides: LocalGroupStandingsOverride[]) => {
      const current = cacheGet(userId);
      if (!current) return;

      cacheSet(userId, {
        ...current,
        overrides: [...overrides],
        dirty: true,
      });
    },
    [cacheGet, cacheSet],
  );

  // Update third-place overrides in the cache
  const updateThirdPlaceOverrides = useCallback(
    (userId: string, overrides: LocalThirdPlaceOverride[]) => {
      const current = cacheGet(userId);
      if (!current) return;

      cacheSet(userId, {
        ...current,
        thirdPlaceOverrides: [...overrides],
        dirty: true,
      });
    },
    [cacheGet, cacheSet],
  );

  // Save predictions to DB
  const savePredictions = useCallback(
    async (userId: string) => {
      const current = cacheGet(userId);
      if (!current) return { success: false, error: "No predictions to save" };

      const predArray = Array.from(current.predictions.values());
      const predResult = await db.predictions.savePredictions(
        userId,
        predArray.map((p) => ({
          match_id: p.match_id,
          home_goals: p.home_goals,
          away_goals: p.away_goals,
          penalty_winner: p.penalty_winner,
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

      if (current.thirdPlaceOverrides.length > 0) {
        const tpResult = await db.thirdPlaceOverrides.saveThirdPlaceOverrides(
          userId,
          current.thirdPlaceOverrides.map((o) => ({
            group_name: o.group_name,
            rank: o.rank,
          })),
        );

        if (!tpResult.success) {
          return { success: false, error: tpResult.error ?? undefined };
        }
      }

      // Clear dirty flag on success
      cacheSet(userId, {
        ...current,
        dirty: false,
      });

      // Invalidate bulk predictions cache so leaderboard/admin refetches
      cacheBulkClear();

      return { success: true };
    },
    [db, cacheGet, cacheSet, cacheBulkClear],
  );

  // Get all users' predictions (for leaderboard)
  // Also populates individual user cache for faster profile page loads
  // Uses in-flight dedup so concurrent callers share a single fetch.
  const allPredictionsPromiseRef = React.useRef<Promise<AllPredictionsMap> | null>(null);

  const getAllPredictions = useCallback(async () => {
    // Return existing in-flight promise if one is already running
    if (allPredictionsPromiseRef.current) {
      return allPredictionsPromiseRef.current;
    }

    // If we already have cached data, return it immediately
    const cached = cacheBulkGet();
    if (cached) return cached;

    const promise = (async () => {
    const [predictionsResult, overridesResult, thirdPlaceResult] = await Promise.all([
      db.predictions.getAllPredictions(),
      db.overrides.getAllOverrides(),
      db.thirdPlaceOverrides.getAllThirdPlaceOverrides(),
    ]);

    const byUser = new Map<
      string,
      {
        predictions: LocalPrediction[];
        overrides: LocalGroupStandingsOverride[];
        thirdPlaceOverrides: LocalThirdPlaceOverride[];
      }
    >();

    (predictionsResult.data || []).forEach((p) => {
      if (!byUser.has(p.user_id)) {
        byUser.set(p.user_id, { predictions: [], overrides: [], thirdPlaceOverrides: [] });
      }
      byUser.get(p.user_id)!.predictions.push({
        match_id: p.match_id as FifaMatchId,
        home_goals: p.home_goals,
        away_goals: p.away_goals,
        penalty_winner: p.penalty_winner,
      });
    });

    (overridesResult.data || []).forEach((o) => {
      if (!byUser.has(o.user_id)) {
        byUser.set(o.user_id, { predictions: [], overrides: [], thirdPlaceOverrides: [] });
      }
      byUser.get(o.user_id)!.overrides.push({
        group_name: o.group_name,
        team_id: o.team_id,
        position: o.position,
      });
    });

    (thirdPlaceResult.data || []).forEach((o) => {
      if (!byUser.has(o.user_id)) {
        byUser.set(o.user_id, { predictions: [], overrides: [], thirdPlaceOverrides: [] });
      }
      byUser.get(o.user_id)!.thirdPlaceOverrides.push({
        group_name: o.group_name,
        rank: o.rank,
      });
    });

    // Populate individual user cache for each user (if not dirty)
    // This ensures profile pages load instantly after viewing leaderboard
    byUser.forEach((userData, usrId) => {
      const current = cacheGet(usrId);
      // Don't overwrite dirty cache entries (local edits)
      if (!current?.dirty) {
        const predictionsMap = new Map<FifaMatchId, LocalPrediction>(
          userData.predictions.map((p) => [p.match_id as FifaMatchId, p]),
        );
        cacheSet(usrId, {
          predictions: predictionsMap,
          overrides: userData.overrides,
          thirdPlaceOverrides: userData.thirdPlaceOverrides,
          loading: false,
          error: null,
          dirty: false,
        });
      }
    });
    cacheBulkSet(byUser);

    return byUser;
    })();

    allPredictionsPromiseRef.current = promise;
    try {
      return await promise;
    } finally {
      allPredictionsPromiseRef.current = null;
    }
  }, [db, cacheGet, cacheSet, cacheBulkSet, cacheBulkGet]);

  const getCachedAllPredictions = useCallback(() => cacheBulkGet(), [cacheBulkGet]);

  const value = useMemo(
    (): PredictionsContextValue => ({
      getCachedPredictions,
      ensureFetched,
      updatePrediction,
      updateOverrides,
      updateThirdPlaceOverrides,
      setPredictions: setPredictionsInCache,
      savePredictions,
      getAllPredictions,
      getCachedAllPredictions,
      cacheVersion,
    }),
    [
      getCachedPredictions,
      ensureFetched,
      updatePrediction,
      updateOverrides,
      updateThirdPlaceOverrides,
      setPredictionsInCache,
      savePredictions,
      getAllPredictions,
      getCachedAllPredictions,
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

  const updateThirdPlaceOverrides = useCallback(
    (overrides: LocalThirdPlaceOverride[]) => {
      if (userId) ctx.updateThirdPlaceOverrides(userId, overrides);
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
    thirdPlaceOverrides: cached.thirdPlaceOverrides,
    loading: cached.loading,
    error: cached.error,
    dirty: cached.dirty,
    updatePrediction,
    updateOverrides,
    updateThirdPlaceOverrides,
    setPredictions,
    savePredictions: save,
  };
}

/**
 * Hook to get all users' predictions.
 * Initializes from cache to avoid loading flash on repeat navigations.
 * Automatically refetches when competition changes (via db dependency).
 */
export function useAllPredictions(): LCE<AllPredictionsMap> {
  const { getAllPredictions, getCachedAllPredictions } =
    usePredictionsContext();

  // Initialize from cache — skip loading if we already have data
  const [state, setState] = useState<LCE<AllPredictionsMap>>(() => {
    const cached = getCachedAllPredictions();
    return cached ? lceContent(cached) : lceLoading();
  });

  useEffect(() => {
    // Only show loading if we have no data at all (first load)
    const cached = getCachedAllPredictions();
    if (!cached && !state.content) setState(lceLoading());

    getAllPredictions()
      .then((predictions) => {
        setState(lceContent(predictions));
      })
      .catch((err) => {
        setState(lceError(err.message));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAllPredictions]);

  return state;
}

// =====================================================================
// PREDICTED BRACKET
// =====================================================================

import { PredictedBracket } from "@/lib/prediction-bracket-resolver";

const EMPTY_BRACKET: PredictedBracket = {
  kind: "predicted",
  teams: new Map(),
  groupStandings: new Map(),
  thirdPlaceQualifying: new Map(),
  rankedThirdPlaceTeams: [],
};

/**
 * Hook that resolves a user's predicted bracket.
 *
 * Returns the PredictedBracket which includes:
 * - teams: Map of knockout match teams (keyed by FIFA match number)
 * - groupStandings: predicted group standings from user's predictions + overrides
 * - thirdPlaceQualifying: which 3rd-place teams qualify
 *
 * This is the single source of truth for a user's predicted bracket.
 * usePredictedMatches composes on top of this to bake teams into MatchWithLiveInfo[].
 *
 * @param userId - User whose predictions drive team resolution (null = no predictions)
 */
export function usePredictedBracket(userId: string | null): PredictedBracket {
  const { rawProcessedMatches, liveBracket } = useMatches();

  const ctx = usePredictionsContext();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _version = ctx.cacheVersion; // Subscribe to cache updates

  const cached = userId ? ctx.getCachedPredictions(userId) : null;
  const predictions = cached?.predictions ?? null;
  const overrides = cached?.overrides ?? null;
  const thirdPlaceOverrides = cached?.thirdPlaceOverrides ?? null;

  // Trigger fetch if not cached
  useEffect(() => {
    if (userId) ctx.ensureFetched(userId);
  }, [userId, ctx]);

  return useMemo(() => {
    if (!predictions || predictions.size === 0) {
      return EMPTY_BRACKET;
    }
    return new PredictionBracketResolver({
      liveBracket,
      matches: rawProcessedMatches,
      predictions,
      groupOverrides: overrides ?? undefined,
      thirdPlaceOverrides: thirdPlaceOverrides ?? undefined,
    }).resolve();
  }, [predictions, overrides, thirdPlaceOverrides, rawProcessedMatches, liveBracket]);
}

// =====================================================================
// PREDICTED MATCHES (baked from bracket)
// =====================================================================

/** Return type for usePredictedMatches — mirrors the shape consumers expect from useMatches */
export interface PredictedMatchesResult {
  /** Matches with user-predicted knockout teams baked into homeTeam/awayTeam */
  matches: MatchWithLiveInfo[];
  /** Group standings computed from user's predicted group match scores + overrides */
  predictedGroupStandings: Map<string, CalculatedStanding[]>;
  /** Which 3rd-place teams qualify based on predicted group standings */
  predictedThirdPlaceQualifying: Map<string, boolean>;
  /** Full ranked list of third-place teams (for the selection table) */
  rankedThirdPlaceTeams: ThirdPlaceTeam[];
  /** Knockout matches (with predicted teams baked in) bucketed by stage */
  knockoutStages: Map<string, MatchWithLiveInfo[]>;
}

/**
 * Bake predicted teams from a PredictedBracket into MatchWithLiveInfo[].
 * Knockout matches get their homeTeam/awayTeam/displayNames overlaid.
 * Group stage matches pass through unchanged.
 */
function bakeTeamsIntoMatches(
  contextMatches: MatchWithLiveInfo[],
  bracket: PredictedBracket,
): MatchWithLiveInfo[] {
  return contextMatches.map((m) => {
    if (m.stage === "GROUP_STAGE") return m;
    const resolved = bracket.teams.get(m.id);
    if (!resolved) return m;
    const homeTeam = resolved.home ?? m.homeTeam;
    const awayTeam = resolved.away ?? m.awayTeam;
    return {
      ...m,
      homeTeam,
      awayTeam,
      homeDisplayName:
        resolved.homeDisplayName ??
        getTeamDisplaySimple(homeTeam, m.id, "home"),
      awayDisplayName:
        resolved.awayDisplayName ??
        getTeamDisplaySimple(awayTeam, m.id, "away"),
    };
  });
}

/**
 * Hook that returns matches with a user's predicted knockout teams baked in.
 *
 * Composes on usePredictedBracket: resolves the bracket, then overlays
 * predicted teams onto MatchWithLiveInfo[] so downstream components
 * (KnockoutMatchRow, etc.) can use match.homeTeam/awayTeam uniformly.
 *
 * @param userId - User whose predictions drive team resolution (null = no predictions)
 */
export function usePredictedMatches(
  userId: string | null,
): PredictedMatchesResult {
  const { matches: contextMatches } = useMatches();
  const bracket = usePredictedBracket(userId);

  const matches = useMemo(() => {
    if (bracket === EMPTY_BRACKET) return contextMatches;
    return bakeTeamsIntoMatches(contextMatches, bracket);
  }, [contextMatches, bracket]);

  const knockoutStages = useMemo(() => {
    const map = new Map<string, MatchWithLiveInfo[]>();
    for (const m of matches) {
      if (m.stage === "GROUP_STAGE") continue;
      if (!map.has(m.stage)) map.set(m.stage, []);
      map.get(m.stage)!.push(m);
    }
    return map;
  }, [matches]);

  return useMemo(
    () => ({
      matches,
      predictedGroupStandings: bracket.groupStandings,
      predictedThirdPlaceQualifying: bracket.thirdPlaceQualifying,
      rankedThirdPlaceTeams: bracket.rankedThirdPlaceTeams,
      knockoutStages,
    }),
    [matches, bracket, knockoutStages],
  );
}

/**
 * Hook to get a single predicted match by FIFA ID for a specific user.
 *
 * Returns the match with the user's predicted knockout teams baked in.
 *
 * @param userId - User whose predictions drive team resolution
 * @param fifaId - FIFA match number (1-104)
 */
export function usePredictedMatch(
  userId: string | null,
  fifaId: FifaMatchId,
): MatchWithLiveInfo | undefined {
  const { matches } = usePredictedMatches(userId);
  return useMemo(() => matches.find((m) => m.id === fifaId), [matches, fifaId]);
}
