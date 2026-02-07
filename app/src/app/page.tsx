"use client";

import { useState, useEffect, useMemo } from "react";
import TodaysMatches from "@/components/TodaysMatches";
import Leaderboard from "@/components/Leaderboard";
import { useUser } from "@/contexts/UserContext";
import { useMatches } from "@/contexts/MatchContext";
import { usePredictionsContext } from "@/contexts/PredictionsContext";
import { calculateTotalPoints } from "@/lib/scoring";
import { calculateAllActualStandings } from "@/lib/standings";
import { getQualifyingThirdPlaceTeams } from "@/lib/third-place-ranking";
import { UserScore } from "@/types/football";

export default function HomePage() {
  const { user: profile, getAllProfiles } = useUser();
  const { matches } = useMatches();
  const { getAllPredictions } = usePredictionsContext();
  const [leaderboard, setLeaderboard] = useState<UserScore[]>([]);

  // Calculate actual standings and advancing teams (shared for all users)
  const { actualStandings, advancingTeamIds } = useMemo(() => {
    if (matches.length === 0) {
      return { actualStandings: new Map(), advancingTeamIds: new Set<number>() };
    }
    
    const standings = calculateAllActualStandings(matches);
    const thirdPlaceQualifying = getQualifyingThirdPlaceTeams(standings);
    
    const ids = new Set<number>();
    standings.forEach((groupStandings, groupName) => {
      groupStandings.forEach((standing, index) => {
        if (index < 2) {
          ids.add(standing.team.id);
        } else if (index === 2 && thirdPlaceQualifying.get(groupName)) {
          ids.add(standing.team.id);
        }
      });
    });
    
    return { actualStandings: standings, advancingTeamIds: ids };
  }, [matches]);

  useEffect(() => {
    const loadData = async () => {
      // Fetch all profiles and predictions in parallel
      const [profiles, allPredictions] = await Promise.all([
        getAllProfiles(),
        getAllPredictions(),
      ]);

      // Calculate scores for each user
      const scores: UserScore[] = profiles.map((p) => {
        const userData = allPredictions.get(p.id);
        const predictions = userData?.predictions || [];
        const overrides = userData?.overrides || [];

        if (predictions.length === 0 || matches.length === 0) {
          return {
            userId: p.id,
            displayName: p.display_name,
            totalPoints: 0,
            livePoints: 0,
            groupStagePoints: 0,
            groupBonusPoints: 0,
            knockoutPoints: 0,
          };
        }

        const { totalPoints, livePoints, breakdown } = calculateTotalPoints(
          matches,
          predictions,
          overrides,
          actualStandings,
          advancingTeamIds,
        );

        // Categorize points by type
        let groupStagePoints = 0;
        let groupBonusPoints = 0;
        let knockoutPoints = 0;

        breakdown.forEach((b) => {
          // Group bonus points
          if (b.type === "group_advance" || b.type === "group_position") {
            groupBonusPoints += b.points;
          }
          // Knockout points (match-level points from knockout matches)
          else if (b.matchInfo?.stage && !b.matchInfo.stage.startsWith("GROUP")) {
            knockoutPoints += b.points;
          }
          // Group stage match points
          else {
            groupStagePoints += b.points;
          }
        });

        return {
          userId: p.id,
          displayName: p.display_name,
          totalPoints,
          livePoints,
          groupStagePoints,
          groupBonusPoints,
          knockoutPoints,
        };
      });

      // Sort by total points descending
      scores.sort((a, b) => b.totalPoints - a.totalPoints);
      setLeaderboard(scores);
    };

    loadData();
  }, [getAllProfiles, getAllPredictions, matches, actualStandings, advancingTeamIds]);

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Matches Section */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <span className="text-xl">📅</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Today&apos;s Matches
                </h2>
                <p className="text-white/50 text-sm">World Cup 2026</p>
              </div>
            </div>

            <TodaysMatches />
          </div>

          {/* Leaderboard Section */}
          <div className="lg:col-span-1">
            <Leaderboard scores={leaderboard} currentUserId={profile?.id} />
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 mt-auto">
        <div className="container mx-auto px-4 py-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-2xl">⚽</span>
            <span className="text-lg font-bold text-white">WorldCupProde</span>
          </div>
          <p className="text-white/40 text-sm">
            FIFA World Cup 2026 Predictions
          </p>
          <p className="text-white/30 text-xs mt-1">
            Not a real betting application
          </p>
        </div>
      </footer>
    </div>
  );
}
