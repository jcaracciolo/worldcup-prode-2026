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
import { ThirdPlaceTeam } from "@/lib/third-place-ranking";
import { validatePredictions } from "@/lib/prediction-validation";
import { randomFillPredictions } from "@/lib/random-predictions";

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
  rankedThirdPlaceTeams: ThirdPlaceTeam[];
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
  handleSwapThirdPlacePositions: (group1: string, group2: string) => void;
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
    thirdPlaceOverrides,
    loading: predictionsLoading,
    updatePrediction,
    updateOverrides,
    updateThirdPlaceOverrides,
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
    rankedThirdPlaceTeams,
    knockoutStages,
  } = usePredictedMatches(userId);

  // ── Lock status ───────────────────────────────────────────────────
  const { stageLockStatus, isKnockoutMatchLocked } = useTime();
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

  const handleSwapThirdPlacePositions = useCallback(
    (group1: string, group2: string) => {
      const team1 = rankedThirdPlaceTeams.find((t) => t.group === group1);
      const team2 = rankedThirdPlaceTeams.find((t) => t.group === group2);
      if (!team1 || !team2) return;

      // Remove existing overrides for both groups
      const newOverrides = thirdPlaceOverrides.filter(
        (o) => o.group_name !== group1 && o.group_name !== group2,
      );

      // Swap their ranks
      newOverrides.push({ group_name: group1, rank: team2.rank });
      newOverrides.push({ group_name: group2, rank: team1.rank });

      updateThirdPlaceOverrides(newOverrides);
    },
    [rankedThirdPlaceTeams, thirdPlaceOverrides, updateThirdPlaceOverrides],
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

    const warnings = validatePredictions(matches, predictions, {
      groupLocked,
      knockoutOpen,
      knockoutLocked,
      isKnockoutMatchLocked,
    });

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
      // Only clear knockout matches that are still editable — never wipe a
      // match that has individually locked (kicked off) before the deadline.
      if (
        !isGroupStage &&
        knockoutOpen &&
        !knockoutLocked &&
        !isKnockoutMatchLocked(match.utcDate)
      ) {
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
    isKnockoutMatchLocked,
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
    const newPredictions = randomFillPredictions(matches, predictions, {
      groupLocked,
      knockoutOpen,
      knockoutLocked,
      isKnockoutMatchLocked,
    });
    setPredictions(newPredictions);
  }, [
    predictions,
    matches,
    groupLocked,
    knockoutOpen,
    knockoutLocked,
    isKnockoutMatchLocked,
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
    rankedThirdPlaceTeams,
    knockoutStages,
    groupLocked,
    knockoutOpen,
    knockoutLocked,
    daysUntilKnockoutLocks,
    handlePredictionChange,
    handleSwapPositions,
    handleSwapThirdPlacePositions,
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
