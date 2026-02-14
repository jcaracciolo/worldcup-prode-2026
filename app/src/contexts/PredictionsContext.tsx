"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useDatabase } from "@/contexts/DatabaseContext";
import { LocalPrediction, LocalGroupStandingsOverride } from "@/types/database";
import { FifaMatchId } from "@/types/football";

// =====================================================================
// TYPES
// =====================================================================

interface PredictionsContextValue {
  /** Get predictions for a user */
  getUserPredictions: (userId: string) => Promise<{
    predictions: Map<FifaMatchId, LocalPrediction>;
    overrides: LocalGroupStandingsOverride[];
  }>;
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
  /** Save predictions for a user */
  savePredictions: (
    userId: string,
    predictions: LocalPrediction[],
    overrides: LocalGroupStandingsOverride[],
  ) => Promise<{ success: boolean; error?: string }>;
}

const PredictionsContext = createContext<PredictionsContextValue | null>(null);

// =====================================================================
// PROVIDER
// =====================================================================

export function PredictionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { db } = useDatabase();

  const getUserPredictions = useCallback(
    async (userId: string) => {
      const [predictionsResult, overridesResult] = await Promise.all([
        db.predictions.getUserPredictions(userId),
        db.overrides.getUserOverrides(userId),
      ]);

      const predictions = new Map<FifaMatchId, LocalPrediction>();
      (predictionsResult.data || []).forEach((p) =>
        predictions.set(p.match_id as FifaMatchId, {
          match_id: p.match_id,
          home_goals: p.home_goals,
          away_goals: p.away_goals,
          winner_id: p.winner_id,
        }),
      );

      return {
        predictions,
        overrides: (overridesResult.data || []).map((o) => ({
          group_name: o.group_name,
          team_id: o.team_id,
          position: o.position,
        })),
      };
    },
    [db],
  );

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

  const savePredictions = useCallback(
    async (
      userId: string,
      predictions: LocalPrediction[],
      overrides: LocalGroupStandingsOverride[],
    ) => {
      const predResult = await db.predictions.savePredictions(
        userId,
        predictions.map((p) => ({
          match_id: p.match_id,
          home_goals: p.home_goals,
          away_goals: p.away_goals,
          winner_id: p.winner_id,
        })),
      );

      if (!predResult.success) {
        return { success: false, error: predResult.error ?? undefined };
      }

      if (overrides.length > 0) {
        const overrideResult = await db.overrides.saveOverrides(
          userId,
          overrides.map((o) => ({
            group_name: o.group_name,
            team_id: o.team_id,
            position: o.position,
          })),
        );

        if (!overrideResult.success) {
          return { success: false, error: overrideResult.error ?? undefined };
        }
      }

      return { success: true };
    },
    [db],
  );

  return (
    <PredictionsContext.Provider
      value={{ getUserPredictions, getAllPredictions, savePredictions }}
    >
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
 * Automatically refetches when competition changes (via db dependency).
 */
export function useUserPredictions(userId: string | null) {
  const { getUserPredictions, savePredictions } = usePredictionsContext();

  const [predictions, setPredictions] = useState<
    Map<FifaMatchId, LocalPrediction>
  >(new Map());
  const [overrides, setOverrides] = useState<LocalGroupStandingsOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setPredictions(new Map());
      setOverrides([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    getUserPredictions(userId)
      .then((result) => {
        setPredictions(result.predictions);
        setOverrides(result.overrides);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
        setPredictions(new Map());
        setOverrides([]);
      })
      .finally(() => setLoading(false));
  }, [userId, getUserPredictions]);

  const save = useCallback(
    async (
      newPredictions: Map<FifaMatchId, LocalPrediction>,
      newOverrides: LocalGroupStandingsOverride[],
    ) => {
      if (!userId) return { success: false, error: "Not logged in" };

      const result = await savePredictions(
        userId,
        Array.from(newPredictions.values()),
        newOverrides,
      );

      if (result.success) {
        setPredictions(new Map(newPredictions));
        setOverrides([...newOverrides]);
      }

      return result;
    },
    [userId, savePredictions],
  );

  const updatePrediction = useCallback((prediction: LocalPrediction) => {
    setPredictions((prev) => {
      const next = new Map(prev);
      next.set(prediction.match_id as FifaMatchId, prediction);
      return next;
    });
  }, []);

  const updateOverrides = useCallback(
    (newOverrides: LocalGroupStandingsOverride[]) => {
      setOverrides(newOverrides);
    },
    [],
  );

  return {
    predictions,
    overrides,
    loading,
    error,
    updatePrediction,
    updateOverrides,
    savePredictions: save,
  };
}
