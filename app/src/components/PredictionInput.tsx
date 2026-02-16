"use client";

import { Match, Team, FifaMatchId } from "@/types/football";
import { LocalPrediction } from "@/types/database";
import { getTeamDisplaySimple } from "@/lib/team-display";
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
} from "@/components/MatchRowShared";

interface PredictionInputProps {
  match: Match;
  prediction?: LocalPrediction;
  onChange: (
    fifaMatchId: FifaMatchId,
    homeGoals: number | null,
    awayGoals: number | null,
    winnerId?: number | null,
  ) => void;
  disabled?: boolean;
  showWinnerSelect?: boolean;
  resolvedHomeTeam?: Team | null;
  resolvedAwayTeam?: Team | null;
  fifaMatchNumber: FifaMatchId; // FIFA match number (1-104) - REQUIRED
}

export default function PredictionInput({
  match,
  prediction,
  onChange,
  disabled = false,
  showWinnerSelect = false,
  resolvedHomeTeam,
  resolvedAwayTeam,
  fifaMatchNumber,
}: PredictionInputProps) {
  // Use resolved teams if provided, otherwise fall back to match teams
  const homeTeam = resolvedHomeTeam ?? match.homeTeam;
  const awayTeam = resolvedAwayTeam ?? match.awayTeam;

  const homeGoals = prediction?.home_goals ?? null;
  const awayGoals = prediction?.away_goals ?? null;
  const winnerId = prediction?.winner_id ?? null;

  const handleHomeChange = (value: string) => {
    const goals = value === "" ? null : parseInt(value, 10);
    if (goals !== null && (isNaN(goals) || goals < 0 || goals > 20)) return;
    onChange(fifaMatchNumber, goals, awayGoals, winnerId);
  };

  const handleAwayChange = (value: string) => {
    const goals = value === "" ? null : parseInt(value, 10);
    if (goals !== null && (isNaN(goals) || goals < 0 || goals > 20)) return;
    onChange(fifaMatchNumber, homeGoals, goals, winnerId);
  };

  const handleWinnerChange = (teamId: number) => {
    onChange(fifaMatchNumber, homeGoals, awayGoals, teamId);
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
    (needsWinnerSelect && winnerId === homeTeam?.id) ||
    homeWinsOnScore ||
    groupHomeWins ||
    groupIsDraw;
  const awayIsWinner =
    (needsWinnerSelect && winnerId === awayTeam?.id) ||
    awayWinsOnScore ||
    groupAwayWins ||
    groupIsDraw;

  // Format date and get venue
  const formattedDate = formatMatchDate(match.utcDate);
  const formattedTime = formatMatchTime(match.utcDate);
  const venue = getVenueFromFifaNumber(fifaMatchNumber);

  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";

  return (
    <div
      className={`py-1.5 px-2 rounded-lg transition-colors ${
        disabled
          ? "bg-slate-900/60 opacity-70"
          : "bg-slate-800/60 hover:bg-slate-800/80"
      } ${
        needsWinnerSelect
          ? "border-2 border-amber-400/50"
          : isLive
            ? "border border-red-500/60"
            : "border border-white/10"
      }`}
    >
      {/* Mobile Layout - Single row */}
      <div className="lg:hidden flex items-center gap-1">
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

        {/* Home Team */}
        <div className="flex-1 min-w-0 flex items-center justify-end gap-0.5">
          {needsWinnerSelect ? (
            <button
              type="button"
              onClick={() => homeTeam?.id && handleWinnerChange(homeTeam.id)}
              disabled={disabled || !homeTeam?.id}
              className={`text-[10px] font-semibold truncate px-0.5 py-0.5 rounded transition-all ${
                homeIsWinner
                  ? "bg-amber-500/80 text-slate-900"
                  : "text-white hover:bg-white/10"
              } disabled:opacity-50`}
            >
              {homeTeam?.tla ||
                getTeamDisplaySimple(
                  homeTeam,
                  match.id,
                  "home",
                  fifaMatchNumber,
                ).label}
            </button>
          ) : (
            <span
              className={`text-[10px] font-semibold truncate px-0.5 py-0.5 rounded ${homeIsWinner ? "bg-amber-500/80 text-slate-900" : "text-white"}`}
            >
              {homeTeam?.tla ||
                getTeamDisplaySimple(
                  homeTeam,
                  match.id,
                  "home",
                  fifaMatchNumber,
                ).label}
            </span>
          )}
          <TeamCrest team={homeTeam} size="sm" />
        </div>

        {/* Score Inputs */}
        <div className="flex items-center gap-0.5 shrink-0">
          <input
            type="number"
            min="0"
            max="20"
            value={homeGoals ?? ""}
            onChange={(e) => handleHomeChange(e.target.value)}
            disabled={disabled}
            className="w-7 h-6 text-center text-xs font-bold bg-white/90 border border-white rounded text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-emerald-500 disabled:bg-white/30 disabled:text-white/50 disabled:border-white/20"
            placeholder="-"
          />
          <span className="text-white/50 font-bold text-[10px]">-</span>
          <input
            type="number"
            min="0"
            max="20"
            value={awayGoals ?? ""}
            onChange={(e) => handleAwayChange(e.target.value)}
            disabled={disabled}
            className="w-7 h-6 text-center text-xs font-bold bg-white/90 border border-white rounded text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-emerald-500 disabled:bg-white/30 disabled:text-white/50 disabled:border-white/20"
            placeholder="-"
          />
        </div>

        {/* Away Team */}
        <div className="flex-1 min-w-0 flex items-center gap-0.5">
          <TeamCrest team={awayTeam} size="sm" />
          {needsWinnerSelect ? (
            <button
              type="button"
              onClick={() => awayTeam?.id && handleWinnerChange(awayTeam.id)}
              disabled={disabled || !awayTeam?.id}
              className={`text-[10px] font-semibold truncate px-0.5 py-0.5 rounded transition-all ${
                awayIsWinner
                  ? "bg-amber-500/80 text-slate-900"
                  : "text-white hover:bg-white/10"
              } disabled:opacity-50`}
            >
              {awayTeam?.tla ||
                getTeamDisplaySimple(
                  awayTeam,
                  match.id,
                  "away",
                  fifaMatchNumber,
                ).label}
            </button>
          ) : (
            <span
              className={`text-[10px] font-semibold truncate px-0.5 py-0.5 rounded ${awayIsWinner ? "bg-amber-500/80 text-slate-900" : "text-white"}`}
            >
              {awayTeam?.tla ||
                getTeamDisplaySimple(
                  awayTeam,
                  match.id,
                  "away",
                  fifaMatchNumber,
                ).label}
            </span>
          )}
        </div>

        {/* Venue - hidden on very narrow screens */}
        {venue && (
          <div className="hidden min-[360px]:block w-8 shrink-0 text-right">
            <span
              style={{ color: "var(--venue-color)" }}
              className="text-[8px] font-medium"
            >
              {getVenueAbbreviation(venue.city)}
            </span>
          </div>
        )}
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
        <div className="flex-1 flex items-center justify-center">
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
                  {homeTeam?.tla ||
                    getTeamDisplaySimple(
                      homeTeam,
                      match.id,
                      "home",
                      fifaMatchNumber,
                    ).label}
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
                  {homeTeam?.tla ||
                    getTeamDisplaySimple(
                      homeTeam,
                      match.id,
                      "home",
                      fifaMatchNumber,
                    ).label}
                </span>
                <TeamCrest team={homeTeam} />
              </div>
            )}
          </div>
          {/* Score Inputs - compact */}
          <div className="flex flex-col items-center mx-2">
            {/* Tie indicator when winner needed but not selected */}
            {needsWinnerSelect && !winnerId && (
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
                  {awayTeam?.tla ||
                    getTeamDisplaySimple(
                      awayTeam,
                      match.id,
                      "away",
                      fifaMatchNumber,
                    ).label}
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
                  {awayTeam?.tla ||
                    getTeamDisplaySimple(
                      awayTeam,
                      match.id,
                      "away",
                      fifaMatchNumber,
                    ).label}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
