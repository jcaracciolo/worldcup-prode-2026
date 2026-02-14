"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { useTime } from "@/contexts/TimeContext";
import { useMatches } from "@/contexts/MatchContext";
import { usePredictionsContext } from "@/contexts/PredictionsContext";
import { useUser } from "@/contexts/UserContext";
import { UserScore, CalculatedStanding, FifaMatchId } from "@/types/football";
import { calculateTotalPoints } from "@/lib/scoring";
import { getQualifyingThirdPlaceTeams } from "@/lib/third-place-ranking";

// =====================================================================
// TYPES
// =====================================================================

interface LeaderboardContextValue {
  scores: UserScore[];
  loading: boolean;
  getPosition: (userId: string) => number | null;
  getUserScore: (userId: string) => UserScore | null;
}

const LeaderboardContext = createContext<LeaderboardContextValue | null>(null);

// =====================================================================
// PROVIDER
// =====================================================================

export function LeaderboardProvider({ children }: { children: ReactNode }) {
  const { tick, stageLockStatus } = useTime();
  const { matches } = useMatches();
  const { getAllProfiles } = useUser();
  const { getAllPredictions } = usePredictionsContext();

  const [scores, setScores] = useState<UserScore[]>([]);
  const [loading, setLoading] = useState(true);

  // Calculate leaderboard when dependencies change
  useEffect(() => {
    const calculate = async () => {
      setLoading(true);
      try {
        const [profiles, allPredictions] = await Promise.all([
          getAllProfiles(),
          getAllPredictions(),
        ]);

        if (!profiles.length) {
          setScores([]);
          return;
        }

        // If nothing locked, everyone has 0 points
        if (
          !stageLockStatus.groupStageLocked &&
          !stageLockStatus.knockoutStageLocked
        ) {
          setScores(
            profiles.map((p) => ({
              userId: p.id,
              displayName: p.display_name,
              totalPoints: 0,
              livePoints: 0,
              groupStagePoints: 0,
              groupBonusPoints: 0,
              knockoutPoints: 0,
              position: 0,
            })),
          );
          return;
        }

        // Calculate actual standings from finished matches
        const groupMatches = matches.filter((m) => m.stage === "GROUP_STAGE");
        const groups = new Map<string, typeof matches>();
        groupMatches.forEach((m) => {
          if (!m.group) return;
          if (!groups.has(m.group)) groups.set(m.group, []);
          groups.get(m.group)!.push(m);
        });

        const actualGroupStandings = new Map<string, CalculatedStanding[]>();
        groups.forEach((groupMatchList, groupName) => {
          const teamStats = new Map<number, CalculatedStanding>();

          groupMatchList.forEach((match) => {
            [match.homeTeam, match.awayTeam].forEach((team) => {
              if (!teamStats.has(team.id)) {
                teamStats.set(team.id, {
                  team,
                  position: 0,
                  points: 0,
                  goalsFor: 0,
                  goalsAgainst: 0,
                  goalDifference: 0,
                  played: 0,
                  won: 0,
                  drawn: 0,
                  lost: 0,
                });
              }
            });
          });

          groupMatchList.forEach((match) => {
            if (match.status !== "FINISHED") return;
            const homeGoals = match.score.fullTime.home;
            const awayGoals = match.score.fullTime.away;
            if (homeGoals === null || awayGoals === null) return;

            const homeStats = teamStats.get(match.homeTeam.id)!;
            const awayStats = teamStats.get(match.awayTeam.id)!;

            homeStats.played++;
            awayStats.played++;
            homeStats.goalsFor += homeGoals;
            homeStats.goalsAgainst += awayGoals;
            awayStats.goalsFor += awayGoals;
            awayStats.goalsAgainst += homeGoals;
            homeStats.goalDifference =
              homeStats.goalsFor - homeStats.goalsAgainst;
            awayStats.goalDifference =
              awayStats.goalsFor - awayStats.goalsAgainst;

            if (homeGoals > awayGoals) {
              homeStats.won++;
              homeStats.points += 3;
              awayStats.lost++;
            } else if (awayGoals > homeGoals) {
              awayStats.won++;
              awayStats.points += 3;
              homeStats.lost++;
            } else {
              homeStats.drawn++;
              awayStats.drawn++;
              homeStats.points += 1;
              awayStats.points += 1;
            }
          });

          const standings = Array.from(teamStats.values())
            .sort((a, b) => {
              if (b.points !== a.points) return b.points - a.points;
              if (b.goalDifference !== a.goalDifference)
                return b.goalDifference - a.goalDifference;
              return b.goalsFor - a.goalsFor;
            })
            .map((s, i) => ({ ...s, position: i + 1 }));

          actualGroupStandings.set(groupName, standings);
        });

        // Calculate advancing teams
        const thirdPlaceQualifying =
          getQualifyingThirdPlaceTeams(actualGroupStandings);
        const advancingTeamIds = new Set<number>();
        actualGroupStandings.forEach((standings, groupName) => {
          standings.forEach((standing, index) => {
            if (index < 2) {
              advancingTeamIds.add(standing.team.id);
            } else if (index === 2 && thirdPlaceQualifying.get(groupName)) {
              advancingTeamIds.add(standing.team.id);
            }
          });
        });

        // Calculate scores for each user
        const calculatedScores: UserScore[] = profiles.map((profile) => {
          const userData = allPredictions.get(profile.id);
          const predictions = userData?.predictions || [];
          const groupOverrides = userData?.overrides || [];

          const matchesWithFifa = matches.map((m) => ({
            ...m,
            fifaNumber: m.fifaNumber as FifaMatchId | null,
          }));

          const { totalPoints, livePoints, breakdown } = calculateTotalPoints(
            matchesWithFifa,
            predictions,
            groupOverrides,
            actualGroupStandings,
            advancingTeamIds,
          );

          let groupStagePoints = 0;
          let groupBonusPoints = 0;
          let knockoutPoints = 0;

          breakdown.forEach((item) => {
            if (
              item.type === "group_advance" ||
              item.type === "group_position"
            ) {
              groupBonusPoints += item.points;
            } else if (
              item.type === "knockout_win" ||
              item.type === "knockout_lose" ||
              item.type === "knockout_tie"
            ) {
              knockoutPoints += item.points;
            } else {
              const match = matches.find((m) => m.id === item.matchId);
              if (match?.stage === "GROUP_STAGE") {
                groupStagePoints += item.points;
              } else {
                knockoutPoints += item.points;
              }
            }
          });

          return {
            userId: profile.id,
            displayName: profile.display_name,
            totalPoints,
            livePoints,
            groupStagePoints,
            groupBonusPoints,
            knockoutPoints,
            position: 0,
          };
        });

        // Sort and assign positions
        calculatedScores.sort((a, b) => b.totalPoints - a.totalPoints);
        let currentPosition = 1;
        let previousScore: number | null = null;
        calculatedScores.forEach((score, index) => {
          if (previousScore !== null && score.totalPoints === previousScore) {
            score.position = currentPosition;
          } else {
            currentPosition = index + 1;
            score.position = currentPosition;
          }
          previousScore = score.totalPoints;
        });

        setScores(calculatedScores);
      } catch (err) {
        console.error("Failed to calculate leaderboard:", err);
      } finally {
        setLoading(false);
      }
    };

    calculate();
  }, [
    matches,
    tick,
    stageLockStatus.groupStageLocked,
    stageLockStatus.knockoutStageLocked,
    getAllProfiles,
    getAllPredictions,
  ]);

  const getPosition = useCallback(
    (userId: string) =>
      scores.find((s) => s.userId === userId)?.position ?? null,
    [scores],
  );

  const getUserScore = useCallback(
    (userId: string) => scores.find((s) => s.userId === userId) ?? null,
    [scores],
  );

  const value = useMemo(
    () => ({ scores, loading, getPosition, getUserScore }),
    [scores, loading, getPosition, getUserScore],
  );

  return (
    <LeaderboardContext.Provider value={value}>
      {children}
    </LeaderboardContext.Provider>
  );
}

// =====================================================================
// HOOKS
// =====================================================================

export function useLeaderboard(): LeaderboardContextValue {
  const context = useContext(LeaderboardContext);
  if (!context) {
    throw new Error("useLeaderboard must be used within a LeaderboardProvider");
  }
  return context;
}

export function useUserPosition(userId: string | null) {
  const { scores, loading, getUserScore } = useLeaderboard();

  return useMemo(() => {
    if (!userId || loading || !scores.length) {
      return {
        position: null,
        total: scores.length,
        userScore: null,
        above: null,
        below: null,
        loading,
      };
    }

    const userScore = getUserScore(userId);
    if (!userScore) {
      return {
        position: null,
        total: scores.length,
        userScore: null,
        above: null,
        below: null,
        loading,
      };
    }

    const userIndex = scores.findIndex((s) => s.userId === userId);
    const above = userIndex > 0 ? scores[userIndex - 1] : null;
    const below = userIndex < scores.length - 1 ? scores[userIndex + 1] : null;

    return {
      position: userScore.position,
      total: scores.length,
      userScore,
      above,
      below,
      loading,
    };
  }, [userId, scores, loading, getUserScore]);
}
