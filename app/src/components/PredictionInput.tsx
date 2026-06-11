"use client";

import Link from "next/link";
import { FifaMatchId } from "@/types/football";
import { MatchWithLiveInfo } from "@/contexts/MatchContext";
import { LocalPrediction } from "@/types/database";
import {
  CITY_ABBREVIATIONS,
  formatMatchDate,
  formatMatchTime,
  getVenueFromFifaNumber,
  getVenueAbbreviation,
  DateColumn,
  TimeVenueColumn,
  MobileDateColumn,
  TeamCrest,
} from "@/components/match-row";
import MobileScoreDisplay, {
  ActiveField,
} from "@/components/MobileScoreDisplay";
import { ReactNode } from "react";

interface PredictionInputProps {
  match: MatchWithLiveInfo;
  prediction?: LocalPrediction;
  onChange: (
    fifaMatchId: FifaMatchId,
    homeGoals: number | null,
    awayGoals: number | null,
    penaltyWinner?: "HOME" | "AWAY" | null,
  ) => void;
  disabled?: boolean;
  showWinnerSelect?: boolean;
  fifaMatchNumber: FifaMatchId;
  /** Mobile quick-entry: currently active field */
  activeField?: ActiveField | null;
  /** Mobile quick-entry: called when a score field is tapped */
  onFieldTap?: (field: ActiveField) => void;
  /** When true, wraps the match row in a Link to /match/{id} */
  linkToMatch?: boolean;
}

function MatchContentLink({ children, className, matchId }: { children: ReactNode; className: string; matchId: number }) {
  return <Link href={`/match/${matchId}`} className={className}>{children}</Link>;
}

function MatchContentDiv({ children, className }: { children: ReactNode; className: string; matchId?: number }) {
  return <div className={className}>{children}</div>;
}

export default function PredictionInput({
  match,
  prediction,
  onChange,
  disabled = false,
  showWinnerSelect = false,
  fifaMatchNumber,
  activeField,
  onFieldTap,
  linkToMatch = false,
}: PredictionInputProps) {
  const homeTeam = match.homeTeam;
  const awayTeam = match.awayTeam;

  const homeGoals = prediction?.home_goals ?? null;
  const awayGoals = prediction?.away_goals ?? null;
  const penaltyWinner = prediction?.penalty_winner ?? null;

  const handleHomeChange = (value: string) => {
    const goals = value === "" ? null : parseInt(value, 10);
    if (goals !== null && (isNaN(goals) || goals < 0 || goals > 20)) return;
    onChange(fifaMatchNumber, goals, awayGoals, penaltyWinner);
  };

  const handleAwayChange = (value: string) => {
    const goals = value === "" ? null : parseInt(value, 10);
    if (goals !== null && (isNaN(goals) || goals < 0 || goals > 20)) return;
    onChange(fifaMatchNumber, homeGoals, goals, penaltyWinner);
  };

  const handleWinnerChange = (teamId: number) => {
    const side = teamId === homeTeam?.id ? "HOME" : "AWAY";
    onChange(fifaMatchNumber, homeGoals, awayGoals, side);
  };

  const hasScore = homeGoals !== null && awayGoals !== null;
  const isTie = hasScore && homeGoals === awayGoals;
  const needsWinnerSelect = showWinnerSelect && isTie;

  // Group stage logic: highlight winner, or both on draw
  const isGroupStage = !showWinnerSelect;
  const groupHomeWins = isGroupStage && hasScore && homeGoals > awayGoals;
  const groupAwayWins = isGroupStage && hasScore && awayGoals > homeGoals;
  const groupIsDraw = isGroupStage && hasScore && homeGoals === awayGoals;

  // Determine score-based winner for non-tie knockout matches
  const homeWinsOnScore =
    showWinnerSelect &&
    homeGoals !== null &&
    awayGoals !== null &&
    homeGoals > awayGoals;
  const awayWinsOnScore =
    showWinnerSelect &&
    homeGoals !== null &&
    awayGoals !== null &&
    awayGoals > homeGoals;

  // Determine if each team is the selected winner (for ties) or score-based winner (for non-ties)
  // For group stage: winner highlighted, or BOTH teams on a draw
  const homeIsWinner =
    (needsWinnerSelect && penaltyWinner === "HOME") ||
    homeWinsOnScore ||
    groupHomeWins ||
    groupIsDraw;
  const awayIsWinner =
    (needsWinnerSelect && penaltyWinner === "AWAY") ||
    awayWinsOnScore ||
    groupAwayWins ||
    groupIsDraw;

  // Format date and get venue
  const formattedDate = formatMatchDate(match.utcDate);
  const formattedTime = formatMatchTime(match.utcDate);
  const venue = getVenueFromFifaNumber(fifaMatchNumber);

  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";

  const ContentWrapper = linkToMatch ? MatchContentLink : MatchContentDiv;

  return (
    <ContentWrapper
      matchId={match.id}
      className={`block py-1.5 px-2 rounded-lg transition-colors ${
        disabled
          ? "bg-slate-900/60 opacity-70"
          : "bg-slate-800/60 hover:bg-slate-800/80"
      } ${
        needsWinnerSelect
          ? "border-2 border-amber-400/50"
          : isLive
            ? "border border-red-500/60"
            : "border border-white/10"
      } ${linkToMatch ? "cursor-pointer" : ""}`}
    >
      {/* Mobile Layout - Single row */}
      <div data-match-id={fifaMatchNumber} className="lg:hidden flex items-center gap-1">
        {/* Date+Time+Match# */}
        {isLive ? (
          <div className="w-10 shrink-0 flex items-center justify-center">
            <span className="px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-bold rounded-full live-pulse">
              LIVE
            </span>
          </div>
        ) : (
          <MobileDateColumn
            date={match.utcDate}
            fifaMatchNumber={fifaMatchNumber}
          />
        )}

        {/* Home Team + Score + Away Team */}
        <div
          className="flex-1 flex items-center gap-1 min-w-0"
        >
          {/* Home Team */}
          <div className="flex-1 min-w-0 flex items-center justify-end gap-1.5">
            {needsWinnerSelect ? (
              <button
                type="button"
                onClick={() => homeTeam?.id && handleWinnerChange(homeTeam.id)}
                disabled={disabled || !homeTeam?.id}
                className={`text-xs font-semibold truncate px-0.5 py-0.5 rounded transition-all ${
                  homeIsWinner
                    ? "bg-amber-500/80 text-slate-900"
                    : "text-white hover:bg-white/10"
                } disabled:opacity-50`}
              >
                {homeTeam?.tla || match.homeDisplayName}
              </button>
            ) : (
              <span
                className={`text-xs font-semibold truncate px-0.5 py-0.5 rounded ${homeIsWinner ? "bg-amber-500/80 text-slate-900" : "text-white"}`}
              >
                {homeTeam?.tla || match.homeDisplayName}
              </span>
            )}
            <TeamCrest team={homeTeam} size="sm" />
          </div>

          {/* Score Inputs - mobile: tappable display if onFieldTap available */}
          {onFieldTap ? (
            <MobileScoreDisplay
              homeGoals={homeGoals}
              awayGoals={awayGoals}
              matchId={fifaMatchNumber}
              disabled={disabled}
              activeField={activeField ?? null}
              onTap={onFieldTap}
            />
          ) : (
            <div className="flex items-center gap-0.5 shrink-0">
              <input
                type="number"
                min="0"
                max="20"
                value={homeGoals ?? ""}
                onChange={(e) => handleHomeChange(e.target.value)}
                disabled={disabled}
                className="w-8 h-7 text-center text-sm font-bold bg-white/90 border border-white rounded text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-emerald-500 disabled:bg-white/30 disabled:text-white/50 disabled:border-white/20"
                placeholder="-"
              />
              <span className="text-white/50 font-bold text-xs">-</span>
              <input
                type="number"
                min="0"
                max="20"
                value={awayGoals ?? ""}
                onChange={(e) => handleAwayChange(e.target.value)}
                disabled={disabled}
                className="w-8 h-7 text-center text-sm font-bold bg-white/90 border border-white rounded text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-emerald-500 disabled:bg-white/30 disabled:text-white/50 disabled:border-white/20"
                placeholder="-"
              />
            </div>
          )}

          {/* Away Team */}
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            <TeamCrest team={awayTeam} size="sm" />
            {needsWinnerSelect ? (
              <button
                type="button"
                onClick={() => awayTeam?.id && handleWinnerChange(awayTeam.id)}
                disabled={disabled || !awayTeam?.id}
                className={`text-xs font-semibold truncate px-0.5 py-0.5 rounded transition-all ${
                  awayIsWinner
                    ? "bg-amber-500/80 text-slate-900"
                    : "text-white hover:bg-white/10"
                } disabled:opacity-50`}
              >
                {awayTeam?.tla || match.awayDisplayName}
              </button>
            ) : (
              <span
                className={`text-xs font-semibold truncate px-0.5 py-0.5 rounded ${awayIsWinner ? "bg-amber-500/80 text-slate-900" : "text-white"}`}
              >
                {awayTeam?.tla || match.awayDisplayName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Layout - Compact like profile page */}
      <div className="hidden lg:flex items-center gap-2">
        {isLive ? (
          <div className="w-16 shrink-0 flex items-center justify-center">
            <span className="px-2 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full live-pulse">
              LIVE
            </span>
          </div>
        ) : (
          <DateColumn date={match.utcDate} fifaMatchNumber={fifaMatchNumber} />
        )}
        <TimeVenueColumn
          time={match.utcDate}
          fifaMatchNumber={fifaMatchNumber}
        />

        {/* Match section */}
        <div
          className="flex-1 flex items-center justify-center"
        >
          {/* Home Team */}
          <div className="flex items-center justify-end gap-1.5 flex-1 min-w-0">
            {needsWinnerSelect ? (
              <button
                type="button"
                onClick={() => homeTeam?.id && handleWinnerChange(homeTeam.id)}
                disabled={disabled || !homeTeam?.id}
                className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all ${
                  homeIsWinner
                    ? "bg-amber-500/80 text-slate-900 font-bold"
                    : "hover:bg-white/10"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span className="text-xs font-semibold">
                  {homeTeam?.tla || match.homeDisplayName}
                </span>
                <TeamCrest team={homeTeam} />
              </button>
            ) : (
              <div
                className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded ${
                  homeIsWinner ? "bg-amber-500/80" : ""
                }`}
              >
                <span
                  className={`text-xs font-semibold ${
                    homeIsWinner ? "text-slate-900 font-bold" : "text-white"
                  }`}
                >
                  {homeTeam?.tla || match.homeDisplayName}
                </span>
                <TeamCrest team={homeTeam} />
              </div>
            )}
          </div>
          {/* Score Inputs - compact */}
          <div className="flex flex-col items-center mx-2">
            {/* Tie indicator when winner needed but not selected */}
            {needsWinnerSelect && !penaltyWinner && (
              <div className="mb-0.5 px-1 py-0.5 text-[8px] leading-tight text-center rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Pick winner
              </div>
            )}
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="20"
                value={homeGoals ?? ""}
                onChange={(e) => handleHomeChange(e.target.value)}
                disabled={disabled}
                className="w-8 h-7 text-center text-sm font-bold bg-white/90 border border-white rounded text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-400 disabled:bg-white/30 disabled:text-white/50 disabled:border-white/20 transition-all"
                placeholder="-"
              />
              <span className="text-white/50 font-bold text-xs">-</span>
              <input
                type="number"
                min="0"
                max="20"
                value={awayGoals ?? ""}
                onChange={(e) => handleAwayChange(e.target.value)}
                disabled={disabled}
                className="w-8 h-7 text-center text-sm font-bold bg-white/90 border border-white rounded text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-400 disabled:bg-white/30 disabled:text-white/50 disabled:border-white/20 transition-all"
                placeholder="-"
              />
            </div>
          </div>

          {/* Away Team */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {needsWinnerSelect ? (
              <button
                type="button"
                onClick={() => awayTeam?.id && handleWinnerChange(awayTeam.id)}
                disabled={disabled || !awayTeam?.id}
                className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all ${
                  awayIsWinner
                    ? "bg-amber-500/80 text-slate-900 font-bold"
                    : "hover:bg-white/10"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <TeamCrest team={awayTeam} />
                <span className="text-xs font-semibold">
                  {awayTeam?.tla || match.awayDisplayName}
                </span>
              </button>
            ) : (
              <div
                className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded ${
                  awayIsWinner ? "bg-amber-500/80" : ""
                }`}
              >
                <TeamCrest team={awayTeam} />
                <span
                  className={`text-xs font-semibold ${
                    awayIsWinner ? "text-slate-900 font-bold" : "text-white"
                  }`}
                >
                  {awayTeam?.tla || match.awayDisplayName}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </ContentWrapper>
  );
}
