"use client";

import { useSimulation } from "@/contexts/SimulationContext";
import { Match, Team } from "@/types/football";
import { Prediction } from "@/types/database";
import PredictionInput from "@/components/PredictionInput";
import FixtureRow from "@/components/FixtureRow";

interface ResolvedTeams {
  home: Team | null;
  away: Team | null;
}

interface KnockoutStageSectionProps {
  knockoutStages: Map<string, Match[]>;
  predictions?: Map<number, Prediction>;
  resolvedKnockoutTeams?: Map<number, ResolvedTeams>;
  apiToFifaMap: Map<number, number>;
  knockoutLocked?: boolean;
  onPredictionChange?: (
    matchId: number,
    homeGoals: number | null,
    awayGoals: number | null,
    winnerId?: number | null,
  ) => void;
  /** Read-only mode: shows FixtureRow instead of PredictionInput */
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
  readOnly = false,
}: KnockoutStageSectionProps) {
  const { getCurrentTime } = useSimulation();

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
        {!readOnly && knockoutLocked && (
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

                  if (readOnly) {
                    return (
                      <FixtureRow
                        key={match.id}
                        match={match}
                        fifaMatchNumber={fifaNumber}
                      />
                    );
                  }

                  const resolved = resolvedKnockoutTeams?.get(match.id);
                  const matchHasStarted =
                    getCurrentTime() >= new Date(match.utcDate);
                  return (
                    <PredictionInput
                      key={match.id}
                      match={match}
                      prediction={predictions?.get(match.id)}
                      onChange={onPredictionChange!}
                      disabled={knockoutLocked || matchHasStarted}
                      showWinnerSelect={true}
                      resolvedHomeTeam={resolved?.home ?? undefined}
                      resolvedAwayTeam={resolved?.away ?? undefined}
                      fifaMatchNumber={fifaNumber}
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
