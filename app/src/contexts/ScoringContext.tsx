"use client";

import React, { createContext, useContext, useMemo, useCallback } from "react";
import { useMatches } from "./MatchContext";
import { useUserPredictions } from "./PredictionsContext";
import { Prediction, GroupStandingsOverride } from "@/types/database";
import { Match, PointBreakdown, CalculatedStanding, FifaMatchId } from "@/types/football";
import {
  calculateGroupStagePoints,
  calculateKnockoutPoints,
  calculateGroupStandingsBonusPoints,
  calculateStandingsFromPredictions,
} from "@/lib/scoring";
import { isGroupStageMatch } from "@/lib/football-api";
import { GROUPS } from "@/lib/tournament";

// =====================================================================
// TYPES
// =====================================================================

export interface ScoreBreakdown {
  groupStage: PointBreakdown[];
  knockout: PointBreakdown[];
  groupBonus: PointBreakdown[];
  total: number;
}

export interface UserScore {
  userId: string;
  breakdown: ScoreBreakdown;
  byMatch: Map<number, PointBreakdown[]>;
  byGroup: Map<string, PointBreakdown[]>;
  loading: boolean;
  error: string | null;
}

interface ScoringContextValue {
  /** Calculate score for a user given their predictions */
  calculateUserScore: (
    userId: string,
    predictions: Map<FifaMatchId, Prediction>,
    overrides: GroupStandingsOverride[],
  ) => ScoreBreakdown;
  /** Get the score for a specific match */
  getMatchScore: (
    matchId: number,
    prediction: Prediction | undefined,
  ) => PointBreakdown[];
  /** Calculate group standings from predictions */
  calculatePredictedStandings: (
    groupName: string,
    predictions: Map<FifaMatchId, Prediction>,
    overrides: GroupStandingsOverride[],
  ) => CalculatedStanding[];
  /** Get actual group standings */
  getActualGroupStandings: (groupName: string) => CalculatedStanding[];
  /** Get teams that advanced (for scoring) */
  getAdvancingTeamIds: () => Set<number>;
  /** Check if group stage is complete */
  isGroupStageComplete: () => boolean;
}

const ScoringContext = createContext<ScoringContextValue | null>(null);

// =====================================================================
// HELPER FUNCTIONS
// =====================================================================

function createEmptyStanding(team: {
  id: number;
  name: string;
  shortName?: string;
  tla?: string;
  crest?: string;
}): CalculatedStanding {
  return {
    team: {
      id: team.id,
      name: team.name,
      shortName: team.shortName || team.name,
      tla: team.tla || "",
      crest: team.crest || "",
    },
    position: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  };
}

function calculateStandingsFromResults(
  groupMatches: Match[],
): CalculatedStanding[] {
  const teamStats = new Map<number, CalculatedStanding>();

  // Initialize teams from matches
  groupMatches.forEach((match) => {
    if (!teamStats.has(match.homeTeam.id)) {
      teamStats.set(match.homeTeam.id, createEmptyStanding(match.homeTeam));
    }
    if (!teamStats.has(match.awayTeam.id)) {
      teamStats.set(match.awayTeam.id, createEmptyStanding(match.awayTeam));
    }
  });

  // Calculate stats from actual results
  groupMatches.forEach((match) => {
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

    homeStats.goalDifference = homeStats.goalsFor - homeStats.goalsAgainst;
    awayStats.goalDifference = awayStats.goalsFor - awayStats.goalsAgainst;

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

  // Sort standings and assign positions
  const sorted = Array.from(teamStats.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference)
      return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });

  // Assign positions
  sorted.forEach((standing, index) => {
    standing.position = index + 1;
  });

  return sorted;
}

// =====================================================================
// PROVIDER
// =====================================================================

interface ScoringProviderProps {
  children: React.ReactNode;
}

export function ScoringProvider({ children }: ScoringProviderProps) {
  const { matches } = useMatches();

  // Group matches by group
  const matchesByGroup = useMemo(() => {
    const groups = new Map<string, Match[]>();
    matches.forEach((match) => {
      if (isGroupStageMatch(match)) {
        const groupName = match.group || "UNKNOWN";
        if (!groups.has(groupName)) {
          groups.set(groupName, []);
        }
        groups.get(groupName)!.push(match);
      }
    });
    return groups;
  }, [matches]);

  // Get actual group standings
  const getActualGroupStandings = useCallback(
    (groupName: string): CalculatedStanding[] => {
      const groupMatches = matchesByGroup.get(groupName) || [];
      return calculateStandingsFromResults(groupMatches);
    },
    [matchesByGroup],
  );

  // Check if group stage is complete
  const isGroupStageComplete = useCallback((): boolean => {
    const groupStageMatches = matches.filter(isGroupStageMatch);
    return groupStageMatches.every((m) => m.status === "FINISHED");
  }, [matches]);

  // Get teams that advanced (1st, 2nd of each group + best 3rd places)
  const getAdvancingTeamIds = useCallback((): Set<number> => {
    const advancingIds = new Set<number>();

    // Get 1st and 2nd from each group
    GROUPS.forEach((groupName) => {
      const standings = getActualGroupStandings(groupName);
      if (standings.length >= 2) {
        advancingIds.add(standings[0].team.id);
        advancingIds.add(standings[1].team.id);
      }
    });

    // In 48-team format, best 8 third-place teams also advance
    // For now, we'll add all 3rd place teams (simplified)
    GROUPS.forEach((groupName) => {
      const standings = getActualGroupStandings(groupName);
      if (standings.length >= 3) {
        advancingIds.add(standings[2].team.id);
      }
    });

    return advancingIds;
  }, [getActualGroupStandings]);

  // Calculate predicted standings for a group
  const calculatePredictedStandings = useCallback(
    (
      groupName: string,
      predictions: Map<FifaMatchId, Prediction>,
      overrides: GroupStandingsOverride[],
    ): CalculatedStanding[] => {
      const groupMatches = matchesByGroup.get(groupName) || [];
      const groupOverrides = overrides.filter(
        (o) => o.group_name === groupName,
      );
      return calculateStandingsFromPredictions(
        groupMatches,
        predictions,
        groupOverrides,
      );
    },
    [matchesByGroup],
  );

  // Get score for a specific match
  const getMatchScore = useCallback(
    (matchId: number, prediction: Prediction | undefined): PointBreakdown[] => {
      const match = matches.find((m) => m.id === matchId);
      if (!match) return [];

      if (isGroupStageMatch(match)) {
        return calculateGroupStagePoints(match, prediction);
      } else {
        return calculateKnockoutPoints(match, prediction);
      }
    },
    [matches],
  );

  // Calculate total user score
  const calculateUserScore = useCallback(
    (
      userId: string,
      predictions: Map<FifaMatchId, Prediction>,
      overrides: GroupStandingsOverride[],
    ): ScoreBreakdown => {
      const groupStage: PointBreakdown[] = [];
      const knockout: PointBreakdown[] = [];
      const groupBonus: PointBreakdown[] = [];

      // Calculate match points - use fifaNumber for prediction lookup
      matches.forEach((match) => {
        const prediction = match.fifaNumber ? predictions.get(match.fifaNumber) : undefined;
        if (isGroupStageMatch(match)) {
          groupStage.push(...calculateGroupStagePoints(match, prediction));
        } else {
          knockout.push(...calculateKnockoutPoints(match, prediction));
        }
      });

      // Calculate group bonus points
      const groupComplete = isGroupStageComplete();
      const advancingTeamIds = getAdvancingTeamIds();

      GROUPS.forEach((groupName) => {
        const predictedStandings = calculatePredictedStandings(
          groupName,
          predictions,
          overrides,
        );
        const actualStandings = getActualGroupStandings(groupName);

        groupBonus.push(
          ...calculateGroupStandingsBonusPoints(
            groupName,
            predictedStandings,
            actualStandings,
            advancingTeamIds,
            groupComplete,
          ),
        );
      });

      const total =
        groupStage.reduce((sum, p) => sum + p.points, 0) +
        knockout.reduce((sum, p) => sum + p.points, 0) +
        groupBonus.reduce((sum, p) => sum + p.points, 0);

      return {
        groupStage,
        knockout,
        groupBonus,
        total,
      };
    },
    [
      matches,
      isGroupStageComplete,
      getAdvancingTeamIds,
      calculatePredictedStandings,
      getActualGroupStandings,
    ],
  );

  const value: ScoringContextValue = {
    calculateUserScore,
    getMatchScore,
    calculatePredictedStandings,
    getActualGroupStandings,
    getAdvancingTeamIds,
    isGroupStageComplete,
  };

  return (
    <ScoringContext.Provider value={value}>{children}</ScoringContext.Provider>
  );
}

// =====================================================================
// HOOKS
// =====================================================================

/**
 * Hook to access scoring context
 */
export function useScoringContext(): ScoringContextValue {
  const context = useContext(ScoringContext);
  if (!context) {
    throw new Error("useScoringContext must be used within a ScoringProvider");
  }
  return context;
}

/**
 * Hook to get the complete score for a user
 * Automatically uses MatchContext and PredictionsContext
 */
export function useUserScore(userId: string | null): UserScore {
  const { calculateUserScore } = useScoringContext();
  const { predictions, overrides, loading, error } = useUserPredictions(userId);

  const score = useMemo((): ScoreBreakdown => {
    if (!userId || loading) {
      return {
        groupStage: [],
        knockout: [],
        groupBonus: [],
        total: 0,
      };
    }
    return calculateUserScore(userId, predictions, overrides);
  }, [userId, predictions, overrides, loading, calculateUserScore]);

  // Index points by match
  const byMatch = useMemo(() => {
    const map = new Map<number, PointBreakdown[]>();
    [...score.groupStage, ...score.knockout].forEach((p) => {
      if (!map.has(p.matchId)) {
        map.set(p.matchId, []);
      }
      map.get(p.matchId)!.push(p);
    });
    return map;
  }, [score]);

  // Index points by group
  const byGroup = useMemo(() => {
    const map = new Map<string, PointBreakdown[]>();
    score.groupBonus.forEach((p) => {
      const groupMatch = p.description.match(/Group (\w)/);
      if (groupMatch) {
        const groupName = `GROUP_${groupMatch[1]}`;
        if (!map.has(groupName)) {
          map.set(groupName, []);
        }
        map.get(groupName)!.push(p);
      }
    });
    return map;
  }, [score]);

  return {
    userId: userId || "",
    breakdown: score,
    byMatch,
    byGroup,
    loading,
    error,
  };
}

/**
 * Hook to get score for a specific match
 */
export function useMatchScore(
  matchId: number,
  prediction: Prediction | undefined,
): PointBreakdown[] {
  const { getMatchScore } = useScoringContext();
  return useMemo(
    () => getMatchScore(matchId, prediction),
    [matchId, prediction, getMatchScore],
  );
}
