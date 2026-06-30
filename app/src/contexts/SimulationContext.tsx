"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { Match } from "@/types/football";
import { GROUP_STAGE_SCHEDULE, KNOCKOUT_SCHEDULE } from "@/lib/tournament";
import {
  setTimeProvider,
  defaultTimeProvider,
  isGroupStageLocked,
  isKnockoutStageOpen,
  isKnockoutStageLocked,
  isKnockoutMatchLocked,
  isMatchLocked,
  getStageLockStatus,
} from "@/lib/time";

// Re-export time functions for convenience
export {
  isGroupStageLocked,
  isKnockoutStageOpen,
  isKnockoutStageLocked,
  isKnockoutMatchLocked,
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

// Simulation tick interval (5 seconds) and time advance per tick (1 minute of game time)
const SIMULATION_TICK_INTERVAL = 5000; // 5 seconds
const SIMULATION_TIME_ADVANCE = 1 * 60 * 1000; // 1 minute of game time per tick

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
    daysUntilKnockoutLocks: number | null;
  };
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

const STORAGE_KEY = "worldcupprode_simulation";

// =====================================================================
// SEEDED RANDOM NUMBER GENERATOR
// Using Mulberry32 algorithm for reproducibility
// =====================================================================

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// =====================================================================
// SIMULATION LOGIC
// =====================================================================

/**
 * Generate a random score for a match
 * Uses seeded random for reproducibility
 * NOTE: High-scoring distribution for testing live updates
 */
function generateRandomScore(random: () => number): {
  home: number;
  away: number;
} {
  // High-scoring distribution for testing
  const scoreDistribution = [
    [3, 2],
    [2, 3],
    [4, 2],
    [2, 4],
    [3, 3],
    [4, 3],
    [3, 4],
    [5, 2],
    [2, 5],
    [4, 4],
    [5, 3],
    [3, 5],
    [6, 2],
    [2, 6],
    [5, 4],
    [4, 5],
    [6, 3],
    [3, 6],
    [7, 2],
    [2, 7],
  ];

  // Equal weights for variety
  const weights = [
    10, 10, 10, 10, 8, 8, 8, 6, 6, 6, 5, 5, 4, 4, 4, 4, 3, 3, 2, 2,
  ];

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let pick = random() * totalWeight;

  for (let i = 0; i < scoreDistribution.length; i++) {
    pick -= weights[i];
    if (pick <= 0) {
      return { home: scoreDistribution[i][0], away: scoreDistribution[i][1] };
    }
  }

  return { home: 4, away: 3 }; // Fallback
}

/**
 * Generate random goal times for a match
 * Returns arrays of minute values when each team scores
 */
function generateGoalTimes(
  random: () => number,
  homeGoals: number,
  awayGoals: number,
): { homeMinutes: number[]; awayMinutes: number[] } {
  const homeMinutes: number[] = [];
  const awayMinutes: number[] = [];

  for (let i = 0; i < homeGoals; i++) {
    // Goals can happen between minute 1-90 (plus some injury time up to 95)
    homeMinutes.push(Math.floor(random() * 94) + 1);
  }
  for (let i = 0; i < awayGoals; i++) {
    awayMinutes.push(Math.floor(random() * 94) + 1);
  }

  return {
    homeMinutes: homeMinutes.sort((a, b) => a - b),
    awayMinutes: awayMinutes.sort((a, b) => a - b),
  };
}

/**
 * Get match datetime from tournament schedule
 */
function getMatchDateTime(fifaNumber: number): Date | null {
  const allSchedule = [...GROUP_STAGE_SCHEDULE, ...KNOCKOUT_SCHEDULE];
  const info = allSchedule.find((m) => m.fifaNumber === fifaNumber);
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
  simulatedDateTime: Date,
): Match["status"] {
  const matchTime = matchDateTime.getTime();
  const simTime = simulatedDateTime.getTime();

  const matchEndTime = matchTime + 105 * 60 * 1000; // 90 min + 15 min half-time

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

  // Auto-advance simulation time every 30 seconds when enabled
  useEffect(() => {
    if (!state.enabled || !state.simulatedDateTime) return;

    const intervalId = setInterval(() => {
      setState((prev) => {
        if (!prev.enabled || !prev.simulatedDateTime) return prev;
        const newTime = new Date(
          new Date(prev.simulatedDateTime).getTime() + SIMULATION_TIME_ADVANCE,
        );
        return {
          ...prev,
          simulatedDateTime: newTime.toISOString(),
        };
      });
    }, SIMULATION_TICK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [state.enabled, state.simulatedDateTime]);

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

  const applySimulation = useCallback(
    (matches: Match[]): Match[] => {
      if (!state.enabled || !state.simulatedDateTime) {
        return matches;
      }

      const simulatedDate = new Date(state.simulatedDateTime);

      // match.id is already the FIFA number (1-104) from the API route.
      // No need to build a separate mapping.

      // Apply simulation to each match
      return matches.map((match) => {
        const fifaNumber = match.id; // Already the FIFA number

        const matchDateTime = getMatchDateTime(fifaNumber);
        if (!matchDateTime) return match;

        const status = getMatchStatus(matchDateTime, simulatedDate);

        // Use the scheduled time from tournament data (not API) for consistency
        const scheduledUtcDate = matchDateTime.toISOString();

        // For matches not started yet, keep original data but use scheduled time
        if (status === "SCHEDULED") {
          return {
            ...match,
            utcDate: scheduledUtcDate,
            status,
            score: {
              ...match.score,
              winner: null,
              fullTime: { home: null, away: null },
              halfTime: { home: null, away: null },
            },
          };
        }

        // Generate final score (use match ID + seed for per-match consistency)
        const matchRandom = mulberry32(state.seed + match.id);
        const finalScore = generateRandomScore(matchRandom);

        // Generate goal times for this match
        const goalTimesRandom = mulberry32(state.seed + match.id + 1000);
        const goalTimes = generateGoalTimes(
          goalTimesRandom,
          finalScore.home,
          finalScore.away,
        );

        // For live matches, show goals scored up to current elapsed time
        if (status === "IN_PLAY" || status === "PAUSED") {
          const matchTime = matchDateTime.getTime();
          const simTime = simulatedDate.getTime();
          const elapsedMin = (simTime - matchTime) / 60000;

          // Count goals that have happened by this minute
          const homeScore = goalTimes.homeMinutes.filter(
            (min) => min <= elapsedMin,
          ).length;
          const awayScore = goalTimes.awayMinutes.filter(
            (min) => min <= elapsedMin,
          ).length;

          // Half-time score (goals up to minute 45)
          const halfTimeHome = goalTimes.homeMinutes.filter(
            (min) => min <= 45,
          ).length;
          const halfTimeAway = goalTimes.awayMinutes.filter(
            (min) => min <= 45,
          ).length;

          return {
            ...match,
            utcDate: scheduledUtcDate,
            status,
            score: {
              winner: getWinner(homeScore, awayScore),
              duration: "REGULAR",
              fullTime: { home: homeScore, away: awayScore },
              halfTime: {
                home: elapsedMin >= 45 ? halfTimeHome : homeScore,
                away: elapsedMin >= 45 ? halfTimeAway : awayScore,
              },
            },
          };
        }

        // Finished match - show full score. Knockout ties must resolve an
        // advancer (penalty shootout): a draw with no winner would otherwise
        // leave the bracket/"passes" scoring unable to decide who went through.
        const isKnockout = fifaNumber >= 73;
        const isTie = finalScore.home === finalScore.away;
        let finalWinner = getWinner(finalScore.home, finalScore.away);
        let finalDuration = "REGULAR";
        if (isKnockout && isTie) {
          // Deterministic per-match shootout winner (seeded, so it's stable).
          const penaltyRandom = mulberry32(state.seed + match.id + 2000);
          finalWinner = penaltyRandom() < 0.5 ? "HOME_TEAM" : "AWAY_TEAM";
          finalDuration = "PENALTY_SHOOTOUT";
        }

        return {
          ...match,
          utcDate: scheduledUtcDate,
          status,
          score: {
            winner: finalWinner,
            duration: finalDuration,
            fullTime: { home: finalScore.home, away: finalScore.away },
            halfTime: {
              home: goalTimes.homeMinutes.filter((min) => min <= 45).length,
              away: goalTimes.awayMinutes.filter((min) => min <= 45).length,
            },
          },
        };
      });
    },
    [state],
  );

  const getState = useCallback(() => state, [state]);

  const value: SimulationContextValue = {
    simulationEnabled: state.enabled,
    simulatedDateTime: state.simulatedDateTime
      ? new Date(state.simulatedDateTime)
      : null,
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
