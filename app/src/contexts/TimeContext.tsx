"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useSimulation } from "./SimulationContext";

// =====================================================================
// TIME CONTEXT
// =====================================================================
// This context provides time-related functions to the application.
// It acts as a facade over SimulationContext, exposing ONLY time-related
// functions. This way, components don't need to know if time is simulated
// or real - they just call useTime().getCurrentTime().
//
// IMPORTANTLY: This context controls the update/tick interval for the
// whole app. When the tick updates, subscribers (like MatchContext)
// can refresh their data.
//
// - Real mode: ticks every 60 seconds (for API polling)
// - Simulation mode: ticks every 5 seconds (for fast time advancement)
// =====================================================================

// Update intervals
const REAL_TIME_TICK_INTERVAL = 60000; // 60 seconds for real-time polling
const SIMULATION_TICK_INTERVAL = 5000; // 5 seconds for simulation

interface StageLockStatus {
  groupStageLocked: boolean;
  knockoutStageOpen: boolean;
  knockoutStageLocked: boolean;
  daysUntilKnockoutLocks: number | null;
}

interface TimeContextValue {
  /** Get the current time (automatically uses simulated time when active) */
  getCurrentTime: () => Date;
  /** Current stage lock status based on time */
  stageLockStatus: StageLockStatus;
  /** Check if a specific match is locked based on time */
  isMatchLocked: (matchUtcDate: string | Date) => boolean;
  /** Tick counter - increments on each update interval. Subscribe to this for periodic updates. */
  tick: number;
  /** Whether simulation mode is active (for conditional logic only) */
  isSimulated: boolean;
}

const TimeContext = createContext<TimeContextValue | null>(null);

interface TimeProviderProps {
  children: React.ReactNode;
}

/**
 * TimeProvider - Provides time functions to the application
 *
 * Controls the global update tick:
 * - In real mode: ticks every 60 seconds
 * - In simulation mode: ticks every 5 seconds
 *
 * MUST be nested inside SimulationProvider as it uses useSimulation()
 * to get the current time (which may be simulated).
 */
export function TimeProvider({ children }: TimeProviderProps) {
  // Get time functions from simulation context (handles both real and simulated time)
  const { getCurrentTime, stageLockStatus, simulationEnabled } =
    useSimulation();

  // Tick counter - increments on each interval
  const [tick, setTick] = useState(0);

  // Set up the tick interval based on mode
  useEffect(() => {
    const interval = simulationEnabled
      ? SIMULATION_TICK_INTERVAL
      : REAL_TIME_TICK_INTERVAL;

    const intervalId = setInterval(() => {
      setTick((t) => t + 1);
    }, interval);

    return () => clearInterval(intervalId);
  }, [simulationEnabled]);

  // Create isMatchLocked function
  const isMatchLocked = useCallback(
    (matchUtcDate: string | Date): boolean => {
      const matchTime = new Date(matchUtcDate);
      return getCurrentTime() >= matchTime;
    },
    [getCurrentTime],
  );

  const value: TimeContextValue = useMemo(
    () => ({
      getCurrentTime,
      stageLockStatus,
      isMatchLocked,
      tick,
      isSimulated: simulationEnabled,
    }),
    [getCurrentTime, stageLockStatus, isMatchLocked, tick, simulationEnabled],
  );

  return <TimeContext.Provider value={value}>{children}</TimeContext.Provider>;
}

// =====================================================================
// HOOK
// =====================================================================

/**
 * Hook to access time-related functions.
 *
 * This is the RECOMMENDED way for components to get current time.
 * The time is automatically simulation-aware when simulation mode is active,
 * but this is completely transparent to the component.
 *
 * The `tick` value can be used to trigger periodic refreshes:
 * ```
 * const { tick } = useTime();
 * useEffect(() => {
 *   // This runs every tick (60s real, 5s simulated)
 *   fetchData();
 * }, [tick]);
 * ```
 */
export function useTime(): TimeContextValue {
  const context = useContext(TimeContext);
  if (!context) {
    throw new Error("useTime must be used within a TimeProvider");
  }
  return context;
}
