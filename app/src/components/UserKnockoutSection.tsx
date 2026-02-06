"use client";

import { Match, Team, CalculatedStanding } from "@/types/football";
import { Prediction } from "@/types/database";
import { getTeamDisplayName } from "@/lib/scoring";
import { getMatchInfo, Venue } from "@/lib/tournament";
import { buildApiToFifaMapping } from "@/lib/api-client";
import { BracketResolver, ResolvedTeams } from "@/lib/bracket-resolver";
import MatchPointsTooltip from "@/components/MatchPointsTooltip";
import R32Preview from "@/components/R32Preview";
import { useMemo } from "react";

interface UserKnockoutSectionProps {
  matches: Match[];
  predictions: Prediction[];
  groupStandings: Map<string, CalculatedStanding[]>;
  thirdPlaceQualifying: Map<string, boolean>;
  knockoutOpen: boolean;
  knockoutLocked: boolean;
  showPredictions: boolean;
}

const KNOCKOUT_STAGES = [
  { stage: "LAST_32", name: "Round of 32" },
  { stage: "LAST_16", name: "Round of 16" },
  { stage: "QUARTER_FINALS", name: "Quarter-Finals" },
  { stage: "SEMI_FINALS", name: "Semi-Finals" },
  { stage: "THIRD_PLACE", name: "Third Place" },
  { stage: "FINAL", name: "Final" },
];

export default function UserKnockoutSection({
  matches,
  predictions,
  groupStandings,
  thirdPlaceQualifying,
  knockoutOpen,
  knockoutLocked,
  showPredictions,
}: UserKnockoutSectionProps) {
  const predictionMap = useMemo(
    () => new Map(predictions.map((p) => [p.match_id, p])),
    [predictions],
  );

  const apiToFifaMap = useMemo(() => buildApiToFifaMapping(matches), [matches]);

  // Resolve knockout teams based on predictions
  const resolvedKnockoutTeams = useMemo(() => {
    const resolver = new BracketResolver({
      matches,
      predictions: predictionMap,
      groupStandings,
      thirdPlaceQualifying,
    });
    return resolver.resolve();
  }, [matches, predictionMap, groupStandings, thirdPlaceQualifying]);

  const getMatchVenue = (match: Match): Venue | null => {
    const fifaNum = apiToFifaMap.get(match.id);
    if (fifaNum) {
      const matchInfo = getMatchInfo(fifaNum);
      return matchInfo?.venue || null;
    }
    return null;
  };

  const knockoutMatches = matches.filter((m) => m.stage !== "GROUP_STAGE");

  // Knockout not open yet - show R32 preview + blurred placeholder
  if (!knockoutOpen) {
    return (
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4 border-b border-white/10 pb-2 text-white">
          Knockout Stage
        </h2>
        <div className="space-y-6">
          <R32Preview
            matches={matches.filter((m) => m.stage === "LAST_32")}
            groupStandings={groupStandings}
            thirdPlaceQualifying={thirdPlaceQualifying}
          />

          {/* Blurred rest of knockout */}
          <div className="relative">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-10 rounded-xl flex items-center justify-center">
              <div className="text-center">
                <div className="text-5xl mb-4">🔒</div>
                <p className="text-white/60 text-lg">
                  Coming soon after group stage
                </p>
              </div>
            </div>
            <div className="space-y-6 opacity-50">
              {["LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"].map(
                (stage) => {
                  const stageName = {
                    LAST_16: "Round of 16",
                    QUARTER_FINALS: "Quarter-Finals",
                    SEMI_FINALS: "Semi-Finals",
                    FINAL: "Final",
                  }[stage];
                  return (
                    <div key={stage} className="glass-card p-5">
                      <h3 className="font-bold text-lg mb-4 text-white">
                        {stageName}
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4 h-20">
                        {/* Placeholder boxes */}
                        <div className="bg-white/5 rounded-lg h-12"></div>
                        <div className="bg-white/5 rounded-lg h-12"></div>
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Knockout open but predictions hidden
  if (!showPredictions) {
    return (
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4 border-b border-white/10 pb-2 text-white">
          Knockout Stage
        </h2>
        <div className="glass-card p-8 text-center blur-sm select-none">
          <p className="text-white/50">
            Predictions will be visible after knockout stage starts
          </p>
        </div>
      </section>
    );
  }

  // Full knockout display
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold mb-4 border-b border-white/10 pb-2 text-white">
        Knockout Stage
      </h2>

      {knockoutMatches.length === 0 ? (
        <div className="text-white/50 text-center py-8">
          No knockout matches available yet
        </div>
      ) : (
        <div className="space-y-6">
          {KNOCKOUT_STAGES.map(({ stage, name }) => {
            const stageMatches = knockoutMatches
              .filter((m) => m.stage === stage)
              .sort(
                (a, b) =>
                  new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
              );

            if (stageMatches.length === 0) return null;

            return (
              <div key={stage} className="glass-card p-4">
                <h3 className="font-bold text-lg mb-3 text-white">{name}</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {stageMatches.map((match) => (
                    <KnockoutMatchRow
                      key={match.id}
                      match={match}
                      prediction={predictionMap.get(match.id)}
                      resolvedTeams={resolvedKnockoutTeams.get(match.id)}
                      venue={getMatchVenue(match)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

interface KnockoutMatchRowProps {
  match: Match;
  prediction: Prediction | undefined;
  resolvedTeams: ResolvedTeams | undefined;
  venue: Venue | null;
}

function KnockoutMatchRow({
  match,
  prediction,
  resolvedTeams,
  venue,
}: KnockoutMatchRowProps) {
  const homeTeam =
    resolvedTeams?.home || (match.homeTeam?.id ? match.homeTeam : null);
  const awayTeam =
    resolvedTeams?.away || (match.awayTeam?.id ? match.awayTeam : null);

  const matchDate = new Date(match.utcDate);
  const formattedDate = matchDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const formattedTime = matchDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  // Calculate highlights
  const hasScore =
    prediction?.home_goals !== null &&
    prediction?.home_goals !== undefined &&
    prediction?.away_goals !== null &&
    prediction?.away_goals !== undefined;
  const homeWins =
    hasScore && prediction!.home_goals! > prediction!.away_goals!;
  const awayWins =
    hasScore && prediction!.away_goals! > prediction!.home_goals!;
  const isTie = hasScore && prediction!.home_goals === prediction!.away_goals;

  const homeHighlight =
    homeWins || (isTie && prediction?.winner_id === homeTeam?.id);
  const awayHighlight =
    awayWins || (isTie && prediction?.winner_id === awayTeam?.id);

  return (
    <div className="flex items-center py-3 px-4 rounded-xl bg-slate-800/60 border border-white/5">
      {/* Date */}
      <div className="w-20 text-center shrink-0 pr-3 border-r border-white/10">
        <div
          className="text-sm uppercase font-bold tracking-wide whitespace-nowrap"
          style={{ color: "var(--date-color)" }}
        >
          {formattedDate}
        </div>
      </div>

      {/* Time & Venue */}
      <div className="w-28 shrink-0 px-3 border-r border-white/10">
        <div className="text-sm text-white/70 font-medium">{formattedTime}</div>
        {venue && (
          <div
            className="text-sm font-semibold truncate"
            style={{ color: "var(--venue-color)" }}
          >
            {venue.city}
          </div>
        )}
      </div>

      {/* Match */}
      <div className="flex-1 flex items-center justify-center pl-4">
        {/* Home Team */}
        <div
          className={`flex items-center justify-end gap-2 px-2 py-1 rounded-lg ${
            homeHighlight ? "bg-amber-500/80 text-slate-900" : ""
          }`}
        >
          <span
            className={`text-sm font-semibold truncate ${
              homeHighlight ? "text-slate-900" : "text-white"
            }`}
          >
            {getTeamDisplayName(homeTeam, match.id, "home")}
          </span>
          {homeTeam?.crest ? (
            <img
              src={homeTeam.crest}
              alt={homeTeam.name}
              className="w-7 h-7 object-contain shrink-0"
            />
          ) : (
            <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-[10px] font-bold text-white/60 shrink-0">
              {homeTeam?.tla?.substring(0, 2) || "?"}
            </div>
          )}
        </div>

        {/* Score */}
        <div className="flex items-center gap-2 mx-4">
          <span className="w-10 h-9 flex items-center justify-center text-lg font-bold bg-white/90 rounded-lg text-slate-800">
            {prediction?.home_goals ?? "-"}
          </span>
          <span className="text-white/50 font-bold">-</span>
          <span className="w-10 h-9 flex items-center justify-center text-lg font-bold bg-white/90 rounded-lg text-slate-800">
            {prediction?.away_goals ?? "-"}
          </span>
        </div>

        {/* Away Team */}
        <div
          className={`flex items-center gap-2 px-2 py-1 rounded-lg ${
            awayHighlight ? "bg-amber-500/80 text-slate-900" : ""
          }`}
        >
          {awayTeam?.crest ? (
            <img
              src={awayTeam.crest}
              alt={awayTeam.name}
              className="w-7 h-7 object-contain shrink-0"
            />
          ) : (
            <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-[10px] font-bold text-white/60 shrink-0">
              {awayTeam?.tla?.substring(0, 2) || "?"}
            </div>
          )}
          <span
            className={`text-sm font-semibold truncate ${
              awayHighlight ? "text-slate-900" : "text-white"
            }`}
          >
            {getTeamDisplayName(awayTeam, match.id, "away")}
          </span>
        </div>
      </div>

      {/* Points earned */}
      <MatchPointsTooltip
        match={match}
        prediction={prediction}
        predictedHomeTeam={homeTeam}
        predictedAwayTeam={awayTeam}
      />
    </div>
  );
}
