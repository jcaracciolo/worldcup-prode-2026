"use client";

import { Match, CalculatedStanding, Team } from "@/types/football";
import { getPositionLabel, getR32BracketInfo } from "@/lib/r32-bracket";
import { getVenue } from "@/lib/venues";

interface R32PreviewProps {
  matches: Match[];
  groupStandings: Map<string, CalculatedStanding[]>;
}

export default function R32Preview({ matches, groupStandings }: R32PreviewProps) {
  // Get team from standings based on position
  const getTeamFromStandings = (group: string, position: number): Team | null => {
    const standings = groupStandings.get(group);
    if (!standings || !standings[position - 1]) return null;
    return standings[position - 1].team;
  };



  // Sort matches by date
  const sortedMatches = [...matches].sort(
    (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
  );

  return (
    <div className="glass-card p-5">
      <h3 className="font-bold text-lg mb-2 text-white">ROUND OF 32</h3>
      <p className="text-white/40 text-sm mb-4">Based on your group predictions</p>
      <div className="grid md:grid-cols-2 gap-3">
        {sortedMatches.map((match) => {
          const bracketInfo = getR32BracketInfo(match.id);
          if (!bracketInfo) return null;

          const homeTeam = getTeamFromStandings(
            bracketInfo.homePosition.group,
            bracketInfo.homePosition.position
          );
          const awayTeam = getTeamFromStandings(
            bracketInfo.awayPosition.group,
            bracketInfo.awayPosition.position
          );

          const homeLabel = getPositionLabel(
            bracketInfo.homePosition.group,
            bracketInfo.homePosition.position
          );
          const awayLabel = getPositionLabel(
            bracketInfo.awayPosition.group,
            bracketInfo.awayPosition.position
          );

          const matchDate = new Date(match.utcDate);
          const venue = getVenue(match.id);

          // Check if third place match (positions 3)
          const isThirdPlace = bracketInfo.homePosition.position === 3;

          return (
            <div
              key={match.id}
              className={`bg-white/5 rounded-xl p-3 border border-white/10 ${
                isThirdPlace ? "border-amber-500/30" : ""
              }`}
            >
              {/* Date and venue */}
              <div className="flex justify-between items-center text-xs mb-2">
                <span className="text-amber-400/80">
                  {matchDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                {venue && (
                  <span className="text-cyan-400/60">{venue.city}</span>
                )}
              </div>

              {/* Teams */}
              <div className="flex items-center justify-between gap-2">
                {/* Home */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {homeTeam ? (
                    <>
                      {homeTeam.crest && (
                        <img
                          src={homeTeam.crest}
                          alt={homeTeam.name || ""}
                          className="w-6 h-6 object-contain shrink-0"
                        />
                      )}
                      <span className="text-white font-medium truncate">
                        {homeTeam.tla || homeTeam.shortName}
                      </span>
                    </>
                  ) : (
                    <span className="text-white/40 text-sm italic">{homeLabel}</span>
                  )}
                </div>

                {/* VS */}
                <span className="text-white/30 text-xs px-2">vs</span>

                {/* Away */}
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  {awayTeam ? (
                    <>
                      <span className="text-white font-medium truncate">
                        {awayTeam.tla || awayTeam.shortName}
                      </span>
                      {awayTeam.crest && (
                        <img
                          src={awayTeam.crest}
                          alt={awayTeam.name || ""}
                          className="w-6 h-6 object-contain shrink-0"
                        />
                      )}
                    </>
                  ) : (
                    <span className="text-white/40 text-sm italic">{awayLabel}</span>
                  )}
                </div>
              </div>

              {/* Position labels (small) */}
              <div className="flex justify-between text-[10px] text-white/30 mt-1">
                <span>{homeLabel}</span>
                <span>{awayLabel}</span>
              </div>

              {/* Third place warning */}
              {isThirdPlace && (
                <div className="text-[10px] text-amber-400/60 mt-1 text-center">
                  * Best 3rd place qualifiers
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
