"use client";

import { Match, Team } from "@/types/football";
import { Prediction } from "@/types/database";
import { getVenue } from "@/lib/venues";

interface PredictionInputProps {
  match: Match;
  prediction?: Prediction;
  onChange: (
    matchId: number,
    homeGoals: number | null,
    awayGoals: number | null,
    winnerId?: number | null,
  ) => void;
  disabled?: boolean;
  showWinnerSelect?: boolean;
  resolvedHomeTeam?: Team | null;
  resolvedAwayTeam?: Team | null;
}

export default function PredictionInput({
  match,
  prediction,
  onChange,
  disabled = false,
  showWinnerSelect = false,
  resolvedHomeTeam,
  resolvedAwayTeam,
}: PredictionInputProps) {
  // Use resolved teams if provided, otherwise fall back to match teams
  const homeTeam = resolvedHomeTeam ?? match.homeTeam;
  const awayTeam = resolvedAwayTeam ?? match.awayTeam;

  const homeGoals = prediction?.home_goals ?? null;
  const awayGoals = prediction?.away_goals ?? null;
  const winnerId = prediction?.winner_id ?? null;

  const handleHomeChange = (value: string) => {
    const goals = value === "" ? null : parseInt(value, 10);
    if (goals !== null && (isNaN(goals) || goals < 0)) return;
    onChange(match.id, goals, awayGoals, winnerId);
  };

  const handleAwayChange = (value: string) => {
    const goals = value === "" ? null : parseInt(value, 10);
    if (goals !== null && (isNaN(goals) || goals < 0)) return;
    onChange(match.id, homeGoals, goals, winnerId);
  };

  const handleWinnerChange = (teamId: number) => {
    onChange(match.id, homeGoals, awayGoals, teamId);
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

  // Format date
  const matchDate = new Date(match.utcDate);
  const formattedDate = matchDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const formattedTime = matchDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  // Get venue info
  const venue = getVenue(match.id);

  return (
    <div
      className={`flex items-center py-3 px-4 rounded-xl transition-colors ${
        disabled
          ? "bg-slate-900/60 opacity-70"
          : "bg-slate-800/60 hover:bg-slate-800/80"
      } ${
        needsWinnerSelect
          ? "border-2 border-amber-400/50"
          : "border border-white/5"
      }`}
    >
      {/* Section 1: Date */}
      <div className="w-20 text-center shrink-0 pr-3 border-r border-white/10">
        <div
          className="text-sm uppercase font-bold tracking-wide whitespace-nowrap"
          style={{ color: "var(--date-color)" }}
        >
          {formattedDate}
        </div>
      </div>

      {/* Section 2: Time & Venue */}
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

      {/* Section 3: Match */}
      <div className="flex-1 flex items-center pl-4">
        {/* Home Team - fixed width for alignment */}
        <div className="w-24 flex items-center justify-end gap-2">
          {needsWinnerSelect ? (
            <button
              type="button"
              onClick={() => homeTeam?.id && handleWinnerChange(homeTeam.id)}
              disabled={disabled || !homeTeam?.id}
              className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all ${
                homeIsWinner
                  ? "bg-amber-500/80 text-slate-900 font-bold"
                  : "hover:bg-white/10"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="text-sm font-semibold truncate">
                {homeTeam?.tla || "TBD"}
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
            </button>
          ) : (
            <div
              className={`flex items-center gap-2 px-2 py-1 rounded-lg ${
                homeIsWinner ? "bg-amber-500/80" : ""
              }`}
            >
              <span
                className={`text-sm font-semibold truncate ${
                  homeIsWinner ? "text-slate-900 font-bold" : "text-white"
                }`}
              >
                {homeTeam?.tla || "TBD"}
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
          )}
        </div>

        {/* Score Inputs - centered */}
        <div className="flex flex-col items-center mx-4">
          {/* Tie indicator when winner needed but not selected - ABOVE score */}
          {needsWinnerSelect && !winnerId && (
            <div className="mb-1 px-1.5 py-0.5 text-[9px] leading-tight text-center rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Select winner
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="20"
              value={homeGoals ?? ""}
              onChange={(e) => handleHomeChange(e.target.value)}
              disabled={disabled}
              className="w-12 h-10 text-center text-xl font-bold bg-white/90 border-2 border-white rounded-lg text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 disabled:bg-white/30 disabled:text-white/50 disabled:border-white/20 transition-all shadow-md"
              placeholder="-"
            />
            <span className="text-white/50 font-bold text-lg">-</span>
            <input
              type="number"
              min="0"
              max="20"
              value={awayGoals ?? ""}
              onChange={(e) => handleAwayChange(e.target.value)}
              disabled={disabled}
              className="w-12 h-10 text-center text-xl font-bold bg-white/90 border-2 border-white rounded-lg text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 disabled:bg-white/30 disabled:text-white/50 disabled:border-white/20 transition-all shadow-md"
              placeholder="-"
            />
          </div>
        </div>

        {/* Away Team - fixed width for alignment */}
        <div className="w-24 flex items-center gap-2">
          {needsWinnerSelect ? (
            <button
              type="button"
              onClick={() => awayTeam?.id && handleWinnerChange(awayTeam.id)}
              disabled={disabled || !awayTeam?.id}
              className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all ${
                awayIsWinner
                  ? "bg-amber-500/80 text-slate-900 font-bold"
                  : "hover:bg-white/10"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
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
              <span className="text-sm font-semibold truncate">
                {awayTeam?.tla || "TBD"}
              </span>
            </button>
          ) : (
            <div
              className={`flex items-center gap-2 px-2 py-1 rounded-lg ${
                awayIsWinner ? "bg-amber-500/80" : ""
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
                  awayIsWinner ? "text-slate-900 font-bold" : "text-white"
                }`}
              >
                {awayTeam?.tla || "TBD"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
