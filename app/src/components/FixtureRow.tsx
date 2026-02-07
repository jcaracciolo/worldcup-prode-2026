"use client";

import { Match } from "@/types/football";
import { MatchWithLiveInfo } from "@/contexts/MatchContext";
import { getTeamDisplayName } from "@/lib/scoring";
import { getMatchInfo } from "@/lib/tournament";
import Link from "next/link";

// City name to 3-letter abbreviation mapping
const CITY_ABBREVIATIONS: Record<string, string> = {
  "Mexico City": "MXC",
  Miami: "MIA",
  Vancouver: "VAN",
  "New York": "NYC",
  "Los Angeles": "LAX",
  Dallas: "DAL",
  Houston: "HOU",
  Seattle: "SEA",
  "San Francisco": "SFO",
  Boston: "BOS",
  Monterrey: "MTY",
  Atlanta: "ATL",
  Philadelphia: "PHI",
  "Kansas City": "KAN",
  Toronto: "TOR",
  Guadalajara: "GDL",
};

interface FixtureRowProps {
  match: Match | MatchWithLiveInfo;
  fifaMatchNumber?: number;
}

// Type guard for MatchWithLiveInfo
function hasLiveInfo(
  match: Match | MatchWithLiveInfo,
): match is MatchWithLiveInfo {
  return "isLive" in match;
}

export default function FixtureRow({
  match,
  fifaMatchNumber,
}: FixtureRowProps) {
  const homeTeam = match.homeTeam;
  const awayTeam = match.awayTeam;

  const isLive = hasLiveInfo(match)
    ? match.isLive
    : match.status === "IN_PLAY" || match.status === "PAUSED";
  const isFinished = match.status === "FINISHED";
  const hasScore = isFinished || isLive;

  const homeGoals = match.score.fullTime.home;
  const awayGoals = match.score.fullTime.away;

  // Group stage logic: highlight winner, or both on draw
  const isGroupStage = match.stage === "GROUP_STAGE";
  const homeWins =
    hasScore &&
    homeGoals !== null &&
    awayGoals !== null &&
    homeGoals > awayGoals;
  const awayWins =
    hasScore &&
    homeGoals !== null &&
    awayGoals !== null &&
    awayGoals > homeGoals;
  const isDraw =
    hasScore &&
    homeGoals !== null &&
    awayGoals !== null &&
    homeGoals === awayGoals;

  // Highlight logic: winner highlighted, or BOTH teams on a group stage draw
  const homeIsWinner = homeWins || (isGroupStage && isDraw);
  const awayIsWinner = awayWins || (isGroupStage && isDraw);

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

  // Get venue info from centralized tournament data
  const matchInfo = fifaMatchNumber ? getMatchInfo(fifaMatchNumber) : null;
  const venue = matchInfo?.venue || null;

  // Get elapsed minutes for live matches
  const elapsedMinutes = hasLiveInfo(match) ? match.elapsedMinutes : null;
  const period = hasLiveInfo(match) ? match.period : null;

  return (
    <Link
      href={`/match/${match.id}`}
      className={`block py-3 px-3 sm:px-4 rounded-xl transition-colors ${
        isLive
          ? "bg-red-900/30 border-2 border-red-500/50"
          : isFinished
            ? "bg-slate-900/60"
            : "bg-slate-800/60 hover:bg-slate-800/80"
      } border border-white/5`}
    >
      {/* Mobile Layout - Single row */}
      <div className="sm:hidden flex items-center gap-1.5">
        {/* Status: FT/Live/Date+Time */}
        <div className="w-12 shrink-0 text-center">
          {isLive ? (
            <span className="px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-bold rounded-full live-pulse">
              LIVE
            </span>
          ) : isFinished ? (
            <span
              style={{ color: "var(--date-color, #888)" }}
              className="text-[10px] font-bold"
            >
              FT
            </span>
          ) : (
            <div className="flex flex-col items-center leading-tight">
              <span
                style={{ color: "var(--date-color)" }}
                className="text-[8px] font-medium"
              >
                {formattedDate}
              </span>
              <span
                style={{ color: "var(--date-color)" }}
                className="text-[10px] font-bold"
              >
                {formattedTime}
              </span>
            </div>
          )}
        </div>

        {/* Home Team */}
        <div className="flex-1 min-w-0 flex items-center justify-end gap-1">
          <span
            className={`text-xs font-semibold truncate px-1 py-0.5 rounded ${homeIsWinner ? "bg-amber-500/80 text-slate-900" : "text-white"}`}
          >
            {homeTeam?.tla || getTeamDisplayName(homeTeam, match.id, "home")}
          </span>
          {homeTeam?.crest ? (
            <img
              src={homeTeam.crest}
              alt={homeTeam.name}
              className="w-5 h-5 object-contain shrink-0"
            />
          ) : (
            <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[8px] font-bold text-white/60 shrink-0">
              {homeTeam?.tla?.substring(0, 2) || "?"}
            </div>
          )}
        </div>

        {/* Score Display */}
        <div className="flex items-center gap-1 shrink-0">
          {hasScore && homeGoals !== null && awayGoals !== null ? (
            <>
              <div
                className={`w-7 h-6 flex items-center justify-center text-sm font-bold rounded ${
                  isLive
                    ? "bg-red-500/20 text-white border border-red-500/50"
                    : "bg-white/90 text-slate-800"
                }`}
              >
                {homeGoals}
              </div>
              <span className="text-white/50 font-bold text-xs">-</span>
              <div
                className={`w-7 h-6 flex items-center justify-center text-sm font-bold rounded ${
                  isLive
                    ? "bg-red-500/20 text-white border border-red-500/50"
                    : "bg-white/90 text-slate-800"
                }`}
              >
                {awayGoals}
              </div>
            </>
          ) : (
            <>
              <div className="w-7 h-6 flex items-center justify-center text-sm font-bold bg-white/10 rounded text-white/30">
                -
              </div>
              <span className="text-white/50 font-bold text-xs">-</span>
              <div className="w-7 h-6 flex items-center justify-center text-sm font-bold bg-white/10 rounded text-white/30">
                -
              </div>
            </>
          )}
        </div>

        {/* Away Team */}
        <div className="flex-1 min-w-0 flex items-center gap-1">
          {awayTeam?.crest ? (
            <img
              src={awayTeam.crest}
              alt={awayTeam.name}
              className="w-5 h-5 object-contain shrink-0"
            />
          ) : (
            <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[8px] font-bold text-white/60 shrink-0">
              {awayTeam?.tla?.substring(0, 2) || "?"}
            </div>
          )}
          <span
            className={`text-xs font-semibold truncate px-1 py-0.5 rounded ${awayIsWinner ? "bg-amber-500/80 text-slate-900" : "text-white"}`}
          >
            {awayTeam?.tla || getTeamDisplayName(awayTeam, match.id, "away")}
          </span>
        </div>

        {/* Venue */}
        {venue && (
          <div className="w-10 shrink-0 text-right">
            <span
              style={{ color: "var(--venue-color)" }}
              className="text-[10px] font-medium"
            >
              {CITY_ABBREVIATIONS[venue.city] ||
                venue.city.substring(0, 3).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Desktop Layout */}
      <div className="hidden sm:flex items-center">
        {/* Section 1: Date or Live indicator */}
        <div className="w-20 text-center shrink-0 pr-3 border-r border-white/10">
          {isLive ? (
            <div className="flex flex-col items-center">
              <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full live-pulse">
                LIVE
              </span>
              {elapsedMinutes !== null && (
                <span className="text-red-400 text-xs font-semibold mt-1">
                  {period === "HALF_TIME" ? "HT" : `${elapsedMinutes}'`}
                </span>
              )}
            </div>
          ) : isFinished ? (
            <div
              className="text-sm uppercase font-bold tracking-wide"
              style={{ color: "var(--date-color, #888)" }}
            >
              FT
            </div>
          ) : (
            <div
              className="text-sm uppercase font-bold tracking-wide whitespace-nowrap"
              style={{ color: "var(--date-color)" }}
            >
              {formattedDate}
            </div>
          )}
        </div>

        {/* Section 2: Time & Venue */}
        <div className="w-28 shrink-0 px-3 border-r border-white/10">
          <div className="text-sm text-white/70 font-medium">
            {formattedTime}
          </div>
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
          </div>

          {/* Score Display - centered */}
          <div className="flex flex-col items-center mx-4">
            <div className="flex items-center gap-2">
              {hasScore && homeGoals !== null && awayGoals !== null ? (
                <>
                  <div
                    className={`w-12 h-10 flex items-center justify-center text-xl font-bold rounded-lg ${
                      isLive
                        ? "bg-red-500/20 text-white border-2 border-red-500/50"
                        : "bg-white/90 text-slate-800"
                    }`}
                  >
                    {homeGoals}
                  </div>
                  <span className="text-white/50 font-bold text-lg">-</span>
                  <div
                    className={`w-12 h-10 flex items-center justify-center text-xl font-bold rounded-lg ${
                      isLive
                        ? "bg-red-500/20 text-white border-2 border-red-500/50"
                        : "bg-white/90 text-slate-800"
                    }`}
                  >
                    {awayGoals}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-10 flex items-center justify-center text-xl font-bold bg-white/10 rounded-lg text-white/30">
                    -
                  </div>
                  <span className="text-white/50 font-bold text-lg">-</span>
                  <div className="w-12 h-10 flex items-center justify-center text-xl font-bold bg-white/10 rounded-lg text-white/30">
                    -
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Away Team - fixed width for alignment */}
          <div className="w-24 flex items-center gap-2">
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
                {getTeamDisplayName(awayTeam, match.id, "away")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
