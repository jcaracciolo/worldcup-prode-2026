"use client";

import { useTime } from "@/contexts/TimeContext";
import { FifaMatchId } from "@/types/football";
import { MatchWithLiveInfo } from "@/contexts/MatchContext";
import { LocalPrediction } from "@/types/database";
import { formatStageName } from "@/lib/format";
import { getBracketLabel } from "@/lib/team-display";
import MatchPointsTooltip from "@/components/MatchPointsTooltip";
import { KnockoutMatchRow } from "@/components/match-row";
import { ActiveField } from "@/components/MobileScoreDisplay";

type ViewMode = "edit" | "fixtures" | "predictions";

interface KnockoutStageSectionProps {
  knockoutStages: Map<string, MatchWithLiveInfo[]>;
  predictions?: Map<FifaMatchId, LocalPrediction>; // Keyed by FIFA match number (73-104)
  knockoutLocked?: boolean;
  /** User whose points to display (required for predictions mode) */
  userId?: string;
  onPredictionChange?: (
    fifaMatchId: FifaMatchId,
    homeGoals: number | null,
    awayGoals: number | null,
    penaltyWinner?: "HOME" | "AWAY" | null,
  ) => void;
  /**
   * View mode:
   * - "edit": PredictionInput for editing predictions
   * - "fixtures": FixtureRow showing actual match results
   * - "predictions": Show user predictions with points (read-only)
   */
  mode?: ViewMode;
  /** @deprecated Use mode="fixtures" instead */
  readOnly?: boolean;
  /** Mobile quick-entry: currently active field */
  activeField?: ActiveField | null;
  /** Mobile quick-entry: called when a score field is tapped */
  onFieldTap?: (field: ActiveField) => void;
  /**
   * predictions mode only: per-match visibility predicate. When it returns
   * false for a match, that match's predicted teams and score are masked (used
   * to hide other users' not-yet-locked knockout picks). Defaults to always
   * visible.
   */
  isPredictionVisible?: (match: MatchWithLiveInfo) => boolean;
}

const KNOCKOUT_STAGE_ORDER = [
  "LAST_32",
  "LAST_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "THIRD_PLACE",
  "FINAL",
] as const;

export default function KnockoutStageSection({
  knockoutStages,
  predictions,
  knockoutLocked = false,
  userId,
  onPredictionChange,
  mode,
  readOnly = false,
  activeField,
  onFieldTap,
  isPredictionVisible,
}: KnockoutStageSectionProps) {
  const { getCurrentTime } = useTime();

  // Support legacy readOnly prop
  const viewMode: ViewMode = mode ?? (readOnly ? "fixtures" : "edit");

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 bg-amber-500/20 rounded-lg flex items-center justify-center">
          <span className="text-sm">⚔️</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Knockout Stage</h2>
          <p className="text-white/50 text-xs">Single elimination rounds</p>
        </div>
      </div>

      <div className="space-y-4">
        {viewMode === "edit" && knockoutLocked && (
          <div className="bg-amber-500/20 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-xl">
            Knockout stage predictions are locked
          </div>
        )}

        {KNOCKOUT_STAGE_ORDER.map((stage) => {
          const stageMatches = knockoutStages.get(stage) || [];
          if (stageMatches.length === 0) return null;

          const stageName = formatStageName(stage);
          const sortedMatches = [...stageMatches].sort(
            (a, b) =>
              new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
          );

          return (
            <div key={stage} className="glass-card p-3">
              <h3 className="font-bold text-sm mb-2 text-white">{stageName}</h3>
              <div className="grid md:grid-cols-2 gap-1.5">
                {sortedMatches.map((match) => {
                  const fifaNumber = match.id;

                  if (viewMode === "fixtures") {
                    return (
                      <KnockoutMatchRow
                        key={match.id}
                        match={match}
                        fifaMatchNumber={fifaNumber}
                        mode="readonly"
                        scores={{
                          home: match.score.fullTime.home,
                          away: match.score.fullTime.away,
                        }}
                      />
                    );
                  }

                  const prediction = predictions?.get(fifaNumber);

                  if (viewMode === "predictions") {
                    // Hide other users' not-yet-locked picks: mask the predicted
                    // teams (fall back to generic bracket labels) and the score.
                    const visible = isPredictionVisible
                      ? isPredictionVisible(match)
                      : true;
                    if (!visible) {
                      const maskedMatch = {
                        ...match,
                        homeTeam: null,
                        awayTeam: null,
                        homeDisplayName: getBracketLabel(fifaNumber, "home"),
                        awayDisplayName: getBracketLabel(fifaNumber, "away"),
                      } as unknown as MatchWithLiveInfo;
                      return (
                        <KnockoutMatchRow
                          key={match.id}
                          match={maskedMatch}
                          fifaMatchNumber={fifaNumber}
                          mode="readonly"
                        />
                      );
                    }
                    // Read-only predictions with points tooltip
                    return (
                      <KnockoutMatchRow
                        key={match.id}
                        match={match}
                        prediction={prediction}
                        fifaMatchNumber={fifaNumber}
                        mode="readonly"
                        pointsTooltip={
                          userId ? (
                            <MatchPointsTooltip
                              matchId={fifaNumber}
                              userId={userId}
                              className="w-8 text-right"
                            />
                          ) : undefined
                        }
                      />
                    );
                  }

                  // Edit mode
                  const matchHasStarted =
                    getCurrentTime() >= new Date(match.utcDate);
                  return (
                    <KnockoutMatchRow
                      key={match.id}
                      match={match}
                      prediction={prediction}
                      fifaMatchNumber={fifaNumber}
                      mode="edit"
                      onChange={onPredictionChange}
                      disabled={knockoutLocked || matchHasStarted}
                      showWinnerSelect={true}
                      activeField={activeField}
                      onFieldTap={onFieldTap}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
