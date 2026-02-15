"use client";

import Link from "next/link";
import {
  Match,
  CalculatedStanding,
  PointBreakdown,
  asFifaMatchId,
} from "@/types/football";
import { LocalPrediction } from "@/types/database";
import { calculateStandingsFromPredictions } from "@/lib/standings";
import { getTeamLabel } from "@/lib/scoring";
import { getTeamDisplaySimple } from "@/lib/team-display";
import MatchPointsTooltip from "@/components/MatchPointsTooltip";
import StandingsTable from "@/components/StandingsTable";
import LockedCard from "@/components/LockedCard";
import { useMemo, useState } from "react";

interface UserGroupSectionProps {
  matches: Match[];
  predictions: LocalPrediction[];
  thirdPlaceQualifying: Map<string, boolean>;
  showPredictions: boolean;
  /** Actual standings from real match results (for scoring comparison) */
  actualStandings?: Map<string, CalculatedStanding[]>;
  /** Centralized points breakdown from scoring system */
  breakdown?: PointBreakdown[];
}

export default function UserGroupSection({
  matches,
  predictions,
  thirdPlaceQualifying,
  showPredictions,
  actualStandings,
  breakdown = [],
}: UserGroupSectionProps) {
  // Predictions are keyed by FIFA number
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

  // Group bonus points by group letter (from centralized breakdown)
  const groupBonusPoints = useMemo(() => {
    const map = new Map<string, PointBreakdown[]>();
    breakdown
      .filter((b) => b.type === "group_advance" || b.type === "group_position")
      .forEach((b) => {
        // Extract group letter from description like "Predicted to advance from Group F"
        const match = b.description?.match(/Group ([A-L])/);
        if (match) {
          const groupKey = `GROUP_${match[1]}`;
          if (!map.has(groupKey)) map.set(groupKey, []);
          map.get(groupKey)!.push(b);
        }
      });
    return map;
  }, [breakdown]);

  if (!showPredictions) {
    return (
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4 border-b border-white/10 pb-2 text-white">
          Group Stage
        </h2>
        <LockedCard message="Predictions will be visible after group stage locks" />
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold mb-4 border-b border-white/10 pb-2 text-white">
        Group Stage
      </h2>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from(groups.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([groupName, groupMatchList]) => {
            const standings = calculateStandingsFromPredictions(
              groupMatchList,
              predictionMap,
            );
            // Get actual standings for this group
            const groupActualStandings = actualStandings?.get(groupName) || [];
            // Check if all group matches are finished
            const groupComplete = groupMatchList.every(
              (m) => m.status === "FINISHED",
            );
            // Get bonus points for this group from centralized breakdown
            const bonusPoints = groupBonusPoints.get(groupName) || [];
            return (
              <GroupCard
                key={groupName}
                groupName={groupName}
                matches={groupMatchList}
                standings={standings}
                predictionMap={predictionMap}
                thirdPlaceQualifies={
                  thirdPlaceQualifying.get(groupName) || false
                }
                actualStandings={groupActualStandings}
                bonusPoints={bonusPoints}
                groupComplete={groupComplete}
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
  predictionMap: Map<number, LocalPrediction>;
  thirdPlaceQualifies: boolean;
  actualStandings: CalculatedStanding[];
  bonusPoints: PointBreakdown[];
  groupComplete: boolean;
}

function GroupCard({
  groupName,
  matches,
  standings,
  predictionMap,
  thirdPlaceQualifies,
  actualStandings,
  bonusPoints,
  groupComplete,
}: GroupCardProps) {
  const totalBonusPoints = bonusPoints.reduce((sum, b) => sum + b.points, 0);

  return (
    <div className="glass-card p-4 overflow-visible">
      <h3 className="font-bold text-lg mb-3 text-white">
        {groupName.replace("GROUP_", "Group ")}
      </h3>

      <div className="space-y-4">
        <div className="bg-slate-800/50 rounded-lg p-3 overflow-visible">
          <h4 className="text-sm font-medium text-white/50 mb-2">
            Predictions
          </h4>
          {matches.map((match) => {
            const fifaNumber = asFifaMatchId(match.id);
            return (
              <GroupMatchRow
                key={match.id}
                match={match}
                prediction={predictionMap.get(fifaNumber)}
              />
            );
          })}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-white/50">Standings</h4>
            {groupComplete && (
              <StandingsPointsTooltip
                bonusPoints={bonusPoints}
                totalPoints={totalBonusPoints}
                actualStandings={actualStandings}
                groupName={groupName}
              />
            )}
          </div>
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

interface StandingsPointsTooltipProps {
  bonusPoints: PointBreakdown[];
  totalPoints: number;
  actualStandings: CalculatedStanding[];
  groupName: string;
}

function StandingsPointsTooltip({
  bonusPoints,
  totalPoints,
  actualStandings,
  groupName,
}: StandingsPointsTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (totalPoints === 0 && bonusPoints.length === 0) {
    return null;
  }

  const groupLetter = groupName.replace("GROUP_", "");

  // Build a map of points earned per team (keyed by team ID)
  // bonusPoints contain the team that was predicted - we need to map to actual team IDs
  const teamPointsEarned = new Map<number, number>();
  bonusPoints.forEach((point) => {
    if (point.team) {
      // Find this team in actual standings by TLA or name
      const actualTeam = actualStandings.find(
        (s) =>
          s.team.tla === point.team?.tla || s.team.name === point.team?.name,
      );
      if (actualTeam) {
        const current = teamPointsEarned.get(actualTeam.team.id) || 0;
        teamPointsEarned.set(actualTeam.team.id, current + point.points);
      }
    }
  });

  // Calculate displayed total from what we actually show
  const displayedTotal = Array.from(teamPointsEarned.values()).reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <button
      type="button"
      className="relative text-right"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setShowTooltip((prev) => !prev);
      }}
    >
      <span
        className={`text-xs font-bold cursor-help px-2 py-1 rounded ${
          totalPoints > 0
            ? "bg-purple-500/30 text-purple-300"
            : "bg-white/10 text-white/40"
        }`}
      >
        +{totalPoints}
      </span>

      {/* Tooltip - opens upward */}
      {showTooltip && (
        <>
          {/* Click-away overlay for mobile */}
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setShowTooltip(false);
            }}
          />
          <div className="absolute right-0 bottom-full mb-2 z-[100] w-48 bg-slate-900/95 backdrop-blur-xl rounded-lg border border-white/10 shadow-2xl overflow-hidden">
            {/* Header with column titles */}
            <div className="px-2 py-1.5 border-b border-white/10 flex items-center gap-1 text-[10px]">
              <span className="text-white/80 font-semibold">
                Group {groupLetter}
              </span>
              <span className="flex-1" />
              <span className="text-white/40 w-5 text-right">Pts</span>
              <span className="text-white/40 w-6 text-right">GD</span>
              <span className="w-5" />
            </div>

            {/* Actual standings with points */}
            <div className="px-2 py-1 space-y-0.5">
              {actualStandings.map((actual, index) => {
                const earnedPoints = teamPointsEarned.get(actual.team.id) || 0;
                const gdSign = actual.goalDifference > 0 ? "+" : "";
                const teamLabel = getTeamLabel(actual.team);

                return (
                  <div
                    key={actual.team.id}
                    className="flex items-center text-[11px] py-0.5"
                  >
                    <span className="text-white/40 w-3 shrink-0">
                      {index + 1}
                    </span>
                    <span className="flex items-center gap-1 ml-2">
                      {actual.team.crest ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={actual.team.crest}
                          alt={teamLabel}
                          className="w-3.5 h-3.5 object-contain shrink-0"
                        />
                      ) : (
                        <span className="w-3.5 h-3.5 bg-white/10 rounded-sm flex items-center justify-center text-[6px] text-white/40 shrink-0">
                          ?
                        </span>
                      )}
                      <span className="text-white/80">{teamLabel}</span>
                    </span>
                    <span className="flex-1 min-w-2" />
                    <span className="text-white/50 w-6 text-right shrink-0">
                      {actual.points}
                    </span>
                    <span className="text-white/50 w-7 text-right shrink-0">
                      {gdSign}
                      {actual.goalDifference}
                    </span>
                    <span
                      className={`w-5 text-right font-bold text-[10px] ${
                        earnedPoints > 0 ? "text-emerald-400" : "text-white/20"
                      }`}
                    >
                      {earnedPoints > 0 ? `+${earnedPoints}` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className="px-2 py-1.5 bg-white/5 flex items-center justify-between border-t border-white/10">
              <span className="text-[10px] text-white/50">Total</span>
              <span className="text-[11px] font-bold text-purple-400">
                +{displayedTotal}
              </span>
            </div>
          </div>
        </>
      )}
    </button>
  );
}

export interface GroupMatchRowProps {
  match: Match;
  prediction?: LocalPrediction;
  showPoints?: boolean;
}

export function GroupMatchRow({
  match,
  prediction,
  showPoints = true,
}: GroupMatchRowProps) {
  // Use prediction scores if available, otherwise actual match scores
  const homeGoals = prediction
    ? prediction.home_goals
    : match.score.fullTime.home;
  const awayGoals = prediction
    ? prediction.away_goals
    : match.score.fullTime.away;
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
      <Link
        href={`/match/${match.id}`}
        className="flex-1 flex items-center gap-2 hover:bg-white/5 transition-colors rounded px-1 -mx-1 cursor-pointer"
      >
        <div
          className={`flex-1 flex items-center justify-end gap-1.5 px-1.5 py-0.5 rounded ${homeHighlight ? "bg-amber-500/80" : ""}`}
        >
          <span
            className={
              homeHighlight ? "text-slate-900 font-semibold" : "text-white/80"
            }
          >
            {getTeamDisplaySimple(match.homeTeam, match.id, "home").label}
          </span>
          {match.homeTeam.crest ? (
            <img
              src={match.homeTeam.crest}
              alt={match.homeTeam.name}
              className="w-5 h-5 object-contain shrink-0"
            />
          ) : (
            <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[8px] font-bold text-white/60 shrink-0">
              TBD
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
              TBD
            </div>
          )}
          <span
            className={
              awayHighlight ? "text-slate-900 font-semibold" : "text-white/80"
            }
          >
            {getTeamDisplaySimple(match.awayTeam, match.id, "away").label}
          </span>
        </div>
      </Link>
      {/* Points earned - outside Link so tap works */}
      {showPoints && (
        <MatchPointsTooltip
          match={match}
          prediction={prediction}
          className="w-8"
        />
      )}
    </div>
  );
}
