"use client";

import { useTime } from "@/contexts/TimeContext";
import { useKnockoutTeams } from "@/contexts/MatchContext";
import { Match, FifaMatchId, asFifaMatchId } from "@/types/football";
import { LocalPrediction } from "@/types/database";
import MatchPointsTooltip from "@/components/MatchPointsTooltip";
import { KnockoutMatchRow } from "@/components/MatchRowShared";

type ViewMode = "edit" | "fixtures" | "predictions";

interface KnockoutStageSectionProps {
  knockoutStages: Map<string, Match[]>;
  predictions?: Map<FifaMatchId, LocalPrediction>; // Keyed by FIFA match number (73-104)
  knockoutLocked?: boolean;
  onPredictionChange?: (
    fifaMatchId: FifaMatchId,
    homeGoals: number | null,
    awayGoals: number | null,
    winnerId?: number | null,
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
}

function getKnockoutStageName(stage: string): string {
  const names: Record<string, string> = {
    LAST_32: "Round of 32",
    LAST_16: "Round of 16",
    QUARTER_FINALS: "Quarter Finals",
    SEMI_FINALS: "Semi Finals",
    THIRD_PLACE: "Third Place",
    FINAL: "Final",
  };
  return names[stage] || stage;
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
  onPredictionChange,
  mode,
  readOnly = false,
}: KnockoutStageSectionProps) {
  const { getCurrentTime } = useTime();

  // Get resolved teams: with predictions → what-if teams, without → actual teams from context
  const resolvedKnockoutTeams = useKnockoutTeams(predictions);

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

          const stageName = getKnockoutStageName(stage);
          const sortedMatches = [...stageMatches].sort(
            (a, b) =>
              new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
          );

          return (
            <div key={stage} className="glass-card p-3">
              <h3 className="font-bold text-sm mb-2 text-white">{stageName}</h3>
              <div className="grid md:grid-cols-2 gap-1.5">
                {sortedMatches.map((match) => {
                  const fifaNumber = asFifaMatchId(match.id);

                  if (viewMode === "fixtures") {
                    return (
                      <KnockoutMatchRow
                        key={match.id}
                        match={match}
                        resolvedTeams={resolvedKnockoutTeams.get(fifaNumber)}
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
                  const resolved = resolvedKnockoutTeams.get(fifaNumber);

                  if (viewMode === "predictions") {
                    // Read-only predictions with points tooltip
                    return (
                      <KnockoutMatchRow
                        key={match.id}
                        match={match}
                        prediction={prediction}
                        resolvedTeams={resolved}
                        fifaMatchNumber={fifaNumber}
                        mode="readonly"
                        pointsTooltip={
                          <MatchPointsTooltip
                            match={match}
                            prediction={prediction}
                            predictedHomeTeam={resolved?.home ?? null}
                            predictedAwayTeam={resolved?.away ?? null}
                          />
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
                      resolvedTeams={resolved}
                      fifaMatchNumber={fifaNumber}
                      mode="edit"
                      onChange={onPredictionChange}
                      disabled={knockoutLocked || matchHasStarted}
                      showWinnerSelect={true}
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
