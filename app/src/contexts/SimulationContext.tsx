"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { Match } from "@/types/football";
import { GROUP_STAGE_SCHEDULE, KNOCKOUT_SCHEDULE } from "@/lib/tournament";
import { 
  setTimeProvider, 
  defaultTimeProvider,
  isGroupStageLocked,
  isKnockoutStageOpen,
  isKnockoutStageLocked,
  isMatchLocked,
  getStageLockStatus,
} from "@/lib/time";

// Re-export time functions for convenience
export { 
  isGroupStageLocked, 
  isKnockoutStageOpen, 
  isKnockoutStageLocked, 
  isMatchLocked,
  getStageLockStatus,
} from "@/lib/time";

// =====================================================================
// TYPES
// =====================================================================

export interface SimulationState {
  enabled: boolean;
  simulatedDateTime: string | null; // ISO string
  seed: number; // For reproducible random results
}

interface SimulationContextValue {
  /** Whether simulation mode is active */
  simulationEnabled: boolean;
  /** The simulated date/time */
  simulatedDateTime: Date | null;
  /** Random seed for reproducible results */
  seed: number;
  /** Get the current time (simulated or real) */
  getCurrentTime: () => Date;
  /** Enable simulation at a specific datetime */
  enableSimulation: (dateTime: Date, seed?: number) => void;
  /** Disable simulation and return to real data */
  disableSimulation: () => void;
  /** Apply simulation to real matches, returning modified matches */
  applySimulation: (matches: Match[]) => Match[];
  /** Get the simulation state for persistence */
  getState: () => SimulationState;
  /** Stage lock status based on current time */
  stageLockStatus: {
    groupStageLocked: boolean;
    knockoutStageOpen: boolean;
    knockoutStageLocked: boolean;
  };
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

const STORAGE_KEY = "worldcupprode_simulation";

// =====================================================================
// SEEDED RANDOM NUMBER GENERATOR
// Using Mulberry32 algorithm for reproducibility
// =====================================================================

function mulberry32(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// =====================================================================
// SIMULATION LOGIC
// =====================================================================

/**
 * Generate a random score for a match
 * Uses seeded random for reproducibility
 */
function generateRandomScore(random: () => number): { home: number; away: number } {
  // Most common scores weighted by probability
  const scoreDistribution = [
    [1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 0], [0, 2],
    [2, 2], [3, 1], [1, 3], [3, 0], [0, 3], [3, 2], [2, 3],
    [0, 0], [4, 1], [1, 4], [4, 0], [0, 4], [4, 2], [2, 4],
    [3, 3], [5, 0], [0, 5], [5, 1], [1, 5]
  ];
  
  // Weight towards lower scores
  const weights = [
    12, 12, 10, 10, 10, 8, 8,
    6, 6, 6, 5, 5, 5, 5,
    8, 3, 3, 2, 2, 2, 2,
    2, 1, 1, 1, 1
  ];
  
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let pick = random() * totalWeight;
  
  for (let i = 0; i < scoreDistribution.length; i++) {
    pick -= weights[i];
    if (pick <= 0) {
      return { home: scoreDistribution[i][0], away: scoreDistribution[i][1] };
    }
  }
  
  return { home: 1, away: 1 }; // Fallback
}

/**
 * Get match datetime from tournament schedule
 */
function getMatchDateTime(fifaNumber: number): Date | null {
  const allSchedule = [...GROUP_STAGE_SCHEDULE, ...KNOCKOUT_SCHEDULE];
  const info = allSchedule.find(m => m.fifaNumber === fifaNumber);
  if (!info) return null;
  
  // Parse date and time
  const [year, month, day] = info.date.split("-").map(Number);
  const [hour, minute] = info.time.split(":").map(Number);
  
  // Create UTC date
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
}

/**
 * Determine match status based on simulated time
 */
function getMatchStatus(
  matchDateTime: Date,
  simulatedDateTime: Date
): Match["status"] {
  const matchTime = matchDateTime.getTime();
  const simTime = simulatedDateTime.getTime();
  
  const matchEndTime = matchTime + (105 * 60 * 1000); // 90 min + 15 min half-time
  
  if (simTime < matchTime) {
    return "SCHEDULED";
  } else if (simTime >= matchTime && simTime < matchEndTime) {
    // Check for half-time (around 45-60 min mark)
    const elapsed = simTime - matchTime;
    const elapsedMin = elapsed / 60000;
    if (elapsedMin >= 45 && elapsedMin < 60) {
      return "PAUSED"; // Half-time
    }
    return "IN_PLAY";
  } else {
    return "FINISHED";
  }
}

/**
 * Generate a winner based on score
 */
function getWinner(home: number, away: number): Match["score"]["winner"] {
  if (home > away) return "HOME_TEAM";
  if (away > home) return "AWAY_TEAM";
  return "DRAW";
}

// =====================================================================
// PROVIDER
// =====================================================================

interface SimulationProviderProps {
  children: React.ReactNode;
}

// Helper to get initial state from localStorage
function getInitialState(): SimulationState {
  if (typeof window === "undefined") {
    return { enabled: false, simulatedDateTime: null, seed: 12345 };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as SimulationState;
    }
  } catch (e) {
    console.error("Failed to load simulation state:", e);
  }
  return { enabled: false, simulatedDateTime: null, seed: 12345 };
}

export function SimulationProvider({ children }: SimulationProviderProps) {
  const [state, setState] = useState<SimulationState>(getInitialState);

  // Get current time function that respects simulation
  const getCurrentTime = useCallback((): Date => {
    if (state.enabled && state.simulatedDateTime) {
      return new Date(state.simulatedDateTime);
    }
    return new Date();
  }, [state.enabled, state.simulatedDateTime]);

  // Update the global time provider when simulation state changes
  useEffect(() => {
    if (state.enabled && state.simulatedDateTime) {
      const simulatedDate = new Date(state.simulatedDateTime);
      setTimeProvider({
        getCurrentTime: () => simulatedDate,
        isSimulated: true,
      });
    } else {
      setTimeProvider(defaultTimeProvider);
    }
    
    // Cleanup: reset to default on unmount
    return () => {
      setTimeProvider(defaultTimeProvider);
    };
  }, [state.enabled, state.simulatedDateTime]);

  // Save state to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save simulation state:", e);
    }
  }, [state]);

  // Calculate stage lock status based on current time
  const stageLockStatus = useMemo(() => {
    return getStageLockStatus(getCurrentTime());
  }, [getCurrentTime]);

  const enableSimulation = useCallback((dateTime: Date, seed?: number) => {
    setState({
      enabled: true,
      simulatedDateTime: dateTime.toISOString(),
      seed: seed ?? Math.floor(Math.random() * 1000000),
    });
  }, []);

  const disableSimulation = useCallback(() => {
    setState({
      enabled: false,
      simulatedDateTime: null,
      seed: 12345,
    });
  }, []);

  const applySimulation = useCallback((matches: Match[]): Match[] => {
    if (!state.enabled || !state.simulatedDateTime) {
      return matches;
    }

    const simulatedDate = new Date(state.simulatedDateTime);

    // Build a mapping of API match ID to FIFA number
    const fifaMapping = new Map<number, number>();
    
    // Group stage: sort by date and assign FIFA numbers 1-72
    const groupMatches = matches.filter(m => m.stage === "GROUP_STAGE");
    const sortedGroupMatches = [...groupMatches].sort(
      (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
    );
    sortedGroupMatches.forEach((match, index) => {
      fifaMapping.set(match.id, index + 1);
    });

    // Knockout: assign by stage
    const stageBaseNumbers: Record<string, number> = {
      "LAST_32": 73,
      "LAST_16": 89,
      "QUARTER_FINALS": 97,
      "SEMI_FINALS": 101,
      "THIRD_PLACE": 103,
      "FINAL": 104,
    };

    const knockoutStages = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "THIRD_PLACE", "FINAL"];
    for (const stage of knockoutStages) {
      const stageMatches = matches.filter(m => m.stage === stage);
      const sorted = [...stageMatches].sort(
        (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
      );
      sorted.forEach((match, index) => {
        fifaMapping.set(match.id, stageBaseNumbers[stage] + index);
      });
    }

    // Apply simulation to each match
    return matches.map(match => {
      const fifaNumber = fifaMapping.get(match.id);
      if (!fifaNumber) return match;

      const matchDateTime = getMatchDateTime(fifaNumber);
      if (!matchDateTime) return match;

      const status = getMatchStatus(matchDateTime, simulatedDate);
      
      // For matches not started yet, keep original data
      if (status === "SCHEDULED") {
        return {
          ...match,
          status,
          score: {
            ...match.score,
            winner: null,
            fullTime: { home: null, away: null },
            halfTime: { home: null, away: null },
          },
        };
      }

      // Generate score (use match ID + seed for per-match consistency)
      const matchRandom = mulberry32(state.seed + match.id);
      const score = generateRandomScore(matchRandom);

      // For live matches, potentially show partial score
      if (status === "IN_PLAY" || status === "PAUSED") {
        const matchTime = matchDateTime.getTime();
        const simTime = simulatedDate.getTime();
        const elapsedMin = (simTime - matchTime) / 60000;
        
        // Show half-time score if in first half, full score otherwise
        const homeScore = elapsedMin >= 45 ? score.home : Math.floor(score.home * 0.5);
        const awayScore = elapsedMin >= 45 ? score.away : Math.floor(score.away * 0.5);
        
        return {
          ...match,
          status,
          score: {
            winner: getWinner(homeScore, awayScore),
            duration: "REGULAR",
            fullTime: { home: homeScore, away: awayScore },
            halfTime: { home: Math.floor(score.home * 0.5), away: Math.floor(score.away * 0.5) },
          },
        };
      }

      // Finished match
      return {
        ...match,
        status,
        score: {
          winner: getWinner(score.home, score.away),
          duration: "REGULAR",
          fullTime: { home: score.home, away: score.away },
          halfTime: { home: Math.floor(score.home * 0.5), away: Math.floor(score.away * 0.5) },
        },
      };
    });
  }, [state]);

  const getState = useCallback(() => state, [state]);

  const value: SimulationContextValue = {
    simulationEnabled: state.enabled,
    simulatedDateTime: state.simulatedDateTime ? new Date(state.simulatedDateTime) : null,
    seed: state.seed,
    getCurrentTime,
    enableSimulation,
    disableSimulation,
    applySimulation,
    getState,
    stageLockStatus,
  };

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
}

// =====================================================================
// HOOKS
// =====================================================================

export function useSimulation(): SimulationContextValue {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error("useSimulation must be used within a SimulationProvider");
  }
  return context;
}
