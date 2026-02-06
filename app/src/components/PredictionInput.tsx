"use client";

import { Match } from "@/types/football";
import { Prediction } from "@/types/database";

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
}

export default function PredictionInput({
  match,
  prediction,
  onChange,
  disabled = false,
  showWinnerSelect = false,
}: PredictionInputProps) {
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

  const isTie =
    homeGoals !== null && awayGoals !== null && homeGoals === awayGoals;
  const needsWinnerSelect = showWinnerSelect && isTie;

  return (
    <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
      {/* Home Team */}
      <div className="flex-1 flex items-center justify-end gap-2">
        <span className="text-sm font-medium text-white/90 truncate">
          {match.homeTeam.tla}
        </span>
        {match.homeTeam.crest ? (
          <img
            src={match.homeTeam.crest}
            alt={match.homeTeam.name}
            className="w-7 h-7 object-contain"
          />
        ) : (
          <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-[10px] font-bold text-white/60">
            {match.homeTeam.tla?.substring(0, 2)}
          </div>
        )}
      </div>

      {/* Score Inputs */}
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="0"
          max="20"
          value={homeGoals ?? ""}
          onChange={(e) => handleHomeChange(e.target.value)}
          disabled={disabled}
          className="w-11 h-9 text-center text-lg font-bold bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/30 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-white/5 disabled:text-white/30 transition-all"
          placeholder="-"
        />
        <span className="text-white/30 font-light">-</span>
        <input
          type="number"
          min="0"
          max="20"
          value={awayGoals ?? ""}
          onChange={(e) => handleAwayChange(e.target.value)}
          disabled={disabled}
          className="w-11 h-9 text-center text-lg font-bold bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/30 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-white/5 disabled:text-white/30 transition-all"
          placeholder="-"
        />
      </div>

      {/* Away Team */}
      <div className="flex-1 flex items-center gap-2">
        {match.awayTeam.crest ? (
          <img
            src={match.awayTeam.crest}
            alt={match.awayTeam.name}
            className="w-7 h-7 object-contain"
          />
        ) : (
          <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-[10px] font-bold text-white/60">
            {match.awayTeam.tla?.substring(0, 2)}
          </div>
        )}
        <span className="text-sm font-medium text-white/90 truncate">
          {match.awayTeam.tla}
        </span>
      </div>

      {/* Winner Select (for knockout ties) */}
      {needsWinnerSelect && (
        <div className="flex gap-1 ml-2">
          <button
            type="button"
            onClick={() => handleWinnerChange(match.homeTeam.id)}
            disabled={disabled}
            className={`px-2 py-1 text-xs rounded-lg transition-all ${
              winnerId === match.homeTeam.id
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            } disabled:opacity-50`}
          >
            {match.homeTeam.tla}
          </button>
          <button
            type="button"
            onClick={() => handleWinnerChange(match.awayTeam.id)}
            disabled={disabled}
            className={`px-2 py-1 text-xs rounded-lg transition-all ${
              winnerId === match.awayTeam.id
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            } disabled:opacity-50`}
          >
            {match.awayTeam.tla}
          </button>
        </div>
      )}
    </div>
  );
}
