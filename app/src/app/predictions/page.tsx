"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GlobalLiveIndicator } from "@/components/MatchStatus";
import LockedCard from "@/components/LockedCard";
import { ConfirmModal } from "@/components/Modal";
import { Toast } from "@/components/Toast";
import {
  KnockoutStageSection,
  GroupStageSection,
} from "@/components/predictions";
import { useScrollToLiveMatch } from "@/hooks/useScrollToLiveMatch";
import { usePredictionEditor } from "@/hooks/usePredictionEditor";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function PredictionsPage() {
  const router = useRouter();

  const {
    // Auth
    profile,
    userLoading,
    // Match data
    matches,
    matchesLoading,
    hasLiveMatches,
    liveMatches,
    groups,
    // Prediction data
    predictions,
    predictionsLoading,
    predictedGroupStandings,
    predictedThirdPlaceQualifying,
    knockoutStages,
    // Lock status
    groupLocked,
    knockoutOpen,
    knockoutLocked,
    daysUntilKnockoutLocks,
    // Editing
    handlePredictionChange,
    handleSwapPositions,
    handleSave,
    handleResetPredictions,
    handleRandomFill,
    // UI state
    saving,
    error,
    toast,
    setToast,
    confirmModal,
    setConfirmModal,
  } = usePredictionEditor();

  const scrollToFirstLiveMatch = useScrollToLiveMatch();

  // Tab state - default to knockout if it's open
  const [activeTab, setActiveTab] = useState<"group" | "knockout">(() =>
    knockoutOpen ? "knockout" : "group",
  );

  // Redirect if not logged in
  useEffect(() => {
    if (!userLoading && !profile) {
      router.push("/login?redirect=/predictions");
    }
  }, [userLoading, profile, router]);

  // Derived loading state
  const loading = userLoading || (predictionsLoading && predictions.size === 0);
  const showMatchesLoading = matchesLoading && matches.length === 0;

  if (loading || showMatchesLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              My Predictions
            </h1>
            <p className="text-white/50 mt-1 text-sm sm:text-base">
              Set your scores for each match
            </p>
            <div className="mt-2">
              <GlobalLiveIndicator
                hasLiveMatches={hasLiveMatches}
                liveCount={liveMatches.length}
                onClick={scrollToFirstLiveMatch}
              />
            </div>
          </div>
          {/* Show buttons only when there's something to edit */}
          {(!groupLocked || (knockoutOpen && !knockoutLocked)) && (
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={handleRandomFill}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base text-white font-semibold rounded-xl transition-all shadow-lg bg-purple-600 hover:bg-purple-700"
              >
                🎲 Random
              </button>
              <button
                onClick={handleResetPredictions}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base text-white font-semibold rounded-xl transition-all shadow-lg bg-red-600 hover:bg-red-700"
              >
                🗑️ Reset
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base text-white font-semibold rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: "var(--qualifying-bg)" }}
              >
                {saving ? "Saving..." : "Save Predictions"}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        {/* Warning banner for knockout predictions deadline */}
        {daysUntilKnockoutLocks !== null && !knockoutLocked && (
          <div className="bg-red-800/70 border border-red-500/30 text-white px-3 py-2.5 rounded-xl mb-6">
            <div className="flex items-center gap-3">
              <span className="text-lg shrink-0">⚠️</span>
              <div>
                <div className="font-semibold text-sm">
                  Knockout predictions lock soon!
                </div>
                <div className="text-red-200/70 text-xs">
                  {daysUntilKnockoutLocks === 0
                    ? "Locking today! You won't be able to complete them after."
                    : daysUntilKnockoutLocks === 1
                      ? "Only 1 day left — you won't be able to complete them after."
                      : `${daysUntilKnockoutLocks} days left — you won't be able to complete them after. Start today!`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Link to see score on profile - shown when buttons are hidden (all editable sections locked) */}
        {groupLocked && (!knockoutOpen || knockoutLocked) && profile && (
          <Link
            href={`/user/${profile.id}`}
            className="block w-full mb-6 px-6 py-4 bg-gradient-to-r from-emerald-600/80 to-green-600/80 hover:from-emerald-500 hover:to-green-500 text-white font-semibold rounded-xl transition-all shadow-lg text-center border border-emerald-400/30"
          >
            <span className="text-lg">📊 See your score on your profile →</span>
          </Link>
        )}

        {groupLocked &&
          !(daysUntilKnockoutLocks !== null && !knockoutLocked) && (
            <div className="bg-amber-500/20 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-xl mb-6">
              Group stage predictions are locked
            </div>
          )}

        {/* Stage Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("group")}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
              activeTab === "group"
                ? "bg-emerald-600 text-white"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
          >
            Group Stage
          </button>
          <button
            onClick={() => setActiveTab("knockout")}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
              activeTab === "knockout"
                ? "bg-amber-600 text-white"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
          >
            Knockout Stage
          </button>
        </div>

        {/* Group Stage */}
        {activeTab === "group" && (
          <GroupStageSection
            groups={groups}
            predictions={predictions}
            groupLocked={groupLocked}
            thirdPlaceQualifying={predictedThirdPlaceQualifying}
            groupStandings={predictedGroupStandings}
            onPredictionChange={handlePredictionChange}
            onSwapPositions={handleSwapPositions}
          />
        )}

        {/* Knockout Stage */}
        {activeTab === "knockout" &&
          (knockoutOpen ? (
            <KnockoutStageSection
              knockoutStages={knockoutStages}
              predictions={predictions}
              knockoutLocked={knockoutLocked}
              onPredictionChange={handlePredictionChange}
            />
          ) : (
            <LockedCard message="Knockout predictions will be available after group stage locks" />
          ))}
      </main>

      <footer className="border-t border-white/10 mt-auto">
        <div className="container mx-auto px-4 py-6 text-center">
          <p className="text-white/40 text-sm">
            WorldCupProde - FIFA World Cup 2026 Predictions
          </p>
        </div>
      </footer>

      {/* Confirm modal */}
      <ConfirmModal
        open={!!confirmModal}
        title={confirmModal?.title ?? ""}
        message={confirmModal?.message ?? ""}
        confirmLabel={confirmModal?.confirmLabel}
        variant={confirmModal?.variant}
        onConfirm={() => confirmModal?.onConfirm()}
        onCancel={() => setConfirmModal(null)}
      />

      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
