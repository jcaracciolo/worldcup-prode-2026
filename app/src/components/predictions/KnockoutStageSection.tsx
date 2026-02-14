"use client";

import { useTime } from "@/contexts/TimeContext";
import { Match, Team, FifaMatchId } from "@/types/football";
import { LocalPrediction } from "@/types/database";
import FixtureRow from "@/components/FixtureRow";
import MatchPointsTooltip from "@/components/MatchPointsTooltip";
import { KnockoutMatchRow } from "@/components/MatchRowShared";

interface ResolvedTeams {
  home: Team | null;
  away: Team | null;
}

type ViewMode = "edit" | "fixtures" | "predictions";

interface KnockoutStageSectionProps {
  knockoutStages: Map<string, Match[]>;
  predictions?: Map<FifaMatchId, LocalPrediction>; // Keyed by FIFA match number (73-104)
  resolvedKnockoutTeams?: Map<FifaMatchId, ResolvedTeams>; // Keyed by FIFA match number
  apiToFifaMap: Map<number, FifaMatchId>;
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
  resolvedKnockoutTeams,
  apiToFifaMap,
  knockoutLocked = false,
  onPredictionChange,
  mode,
  readOnly = false,
}: KnockoutStageSectionProps) {
  const { getCurrentTime } = useTime();

  // Support legacy readOnly prop
  const viewMode: ViewMode = mode ?? (readOnly ? "fixtures" : "edit");

  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
          <span className="text-xl">⚔️</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Knockout Stage</h2>
          <p className="text-white/50 text-sm">Single elimination rounds</p>
        </div>
      </div>

      <div className="space-y-6">
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
            <div key={stage} className="glass-card p-5">
              <h3 className="font-bold text-lg mb-4 text-white">{stageName}</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {sortedMatches.map((match) => {
                  const fifaNumber = apiToFifaMap.get(match.id);

                  if (viewMode === "fixtures") {
                    return (
                      <FixtureRow
                        key={match.id}
                        match={match}
                        fifaMatchNumber={fifaNumber}
                      />
                    );
                  }

                  if (!fifaNumber) {
                    console.warn(`No FIFA number for match ${match.id}`);
                    return null;
                  }

                  const prediction = predictions?.get(fifaNumber);
                  const resolved = resolvedKnockoutTeams?.get(fifaNumber);

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
