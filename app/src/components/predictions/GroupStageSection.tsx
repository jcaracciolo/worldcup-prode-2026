"use client";

import { useTime } from "@/contexts/TimeContext";
import {
  Match,
  CalculatedStanding,
  FifaMatchId,
  asFifaMatchId,
} from "@/types/football";
import { LocalPrediction } from "@/types/database";
import PredictionInput from "@/components/PredictionInput";
import StandingsTable from "@/components/StandingsTable";

interface GroupStageSectionProps {
  groups: Map<string, Match[]>;
  predictions?: Map<FifaMatchId, LocalPrediction>; // Keyed by FIFA match number (1-72)
  groupLocked?: boolean;
  thirdPlaceQualifying: Map<string, boolean>;
  calculateStandings: (
    groupMatches: Match[],
    groupName?: string,
  ) => CalculatedStanding[];
  onPredictionChange?: (
    fifaMatchId: FifaMatchId,
    homeGoals: number | null,
    awayGoals: number | null,
    winnerId?: number | null,
  ) => void;
  onSwapPositions?: (groupName: string, team1: number, team2: number) => void;
  /** Read-only mode: shows actual match scores using disabled PredictionInput */
  readOnly?: boolean;
}

export default function GroupStageSection({
  groups,
  predictions,
  groupLocked = false,
  thirdPlaceQualifying,
  calculateStandings,
  onPredictionChange,
  onSwapPositions,
  readOnly = false,
}: GroupStageSectionProps) {
  const { getCurrentTime } = useTime();

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 bg-emerald-500/20 rounded-lg flex items-center justify-center">
          <span className="text-sm">🏆</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Group Stage</h2>
          <p className="text-white/50 text-xs">48 teams in 12 groups</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from(groups.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([groupName, groupMatchList]) => {
            const standings = calculateStandings(groupMatchList, groupName);
            const sortedMatches = [...groupMatchList].sort(
              (a, b) =>
                new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
            );

            return (
              <div key={groupName} className="glass-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-sm font-bold rounded-lg">
                    {groupName.replace("GROUP_", "Group ")}
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Matches */}
                  <div>
                    <h4 className="text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">
                      Matches
                    </h4>
                    <div className="space-y-0.5">
                      {sortedMatches.map((match) => {
                        const fifaNumber = asFifaMatchId(match.id);

                        if (readOnly) {
                          // Show actual match scores using PredictionInput in disabled mode
                          const syntheticPrediction: LocalPrediction = {
                            match_id: fifaNumber,
                            home_goals: match.score.fullTime.home,
                            away_goals: match.score.fullTime.away,
                            winner_id: null,
                          };
                          return (
                            <PredictionInput
                              key={match.id}
                              match={match}
                              prediction={syntheticPrediction}
                              onChange={() => {}}
                              disabled={true}
                              fifaMatchNumber={fifaNumber}
                            />
                          );
                        }

                        const matchHasStarted =
                          getCurrentTime() >= new Date(match.utcDate);
                        return (
                          <PredictionInput
                            key={match.id}
                            match={match}
                            prediction={predictions?.get(fifaNumber)}
                            onChange={onPredictionChange!}
                            disabled={groupLocked || matchHasStarted}
                            fifaMatchNumber={fifaNumber}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Standings Table */}
                  {standings.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">
                        Standings
                        {!readOnly && !groupLocked && (
                          <span className="text-white/30 text-[10px] ml-2">
                            (↕ swap tied teams)
                          </span>
                        )}
                      </h4>
                      <StandingsTable
                        standings={standings}
                        disabled={readOnly || groupLocked}
                        onSwapPositions={
                          readOnly || !onSwapPositions
                            ? undefined
                            : (team1, team2) =>
                                onSwapPositions(groupName, team1, team2)
                        }
                        thirdPlaceQualifies={
                          thirdPlaceQualifying.get(groupName) || false
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}
