"use client";

import { useMemo } from "react";
import { MatchWithLiveInfo, getMatchDay } from "@/contexts/MatchContext";
import { LocalPrediction } from "@/types/database";
import PredictionInput from "@/components/PredictionInput";
import { KnockoutMatchRow } from "@/components/match-row";

interface ByDateSectionProps {
  matches: MatchWithLiveInfo[];
}

function formatDateHeading(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function ByDateSection({ matches }: ByDateSectionProps) {
  // Group matches by local date
  const matchesByDate = useMemo(() => {
    const grouped = new Map<string, MatchWithLiveInfo[]>();

    for (const match of matches) {
      const localDate = getMatchDay(new Date(match.utcDate));
      if (!grouped.has(localDate)) grouped.set(localDate, []);
      grouped.get(localDate)!.push(match);
    }

    // Sort each day's matches by time
    grouped.forEach((dayMatches) => {
      dayMatches.sort(
        (a, b) =>
          new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
      );
    });

    return grouped;
  }, [matches]);

  const sortedDates = useMemo(
    () => [...matchesByDate.keys()].sort(),
    [matchesByDate],
  );

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 bg-blue-500/20 rounded-lg flex items-center justify-center">
          <span className="text-sm">📅</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">By Date</h2>
          <p className="text-white/50 text-xs">
            All matches organized by match day
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {sortedDates.map((dateStr) => {
          const dayMatches = matchesByDate.get(dateStr)!;

          return (
            <div key={dateStr} className="glass-card p-3">
              <h3 className="font-bold text-sm mb-2 text-white">
                {formatDateHeading(dateStr)}
              </h3>
              <div className="space-y-0.5">
                {dayMatches.map((match) => {
                  const fifaNumber = match.id;
                  const isKnockout = match.stage !== "GROUP_STAGE";

                  if (isKnockout) {
                    return (
                      <KnockoutMatchRow
                        key={match.id}
                        match={match}
                        fifaMatchNumber={fifaNumber}
                        mode="readonly"
                        scores={{
                          home: match.score.fullTime.home,
                          away: match.score.fullTime.away,
                        }}
                      />
                    );
                  }

                  const syntheticPrediction: LocalPrediction = {
                    match_id: fifaNumber,
                    home_goals: match.score.fullTime.home,
                    away_goals: match.score.fullTime.away,
                    penalty_winner: null,
                  };

                  return (
                    <PredictionInput
                      key={match.id}
                      match={match}
                      prediction={syntheticPrediction}
                      onChange={() => {}}
                      disabled={true}
                      fifaMatchNumber={fifaNumber}
                      linkToMatch={true}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
