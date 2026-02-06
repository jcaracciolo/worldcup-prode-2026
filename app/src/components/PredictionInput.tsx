"use client";

import { Match } from "@/types/football";
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

  // Format date
  const matchDate = new Date(match.utcDate);
  const formattedDate = matchDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = matchDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  // Get venue info
  const venue = getVenue(match.id);

  return (
    <div className="flex items-center py-3 px-4 rounded-xl bg-slate-800/60 hover:bg-slate-800/80 transition-colors border border-white/5">
      {/* Section 1: Date */}
      <div className="w-20 text-center shrink-0 pr-3 border-r border-white/10">
        <div className="text-sm uppercase font-bold tracking-wide whitespace-nowrap" style={{ color: 'var(--date-color)' }}>{formattedDate}</div>
      </div>
      
      {/* Section 2: Time & Venue */}
      <div className="w-28 shrink-0 px-3 border-r border-white/10">
        <div className="text-sm text-white/70 font-medium">{formattedTime}</div>
        {venue && <div className="text-sm font-semibold truncate" style={{ color: 'var(--venue-color)' }}>{venue.city}</div>}
      </div>
      
      {/* Section 3: Match */}
      <div className="flex-1 flex items-center pl-4">
        {/* Home Team - fixed width for alignment */}
        <div className="w-24 flex items-center justify-end gap-2">
          <span className="text-sm font-semibold text-white truncate">
            {match.homeTeam.tla}
          </span>
          {match.homeTeam.crest ? (
            <img
              src={match.homeTeam.crest}
              alt={match.homeTeam.name}
              className="w-7 h-7 object-contain shrink-0"
            />
          ) : (
            <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-[10px] font-bold text-white/60 shrink-0">
              {match.homeTeam.tla?.substring(0, 2)}
            </div>
          )}
        </div>

        {/* Score Inputs - centered */}
        <div className="flex items-center gap-2 mx-4">
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

        {/* Away Team - fixed width for alignment */}
        <div className="w-24 flex items-center gap-2">
          {match.awayTeam.crest ? (
            <img
              src={match.awayTeam.crest}
              alt={match.awayTeam.name}
              className="w-7 h-7 object-contain shrink-0"
            />
          ) : (
            <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-[10px] font-bold text-white/60 shrink-0">
              {match.awayTeam.tla?.substring(0, 2)}
            </div>
          )}
          <span className="text-sm font-semibold text-white truncate">
            {match.awayTeam.tla}
          </span>
        </div>

        {/* Winner Select (for knockout ties) */}
        {needsWinnerSelect && (
          <div className="flex gap-1 ml-4">
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
    </div>
  );
}
