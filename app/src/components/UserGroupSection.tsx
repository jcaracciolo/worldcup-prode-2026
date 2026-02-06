"use client";

import { Match, CalculatedStanding } from "@/types/football";
import { Prediction } from "@/types/database";
import { calculateStandingsFromPredictions } from "@/lib/standings";
import MatchPointsTooltip from "@/components/MatchPointsTooltip";
import StandingsTable from "@/components/StandingsTable";
import { useMemo } from "react";

interface UserGroupSectionProps {
  matches: Match[];
  predictions: Prediction[];
  thirdPlaceQualifying: Map<string, boolean>;
  showPredictions: boolean;
}

export default function UserGroupSection({
  matches,
  predictions,
  thirdPlaceQualifying,
  showPredictions,
}: UserGroupSectionProps) {
  const predictionMap = useMemo(
    () => new Map(predictions.map((p) => [p.match_id, p])),
    [predictions],
  );

  // Group matches by group name
  const groups = useMemo(() => {
    const map = new Map<string, Match[]>();
    matches
      .filter((m) => m.stage === "GROUP_STAGE")
      .forEach((m) => {
        if (!m.group) return;
        if (!map.has(m.group)) map.set(m.group, []);
        map.get(m.group)!.push(m);
      });
    return map;
  }, [matches]);

  if (!showPredictions) {
    return (
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4 border-b border-white/10 pb-2 text-white">
          Group Stage
        </h2>
        <div className="glass-card p-8 text-center blur-sm select-none">
          <p className="text-white/50">
            Predictions will be visible after group stage starts
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold mb-4 border-b border-white/10 pb-2 text-white">
        Group Stage
      </h2>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from(groups.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([groupName, groupMatchList]) => {
            const standings = calculateStandingsFromPredictions(
              groupMatchList,
              predictionMap,
            );
            return (
              <GroupCard
                key={groupName}
                groupName={groupName}
                matches={groupMatchList}
                standings={standings}
                predictionMap={predictionMap}
                thirdPlaceQualifies={thirdPlaceQualifying.get(groupName) || false}
              />
            );
          })}
      </div>
    </section>
  );
}

interface GroupCardProps {
  groupName: string;
  matches: Match[];
  standings: CalculatedStanding[];
  predictionMap: Map<number, Prediction>;
  thirdPlaceQualifies: boolean;
}

function GroupCard({
  groupName,
  matches,
  standings,
  predictionMap,
  thirdPlaceQualifies,
}: GroupCardProps) {
  return (
    <div className="glass-card p-4">
      <h3 className="font-bold text-lg mb-3 text-white">
        {groupName.replace("GROUP_", "Group ")}
      </h3>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium text-white/50 mb-2">Predictions</h4>
          {matches.map((match) => (
            <GroupMatchRow
              key={match.id}
              match={match}
              prediction={predictionMap.get(match.id)}
            />
          ))}
        </div>

        <div>
          <h4 className="text-sm font-medium text-white/50 mb-2">Standings</h4>
          <StandingsTable
            standings={standings}
            disabled
            thirdPlaceQualifies={thirdPlaceQualifies}
          />
        </div>
      </div>
    </div>
  );
}

interface GroupMatchRowProps {
  match: Match;
  prediction: Prediction | undefined;
}

function GroupMatchRow({ match, prediction }: GroupMatchRowProps) {
  const homeGoals = prediction?.home_goals;
  const awayGoals = prediction?.away_goals;
  const hasScore =
    homeGoals !== null &&
    homeGoals !== undefined &&
    awayGoals !== null &&
    awayGoals !== undefined;
  const homeWins = hasScore && homeGoals > awayGoals;
  const awayWins = hasScore && awayGoals > homeGoals;
  const isDraw = hasScore && homeGoals === awayGoals;
  // For group stage, highlight both teams on draw
  const homeHighlight = homeWins || isDraw;
  const awayHighlight = awayWins || isDraw;

  return (
    <div className="flex items-center gap-2 py-2 text-sm">
      <div
        className={`flex-1 flex items-center justify-end gap-1.5 px-1.5 py-0.5 rounded ${homeHighlight ? "bg-amber-500/80" : ""}`}
      >
        <span
          className={
            homeHighlight ? "text-slate-900 font-semibold" : "text-white/80"
          }
        >
          {match.homeTeam.tla}
        </span>
        {match.homeTeam.crest ? (
          <img
            src={match.homeTeam.crest}
            alt={match.homeTeam.name}
            className="w-5 h-5 object-contain shrink-0"
          />
        ) : (
          <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[8px] font-bold text-white/60 shrink-0">
            {match.homeTeam.tla?.substring(0, 2)}
          </div>
        )}
      </div>
      <span className="w-16 text-center font-bold text-white">
        {prediction?.home_goals ?? "-"} - {prediction?.away_goals ?? "-"}
      </span>
      <div
        className={`flex-1 flex items-center gap-1.5 px-1.5 py-0.5 rounded ${awayHighlight ? "bg-amber-500/80" : ""}`}
      >
        {match.awayTeam.crest ? (
          <img
            src={match.awayTeam.crest}
            alt={match.awayTeam.name}
            className="w-5 h-5 object-contain shrink-0"
          />
        ) : (
          <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[8px] font-bold text-white/60 shrink-0">
            {match.awayTeam.tla?.substring(0, 2)}
          </div>
        )}
        <span
          className={
            awayHighlight ? "text-slate-900 font-semibold" : "text-white/80"
          }
        >
          {match.awayTeam.tla}
        </span>
      </div>
      {/* Points earned */}
      <MatchPointsTooltip match={match} prediction={prediction} className="w-8" />
    </div>
  );
}
