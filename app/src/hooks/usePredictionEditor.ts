import { useState, useCallback } from "react";
import { useMatches, MatchWithLiveInfo } from "@/contexts/MatchContext";
import { useTime } from "@/contexts/TimeContext";
import { useUser } from "@/contexts/UserContext";
import {
  useUserPredictions,
  usePredictedMatches,
} from "@/contexts/PredictionsContext";
import { FifaMatchId, CalculatedStanding } from "@/types/football";
import { LocalPrediction } from "@/types/database";

// ── Modal / toast types ────────────────────────────────────────────
export interface ToastState {
  message: string;
  type: "success" | "error" | "warning";
}

export interface ConfirmModalState {
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
}

// ── Hook return type ───────────────────────────────────────────────
export interface PredictionEditor {
  // Auth
  profile: ReturnType<typeof useUser>["user"];
  userLoading: boolean;

  // Match data (for rendering)
  matches: MatchWithLiveInfo[];
  matchesLoading: boolean;
  hasLiveMatches: boolean;
  liveMatches: MatchWithLiveInfo[];
  groups: Map<string, MatchWithLiveInfo[]>;

  // Prediction data (for rendering)
  predictions: Map<FifaMatchId, LocalPrediction>;
  predictionsLoading: boolean;
  predictedGroupStandings: Map<string, CalculatedStanding[]>;
  predictedThirdPlaceQualifying: Map<string, boolean>;
  knockoutStages: Map<string, MatchWithLiveInfo[]>;

  // Lock status
  groupLocked: boolean;
  knockoutOpen: boolean;
  knockoutLocked: boolean;
  daysUntilKnockoutLocks: number | null;

  // Editing handlers
  handlePredictionChange: (
    fifaMatchId: FifaMatchId,
    homeGoals: number | null,
    awayGoals: number | null,
    penaltyWinner?: "HOME" | "AWAY" | null,
  ) => void;
  handleSwapPositions: (
    groupName: string,
    teamId1: number,
    teamId2: number,
  ) => void;
  handleSave: () => void;
  handleResetPredictions: () => void;
  handleRandomFill: () => void;

  // UI state
  saving: boolean;
  error: string;
  toast: ToastState | null;
  setToast: (t: ToastState | null) => void;
  confirmModal: ConfirmModalState | null;
  setConfirmModal: (m: ConfirmModalState | null) => void;
}

/**
 * Encapsulates the prediction-editing state and handlers.
 *
 * Owns:
 *  - mutation lifecycle (saving / error flags)
 *  - modal & toast UI state
 *  - handleSave / handleReset / handleRandomFill / handlePredictionChange / handleSwapPositions
 *
 * The page component consumes this hook and is left with pure layout.
 */
export function usePredictionEditor(): PredictionEditor {
  const { user: profile, loading: userLoading } = useUser();
  const userId = profile?.id || null;

  // ── Prediction state from shared context ──────────────────────────
  const {
    predictions,
    overrides,
    loading: predictionsLoading,
    updatePrediction,
    updateOverrides,
    setPredictions,
    savePredictions,
  } = useUserPredictions(userId);

  // ── Match & bracket data ──────────────────────────────────────────
  const {
    matches,
    loading: matchesLoading,
    hasLiveMatches,
    liveMatches,
    groups,
  } = useMatches();

  const {
    predictedGroupStandings,
    predictedThirdPlaceQualifying,
    knockoutStages,
  } = usePredictedMatches(userId);

  // ── Lock status ───────────────────────────────────────────────────
  const { stageLockStatus } = useTime();
  const {
    groupStageLocked: groupLocked,
    knockoutStageOpen: knockoutOpen,
    knockoutStageLocked: knockoutLocked,
    daysUntilKnockoutLocks,
  } = stageLockStatus;

  // ── Local UI state ────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(
    null,
  );

  // ── Handlers ──────────────────────────────────────────────────────

  const handlePredictionChange = useCallback(
    (
      fifaMatchId: FifaMatchId,
      homeGoals: number | null,
      awayGoals: number | null,
      penaltyWinner?: "HOME" | "AWAY" | null,
    ) => {
      const existing = predictions.get(fifaMatchId);
      updatePrediction({
        match_id: fifaMatchId,
        home_goals: homeGoals,
        away_goals: awayGoals,
        penalty_winner: penaltyWinner ?? existing?.penalty_winner ?? null,
      });
    },
    [predictions, updatePrediction],
  );

  const handleSwapPositions = useCallback(
    (groupName: string, teamId1: number, teamId2: number) => {
      const standings = predictedGroupStandings.get(groupName) ?? [];
      const team1Standing = standings.find((s) => s.team.id === teamId1);
      const team2Standing = standings.find((s) => s.team.id === teamId2);
      if (!team1Standing || !team2Standing) return;

      const newOverrides = overrides.filter(
        (o) =>
          !(
            o.group_name === groupName &&
            (o.team_id === teamId1 || o.team_id === teamId2)
          ),
      );

      newOverrides.push({
        group_name: groupName,
        team_id: teamId1,
        position: team2Standing.position,
      });
      newOverrides.push({
        group_name: groupName,
        team_id: teamId2,
        position: team1Standing.position,
      });

      updateOverrides(newOverrides);
    },
    [predictedGroupStandings, overrides, updateOverrides],
  );

  const doSave = useCallback(async () => {
    setSaving(true);
    setError("");

    const result = await savePredictions();

    if (result.success) {
      setToast({ message: "Predictions saved!", type: "success" });
    } else {
      setError(result.error || "Failed to save predictions");
    }

    setSaving(false);
  }, [savePredictions]);

  const handleSave = useCallback(() => {
    if (!profile) return;

    const warnings: string[] = [];

    // Count unfilled group predictions
    if (!groupLocked) {
      const groupMatches = matches.filter((m) => m.stage === "GROUP_STAGE");
      const unfilledGroup = groupMatches.filter((m) => {
        const pred = predictions.get(m.id);
        return !pred || pred.home_goals === null || pred.away_goals === null;
      });
      if (unfilledGroup.length > 0) {
        warnings.push(
          `${unfilledGroup.length} of ${groupMatches.length} group matches are missing predictions`,
        );
      }
    }

    // Count unfilled knockout predictions and ties without winner
    if (knockoutOpen && !knockoutLocked) {
      const koMatches = matches.filter((m) => m.stage !== "GROUP_STAGE");
      const unfilledKo = koMatches.filter((m) => {
        const pred = predictions.get(m.id);
        return !pred || pred.home_goals === null || pred.away_goals === null;
      });
      if (unfilledKo.length > 0) {
        warnings.push(
          `${unfilledKo.length} of ${koMatches.length} knockout matches are missing predictions`,
        );
      }

      const tiesWithoutWinner = koMatches.filter((m) => {
        const pred = predictions.get(m.id);
        if (!pred || pred.home_goals === null || pred.away_goals === null)
          return false;
        return pred.home_goals === pred.away_goals && !pred.penalty_winner;
      });
      if (tiesWithoutWinner.length > 0) {
        warnings.push(
          `${tiesWithoutWinner.length} knockout match${tiesWithoutWinner.length > 1 ? "es have" : " has"} a tie without a penalty winner selected`,
        );
      }
    }

    if (warnings.length > 0) {
      setConfirmModal({
        title: "Incomplete Predictions",
        message: warnings.join(". ") + ". Save anyway?",
        confirmLabel: "Save Anyway",
        variant: "default",
        onConfirm: () => {
          setConfirmModal(null);
          doSave();
        },
      });
      return;
    }

    doSave();
  }, [
    profile,
    groupLocked,
    knockoutOpen,
    knockoutLocked,
    matches,
    predictions,
    doSave,
  ]);

  const doReset = useCallback(() => {
    const newPredictions = new Map(predictions);
    matches.forEach((match) => {
      const fifaNumber = match.id;
      const isGroupStage = match.stage === "GROUP_STAGE";
      if (isGroupStage && !groupLocked) {
        newPredictions.delete(fifaNumber);
      }
      if (!isGroupStage && knockoutOpen && !knockoutLocked) {
        newPredictions.delete(fifaNumber);
      }
    });
    setPredictions(newPredictions);

    if (!groupLocked) {
      updateOverrides([]);
    }
  }, [
    predictions,
    matches,
    groupLocked,
    knockoutOpen,
    knockoutLocked,
    setPredictions,
    updateOverrides,
  ]);

  const handleResetPredictions = useCallback(() => {
    setConfirmModal({
      title: "Reset Predictions",
      message:
        "Are you sure you want to reset predictions? This will clear scores for unlocked sections.",
      confirmLabel: "Reset",
      variant: "danger",
      onConfirm: () => {
        setConfirmModal(null);
        doReset();
      },
    });
  }, [doReset]);

  const doRandomFill = useCallback(() => {
    const newPredictions = new Map(predictions);

    matches.forEach((match) => {
      const fifaNumber = match.id;

      const existing = newPredictions.get(fifaNumber);
      if (
        existing &&
        existing.home_goals !== null &&
        existing.away_goals !== null
      ) {
        return;
      }

      const isGroupStage = match.stage === "GROUP_STAGE";
      if (isGroupStage && groupLocked) return;
      if (!isGroupStage && (!knockoutOpen || knockoutLocked)) return;

      const randomScore = () => {
        const r = Math.random();
        if (r < 0.4) return 0;
        if (r < 0.7) return 1;
        if (r < 0.85) return 2;
        if (r < 0.95) return 3;
        return 4;
      };

      const homeGoals = randomScore();
      const awayGoals = randomScore();

      let penaltyWinner: "HOME" | "AWAY" | null = null;
      if (!isGroupStage && homeGoals === awayGoals) {
        penaltyWinner = Math.random() < 0.5 ? "HOME" : "AWAY";
      }

      const updated: LocalPrediction = {
        match_id: fifaNumber,
        home_goals: homeGoals,
        away_goals: awayGoals,
        penalty_winner: penaltyWinner,
      };
      newPredictions.set(fifaNumber, updated);
    });

    setPredictions(newPredictions);
  }, [
    predictions,
    matches,
    groupLocked,
    knockoutOpen,
    knockoutLocked,
    setPredictions,
  ]);

  const handleRandomFill = useCallback(() => {
    setConfirmModal({
      title: "Random Fill",
      message:
        "This will fill all empty prediction slots with random scores. Continue?",
      confirmLabel: "Fill",
      variant: "default",
      onConfirm: () => {
        setConfirmModal(null);
        doRandomFill();
      },
    });
  }, [doRandomFill]);

  return {
    profile,
    userLoading,
    matches,
    matchesLoading,
    hasLiveMatches,
    liveMatches,
    groups,
    predictions,
    predictionsLoading,
    predictedGroupStandings,
    predictedThirdPlaceQualifying,
    knockoutStages,
    groupLocked,
    knockoutOpen,
    knockoutLocked,
    daysUntilKnockoutLocks,
    handlePredictionChange,
    handleSwapPositions,
    handleSave,
    handleResetPredictions,
    handleRandomFill,
    saving,
    error,
    toast,
    setToast,
    confirmModal,
    setConfirmModal,
  };
}
