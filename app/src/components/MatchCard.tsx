"use client";

import { Match } from "@/types/football";
import { format } from "date-fns";
import Link from "next/link";

interface MatchCardProps {
  match: Match;
  showDate?: boolean;
}

export default function MatchCard({ match, showDate = false }: MatchCardProps) {
  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
  const isFinished = match.status === "FINISHED";
  const matchDate = new Date(match.utcDate);

  const getStatusDisplay = () => {
    if (isLive) {
      return (
        <div className="flex flex-col items-center gap-1">
          <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full live-pulse">
            LIVE
          </span>
        </div>
      );
    }
    if (isFinished) {
      return (
        <span className="px-3 py-1 bg-slate-600 text-white text-xs font-semibold rounded-full">
          Final
        </span>
      );
    }
    return (
      <span className="text-emerald-400 font-bold text-lg">
        {format(matchDate, "HH:mm")}
      </span>
    );
  };

  return (
    <Link href={`/match/${match.id}`}>
      <div className="match-card glass-card-light p-5 cursor-pointer group">
        {showDate && (
          <div className="text-center text-xs font-medium text-slate-500 mb-4 uppercase tracking-wider">
            {format(matchDate, "EEEE, MMM d, yyyy")}
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          {/* Home Team */}
          <div className="flex-1 flex flex-col items-center gap-2">
            {match.homeTeam.crest ? (
              <img
                src={match.homeTeam.crest}
                alt={match.homeTeam.name}
                className="w-12 h-12 object-contain drop-shadow-md"
              />
            ) : (
              <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold text-sm">
                {match.homeTeam.shortName?.substring(0, 3) || "???"}
              </div>
            )}
            <span className="font-semibold text-slate-700 text-sm text-center">
              {match.homeTeam.shortName || match.homeTeam.name}
            </span>
          </div>

          {/* Score / Time */}
          <div className="flex flex-col items-center gap-2 min-w-[100px]">
            {isFinished || isLive ? (
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-slate-800">
                  {match.score.fullTime.home}
                </span>
                <span className="text-slate-400 text-xl">-</span>
                <span className="text-3xl font-bold text-slate-800">
                  {match.score.fullTime.away}
                </span>
              </div>
            ) : (
              <div className="text-slate-300 text-2xl font-light">vs</div>
            )}
            {getStatusDisplay()}
          </div>

          {/* Away Team */}
          <div className="flex-1 flex flex-col items-center gap-2">
            {match.awayTeam.crest ? (
              <img
                src={match.awayTeam.crest}
                alt={match.awayTeam.name}
                className="w-12 h-12 object-contain drop-shadow-md"
              />
            ) : (
              <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold text-sm">
                {match.awayTeam.shortName?.substring(0, 3) || "???"}
              </div>
            )}
            <span className="font-semibold text-slate-700 text-sm text-center">
              {match.awayTeam.shortName || match.awayTeam.name}
            </span>
          </div>
        </div>

        {/* Group/Stage info */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="text-center">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full">
              {match.group || match.stage.replace(/_/g, " ")}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
