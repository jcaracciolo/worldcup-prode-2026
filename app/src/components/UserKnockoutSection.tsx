"use client";

import Link from "next/link";
import {
  Match,
  Team,
  CalculatedStanding,
  FifaMatchId,
  asFifaMatchId,
} from "@/types/football";
import { LocalPrediction } from "@/types/database";
import { getTeamDisplaySimple, shortLabel } from "@/lib/team-display";
import { getMatchInfo, Venue } from "@/lib/tournament";
import { BracketResolver, ResolvedTeams } from "@/lib/bracket-resolver";
import MatchPointsTooltip from "@/components/MatchPointsTooltip";
import LockedCard from "@/components/LockedCard";
import { useMemo } from "react";

interface UserKnockoutSectionProps {
  matches: Match[];
  predictions: LocalPrediction[];
  groupStandings: Map<string, CalculatedStanding[]>;
  thirdPlaceQualifying: Map<string, boolean>;
  knockoutOpen: boolean;
  knockoutLocked: boolean;
  showPredictions: boolean;
  // Optional: pass actual standings to only show teams when groups are complete
  actualGroupStandings?: Map<string, CalculatedStanding[]>;
  actualThirdPlaceQualifying?: Map<string, boolean>;
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
  actualGroupStandings,
  actualThirdPlaceQualifying,
}: UserKnockoutSectionProps) {
  // Predictions from DB have match_id as number, but they ARE FIFA match IDs
  const predictionMap = useMemo(
    () =>
      new Map<FifaMatchId, LocalPrediction>(
        predictions.map((p) => [p.match_id as FifaMatchId, p]),
      ),
    [predictions],
  );

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
    const fifaNum = asFifaMatchId(match.id);
    const matchInfo = getMatchInfo(fifaNum);
    return matchInfo?.venue || null;
  };

  const knockoutMatches = matches.filter((m) => m.stage !== "GROUP_STAGE");

  // Knockout not open yet - show locked message
  if (!knockoutOpen) {
    return (
      <section className="mb-8">
        <LockedCard message="Knockout predictions will be available after group stage locks" />
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
        <LockedCard message="Predictions will be visible after knockout stage locks" />
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
                  {stageMatches.map((match) => {
                    const fifaNumber = asFifaMatchId(match.id);
                    return (
                      <KnockoutMatchRow
                        key={match.id}
                        match={match}
                        prediction={predictionMap.get(fifaNumber)}
                        resolvedTeams={resolvedKnockoutTeams.get(fifaNumber)}
                        venue={getMatchVenue(match)}
                        fifaMatchNumber={fifaNumber}
                      />
                    );
                  })}
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
  prediction: LocalPrediction | undefined;
  resolvedTeams: ResolvedTeams | undefined;
  venue: Venue | null;
  fifaMatchNumber?: FifaMatchId;
}

function KnockoutMatchRow({
  match,
  prediction,
  resolvedTeams,
  venue,
  fifaMatchNumber,
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

  const isLive =
    match.status === "IN_PLAY" || match.status === "PAUSED";

  return (
    <div className={`flex items-center py-3 px-3 rounded-xl bg-slate-800/60 overflow-visible relative ${isLive ? "border border-red-500/60" : "border border-white/5"}`}>
      <Link
        href={`/match/${match.id}`}
        className="flex-1 flex items-center hover:bg-slate-800/80 transition-colors cursor-pointer rounded-lg -m-2 p-2 min-w-0"
      >
        {/* Date or LIVE badge */}
        <div className="w-16 text-center shrink-0 pr-2 border-r border-white/10">
          {isLive ? (
            <span className="px-2 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full live-pulse">
              LIVE
            </span>
          ) : (
            <div
              className="text-xs uppercase font-bold tracking-wide whitespace-nowrap"
              style={{ color: "var(--date-color)" }}
            >
              {formattedDate}
            </div>
          )}
        </div>

        {/* Time & Venue */}
        <div className="w-20 shrink-0 px-2 border-r border-white/10">
          <div className="text-xs text-white/70 font-medium">
            {formattedTime}
          </div>
          {venue && (
            <div
              className="text-xs font-semibold truncate"
              style={{ color: "var(--venue-color)" }}
            >
              {venue.city}
            </div>
          )}
        </div>

        {/* Match */}
        <div className="flex-1 flex items-center justify-center pl-2 min-w-0">
          {/* Home Team */}
          <div
            className={`flex items-center justify-end gap-1.5 px-1.5 py-1 rounded-lg min-w-0 ${
              homeHighlight ? "bg-amber-500/80 text-slate-900" : ""
            }`}
          >
            <span
              className={`text-xs font-semibold truncate ${
                homeHighlight ? "text-slate-900" : "text-white"
              }`}
            >
              {
                getTeamDisplaySimple(
                  homeTeam,
                  match.id,
                  "home",
                  fifaMatchNumber,
                ).label
              }
            </span>
            {homeTeam?.crest ? (
              <img
                src={homeTeam.crest}
                alt={
                  getTeamDisplaySimple(
                    homeTeam,
                    match.id,
                    "home",
                    fifaMatchNumber,
                  ).label
                }
                className="w-6 h-6 object-contain shrink-0"
              />
            ) : (
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-[9px] font-bold text-white/60 shrink-0">
                {shortLabel(
                  getTeamDisplaySimple(
                    homeTeam,
                    match.id,
                    "home",
                    fifaMatchNumber,
                  ).label,
                )}
              </div>
            )}
          </div>

          {/* Score */}
          <div className="flex items-center gap-1.5 mx-2 shrink-0">
            <span className="w-8 h-7 flex items-center justify-center text-sm font-bold bg-white/90 rounded-lg text-slate-800">
              {prediction?.home_goals ?? "-"}
            </span>
            <span className="text-white/50 font-bold text-xs">-</span>
            <span className="w-8 h-7 flex items-center justify-center text-sm font-bold bg-white/90 rounded-lg text-slate-800">
              {prediction?.away_goals ?? "-"}
            </span>
          </div>

          {/* Away Team */}
          <div
            className={`flex items-center gap-1.5 px-1.5 py-1 rounded-lg min-w-0 ${
              awayHighlight ? "bg-amber-500/80 text-slate-900" : ""
            }`}
          >
            {awayTeam?.crest ? (
              <img
                src={awayTeam.crest}
                alt={
                  getTeamDisplaySimple(
                    awayTeam,
                    match.id,
                    "away",
                    fifaMatchNumber,
                  ).label
                }
                className="w-6 h-6 object-contain shrink-0"
              />
            ) : (
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-[9px] font-bold text-white/60 shrink-0">
                {shortLabel(
                  getTeamDisplaySimple(
                    awayTeam,
                    match.id,
                    "away",
                    fifaMatchNumber,
                  ).label,
                )}
              </div>
            )}
            <span
              className={`text-xs font-semibold truncate ${
                awayHighlight ? "text-slate-900" : "text-white"
              }`}
            >
              {
                getTeamDisplaySimple(
                  awayTeam,
                  match.id,
                  "away",
                  fifaMatchNumber,
                ).label
              }
            </span>
          </div>
        </div>
      </Link>

      {/* Points earned - outside Link so tap works */}
      <div className="shrink-0 ml-2">
        <MatchPointsTooltip
          match={match}
          prediction={prediction}
          predictedHomeTeam={homeTeam}
          predictedAwayTeam={awayTeam}
          className="w-10"
        />
      </div>
    </div>
  );
}
