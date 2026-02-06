"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { Match } from "@/types/football";
import { getMatchInfo, Venue } from "@/lib/tournament";
import { useSimulation } from "./SimulationContext";

const POLL_INTERVAL = 60000; // 60 seconds;

// =====================================================================
// TYPES
// =====================================================================

export interface MatchWithLiveInfo extends Match {
  isLive: boolean;
  elapsedMinutes: number | null;
  period: "FIRST_HALF" | "HALF_TIME" | "SECOND_HALF" | "EXTRA_TIME" | "PENALTIES" | null;
  /** FIFA match number (1-104) */
  fifaNumber: number | null;
  /** Computed venue display string */
  venueDisplay: string | null;
  /** Static venue info from tournament data */
  staticVenue: Venue | null;
}

interface MatchContextValue {
  /** All matches with live info attached */
  matches: MatchWithLiveInfo[];
  /** Get a specific match by API ID */
  getMatch: (apiId: number) => MatchWithLiveInfo | undefined;
  /** Whether any match is currently live */
  hasLiveMatches: boolean;
  /** List of currently live matches */
  liveMatches: MatchWithLiveInfo[];
  /** Loading state for initial fetch */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Last successful update time */
  lastUpdated: Date | null;
  /** Manually trigger a refresh */
  refresh: () => Promise<void>;
  /** Whether simulation mode is active */
  isSimulated: boolean;
}

const MatchContext = createContext<MatchContextValue | null>(null);

// =====================================================================
// UTILITY FUNCTIONS
// =====================================================================

/**
 * Calculate elapsed minutes for a live match
 * Football data API doesn't always provide minute, so we estimate based on kick-off time
 */
function calculateElapsedMinutes(match: Match): number | null {
  if (match.status !== "IN_PLAY" && match.status !== "PAUSED") {
    return null;
  }

  const kickOff = new Date(match.utcDate);
  const now = new Date();
  const elapsedMs = now.getTime() - kickOff.getTime();
  const elapsedMinutes = Math.floor(elapsedMs / 60000);

  // Clamp to reasonable values (0-120 for extra time)
  return Math.max(0, Math.min(elapsedMinutes, 120));
}

/**
 * Determine the current period of a live match
 */
function determinePeriod(match: Match, elapsedMinutes: number | null): MatchWithLiveInfo["period"] {
  if (match.status === "PAUSED") {
    // If paused around halftime
    if (elapsedMinutes && elapsedMinutes >= 45 && elapsedMinutes < 60) {
      return "HALF_TIME";
    }
    return "HALF_TIME"; // Assume pause = half time
  }

  if (match.status !== "IN_PLAY") {
    return null;
  }

  if (!elapsedMinutes) return "FIRST_HALF";

  if (elapsedMinutes < 45) {
    return "FIRST_HALF";
  } else if (elapsedMinutes < 60) {
    return "HALF_TIME";
  } else if (elapsedMinutes < 90) {
    return "SECOND_HALF";
  } else if (elapsedMinutes < 120) {
    return "EXTRA_TIME";
  } else {
    return "PENALTIES";
  }
}

/**
 * Build the mapping from API match ID to FIFA number
 * Group matches (1-72) are assigned by chronological order
 * Knockout matches (73-104) are assigned by stage and date
 */
function buildFifaMapping(matches: Match[]): Map<number, number> {
  const mapping = new Map<number, number>();
  
  // Group stage matches (FIFA 1-72): assign by date order
  const groupMatches = matches.filter(m => m.stage === "GROUP_STAGE");
  const sortedGroupMatches = [...groupMatches].sort(
    (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
  );
  sortedGroupMatches.forEach((match, index) => {
    mapping.set(match.id, index + 1);
  });

  // Knockout matches (FIFA 73-104): assign by stage and date
  const knockoutStages = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "THIRD_PLACE", "FINAL"];
  const stageBaseNumbers: Record<string, number> = {
    "LAST_32": 73,
    "LAST_16": 89,
    "QUARTER_FINALS": 97,
    "SEMI_FINALS": 101,
    "THIRD_PLACE": 103,
    "FINAL": 104,
  };

  for (const stage of knockoutStages) {
    const stageMatches = matches.filter(m => m.stage === stage);
    const sortedStageMatches = [...stageMatches].sort(
      (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
    );
    sortedStageMatches.forEach((match, index) => {
      mapping.set(match.id, stageBaseNumbers[stage] + index);
    });
  }

  return mapping;
}

/**
 * Enhance a match with live info, FIFA number, and venue
 */
function enhanceMatch(
  match: Match,
  fifaMapping: Map<number, number>
): MatchWithLiveInfo {
  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
  const elapsedMinutes = calculateElapsedMinutes(match);
  const period = determinePeriod(match, elapsedMinutes);
  
  // Get FIFA number from mapping
  const fifaNumber = fifaMapping.get(match.id) || null;
  
  // Get static venue from tournament data (only available for knockout matches 73-104)
  const matchInfo = fifaNumber ? getMatchInfo(fifaNumber) : null;
  const staticVenue = matchInfo?.venue || null;
  
  // Compute venue display: prefer API venue, fall back to static venue
  let venueDisplay: string | null = null;
  if (match.venue) {
    venueDisplay = match.venue;
  } else if (staticVenue) {
    venueDisplay = `${staticVenue.stadium}, ${staticVenue.city}`;
  }

  return {
    ...match,
    isLive,
    elapsedMinutes,
    period,
    fifaNumber,
    venueDisplay,
    staticVenue,
  };
}

/**
 * Check if today has scheduled matches (worth polling)
 */
function hasMatchesToday(matches: Match[]): boolean {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  return matches.some((m) => {
    const matchDate = m.utcDate.split("T")[0];
    return matchDate === todayStr;
  });
}

// =====================================================================
// PROVIDER COMPONENT
// =====================================================================

interface MatchProviderProps {
  children: React.ReactNode;
  /** Optional initial matches for SSR */
  initialMatches?: Match[];
}

export function MatchProvider({ children, initialMatches }: MatchProviderProps) {
  const [rawMatches, setRawMatches] = useState<Match[]>(initialMatches || []);
  const [loading, setLoading] = useState(!initialMatches);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(
    initialMatches ? new Date() : null
  );

  // Get simulation context to apply overrides
  const { simulationEnabled, applySimulation } = useSimulation();

  // Apply simulation to raw matches (if enabled)
  const processedMatches = useMemo(
    () => simulationEnabled ? applySimulation(rawMatches) : rawMatches,
    [rawMatches, simulationEnabled, applySimulation]
  );

  // Build FIFA number mapping once when matches change
  const fifaMapping = useMemo(() => buildFifaMapping(processedMatches), [processedMatches]);

  // Transform raw matches to include live info, FIFA number, and venue
  const matches = useMemo(
    () => processedMatches.map((m) => enhanceMatch(m, fifaMapping)),
    [processedMatches, fifaMapping]
  );

  // Check if any matches are currently live
  const hasLiveMatches = useMemo(
    () => matches.some((m) => m.isLive),
    [matches]
  );

  // Get only live matches
  const liveMatches = useMemo(
    () => matches.filter((m) => m.isLive),
    [matches]
  );

  // Fetch matches from API
  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch("/api/matches", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch matches");
      const data = await res.json();
      setRawMatches(data.matches || []);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error("[MatchProvider] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Manual refresh function
  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchMatches();
  }, [fetchMatches]);

  // Get a specific match by API ID
  const getMatch = useCallback(
    (apiId: number) => matches.find((m) => m.id === apiId),
    [matches]
  );

  // Initial fetch
  useEffect(() => {
    if (!initialMatches) {
      fetchMatches();
    }
  }, [fetchMatches, initialMatches]);

  // Polling effect - poll when there are live matches or during match day
  useEffect(() => {
    // Don't poll during simulation mode
    if (simulationEnabled) return;

    const shouldPoll = hasLiveMatches || hasMatchesToday(rawMatches);

    if (!shouldPoll) return;

    console.log("[MatchProvider] Starting polling...", {
      hasLiveMatches,
      isTournamentDay: hasMatchesToday(rawMatches),
    });

    const intervalId = setInterval(() => {
      console.log("[MatchProvider] Polling for updates...");
      fetchMatches();
    }, POLL_INTERVAL);

    return () => {
      console.log("[MatchProvider] Stopping polling");
      clearInterval(intervalId);
    };
  }, [hasLiveMatches, rawMatches, fetchMatches, simulationEnabled]);

  const value: MatchContextValue = {
    matches,
    getMatch,
    hasLiveMatches,
    liveMatches,
    loading,
    error,
    lastUpdated,
    refresh,
    isSimulated: simulationEnabled,
  };

  return (
    <MatchContext.Provider value={value}>
      {children}
    </MatchContext.Provider>
  );
}

// =====================================================================
// HOOK
// =====================================================================

/**
 * Hook to access match data from the global context
 * Must be used within a MatchProvider
 */
export function useMatches(): MatchContextValue {
  const context = useContext(MatchContext);
  if (!context) {
    throw new Error("useMatches must be used within a MatchProvider");
  }
  return context;
}

/**
 * Hook to get a specific match by API ID
 */
export function useMatch(apiId: number): MatchWithLiveInfo | undefined {
  const { getMatch } = useMatches();
  return getMatch(apiId);
}
