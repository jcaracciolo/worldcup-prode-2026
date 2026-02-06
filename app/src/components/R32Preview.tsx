"use client";

import { Match, CalculatedStanding, Team } from "@/types/football";
import { getPositionLabel, getR32BracketInfo } from "@/lib/r32-bracket";
import { getVenue } from "@/lib/venues";

interface R32PreviewProps {
  matches: Match[];
  groupStandings: Map<string, CalculatedStanding[]>;
  thirdPlaceQualifying?: Map<string, boolean>; // Which 3rd place teams qualify
}

export default function R32Preview({
  matches,
  groupStandings,
  thirdPlaceQualifying,
}: R32PreviewProps) {
  // Get team from standings based on position
  // For 3rd place, only return team if they actually qualify
  const getTeamFromStandings = (
    group: string,
    position: number,
  ): Team | null => {
    const standings = groupStandings.get(group);
    if (!standings || !standings[position - 1]) return null;

    // For 3rd place teams, check if they qualify
    if (position === 3 && thirdPlaceQualifying) {
      const qualifies = thirdPlaceQualifying.get(group);
      if (!qualifies) return null; // Don't show team if they don't qualify
    }

    return standings[position - 1].team;
  };

  // Sort matches by date
  const sortedMatches = [...matches].sort(
    (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
  );

  return (
    <div className="glass-card p-5">
      <h3 className="font-bold text-lg mb-2 text-white">ROUND OF 32</h3>
      <p className="text-white/40 text-sm mb-4">
        Based on your group predictions
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        {sortedMatches.map((match) => {
          const bracketInfo = getR32BracketInfo(match.id);
          if (!bracketInfo) return null;

          const homeTeam = getTeamFromStandings(
            bracketInfo.homePosition.group,
            bracketInfo.homePosition.position,
          );
          const awayTeam = getTeamFromStandings(
            bracketInfo.awayPosition.group,
            bracketInfo.awayPosition.position,
          );

          const homeLabel = getPositionLabel(
            bracketInfo.homePosition.group,
            bracketInfo.homePosition.position,
          );
          const awayLabel = getPositionLabel(
            bracketInfo.awayPosition.group,
            bracketInfo.awayPosition.position,
          );

          const matchDate = new Date(match.utcDate);
          const venue = getVenue(match.id);

          // Check if match involves a 3rd place team
          const isThirdPlace =
            bracketInfo.homePosition.position === 3 ||
            bracketInfo.awayPosition.position === 3;

          const matchTime = matchDate.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });

          return (
            <div
              key={match.id}
              className={`rounded-xl overflow-hidden border ${
                isThirdPlace ? "border-amber-500/50" : "border-white/20"
              }`}
            >
              {/* Header with date/time and venue */}
              <div
                className={`px-4 py-2 ${isThirdPlace ? "bg-amber-900/40" : "bg-slate-700/80"}`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span
                      className="font-bold"
                      style={{ color: "var(--date-color)" }}
                    >
                      {matchDate.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="text-white/60 text-sm">{matchTime}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-white/10 rounded text-white/70">
                    R32
                  </span>
                </div>
                {venue && (
                  <div
                    className="text-sm mt-1"
                    style={{ color: "var(--venue-color)" }}
                  >
                    {venue.stadium}, {venue.city}
                  </div>
                )}
              </div>

              {/* Teams section */}
              <div
                className={`p-4 ${isThirdPlace ? "bg-amber-900/20" : "bg-slate-800/80"}`}
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Home Team */}
                  <div className="flex-1 text-center">
                    {homeTeam ? (
                      <div className="flex flex-col items-center gap-2">
                        {homeTeam.crest && (
                          <img
                            src={homeTeam.crest}
                            alt={homeTeam.name || ""}
                            className="w-12 h-12 object-contain"
                          />
                        )}
                        <div>
                          <div className="text-white font-bold text-xl">
                            {homeTeam.tla || homeTeam.shortName}
                          </div>
                          <div className="text-white/50 text-xs truncate max-w-[100px]">
                            {homeTeam.name}
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 bg-white/10 rounded text-white/60">
                          {homeLabel}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                          <span className="text-white/30 text-xl">?</span>
                        </div>
                        <span className="text-white/50 text-sm italic">
                          {homeLabel}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* VS Divider */}
                  <div className="flex flex-col items-center">
                    <span className="text-white/30 text-lg font-bold">VS</span>
                  </div>

                  {/* Away Team */}
                  <div className="flex-1 text-center">
                    {awayTeam ? (
                      <div className="flex flex-col items-center gap-2">
                        {awayTeam.crest && (
                          <img
                            src={awayTeam.crest}
                            alt={awayTeam.name || ""}
                            className="w-12 h-12 object-contain"
                          />
                        )}
                        <div>
                          <div className="text-white font-bold text-xl">
                            {awayTeam.tla || awayTeam.shortName}
                          </div>
                          <div className="text-white/50 text-xs truncate max-w-[100px]">
                            {awayTeam.name}
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 bg-white/10 rounded text-white/60">
                          {awayLabel}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                          <span className="text-white/30 text-xl">?</span>
                        </div>
                        <span className="text-white/50 text-sm italic">
                          {awayLabel}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Third place warning */}
                {isThirdPlace && (
                  <div className="text-xs text-amber-400 mt-3 text-center font-medium border-t border-amber-500/30 pt-2">
                    ⚠️ Best 3rd place qualifiers - final matchup may vary
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
