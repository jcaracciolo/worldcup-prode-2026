"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { Match, FifaMatchId } from "@/types/football";
import { getMatchInfo, Venue } from "@/lib/tournament";
import { buildApiToFifaMapping } from "@/lib/api-client";
import { useSimulation } from "./SimulationContext";
import { useTime } from "./TimeContext";

// =====================================================================
// TYPES
// =====================================================================

export interface MatchWithLiveInfo extends Match {
  isLive: boolean;
  elapsedMinutes: number | null;
  period:
    | "FIRST_HALF"
    | "HALF_TIME"
    | "SECOND_HALF"
    | "EXTRA_TIME"
    | "PENALTIES"
    | null;
  /** FIFA match number (1-104) */
  fifaNumber: FifaMatchId | null;
  /** Computed venue display string */
  venueDisplay: string | null;
  /** Static venue info from tournament data */
  staticVenue: Venue | null;
}

interface MatchContextValue {
  /** All matches with live info attached */
  matches: MatchWithLiveInfo[];
  /** Get a specific match by API ID (INTERNAL USE ONLY - prefer getMatchByFifa) */
  getMatch: (apiId: number) => MatchWithLiveInfo | undefined;
  /** Get a specific match by FIFA match number (1-104) - PREFERRED */
  getMatchByFifa: (fifaNumber: FifaMatchId) => MatchWithLiveInfo | undefined;
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
function calculateElapsedMinutes(
  match: Match,
  currentTime: Date,
): number | null {
  if (match.status !== "IN_PLAY" && match.status !== "PAUSED") {
    return null;
  }

  const kickOff = new Date(match.utcDate);
  const elapsedMs = currentTime.getTime() - kickOff.getTime();
  const elapsedMinutes = Math.floor(elapsedMs / 60000);

  // Clamp to reasonable values (0-120 for extra time)
  return Math.max(0, Math.min(elapsedMinutes, 120));
}

/**
 * Determine the current period of a live match
 */
function determinePeriod(
  match: Match,
  elapsedMinutes: number | null,
): MatchWithLiveInfo["period"] {
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
 * Enhance a match with live info, FIFA number, and venue
 */
function enhanceMatch(
  match: Match,
  fifaMapping: Map<number, FifaMatchId>,
  currentTime: Date,
): MatchWithLiveInfo {
  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
  const elapsedMinutes = calculateElapsedMinutes(match, currentTime);
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

export function MatchProvider({
  children,
  initialMatches,
}: MatchProviderProps) {
  const [rawMatches, setRawMatches] = useState<Match[]>(initialMatches || []);
  const [loading, setLoading] = useState(!initialMatches);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(
    initialMatches ? new Date() : null,
  );

  // Get simulation context to apply overrides to match data
  const { applySimulation } = useSimulation();

  // Get time context for current time and tick-based updates
  const { getCurrentTime, tick, isSimulated } = useTime();

  // Get current time
  const currentTime = getCurrentTime();

  // Apply simulation to raw matches (if enabled)
  const processedMatches = useMemo(
    () => (isSimulated ? applySimulation(rawMatches) : rawMatches),
    [rawMatches, isSimulated, applySimulation],
  );

  // Build FIFA number mapping once when matches change
  const fifaMapping = useMemo(
    () => buildApiToFifaMapping(processedMatches),
    [processedMatches],
  );

  // Transform raw matches to include live info, FIFA number, and venue
  const matches = useMemo(
    () =>
      processedMatches.map((m) => enhanceMatch(m, fifaMapping, currentTime)),
    [processedMatches, fifaMapping, currentTime],
  );

  // Check if any matches are currently live
  const hasLiveMatches = useMemo(
    () => matches.some((m) => m.isLive),
    [matches],
  );

  // Get only live matches
  const liveMatches = useMemo(() => matches.filter((m) => m.isLive), [matches]);

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

  // Manual refresh function (doesn't show loading to avoid flickering)
  const refresh = useCallback(async () => {
    await fetchMatches();
  }, [fetchMatches]);

  // Get a specific match by API ID (internal use)
  const getMatch = useCallback(
    (apiId: number) => matches.find((m) => m.id === apiId),
    [matches],
  );

  // Get a specific match by FIFA number (preferred)
  const getMatchByFifa = useCallback(
    (fifaNumber: FifaMatchId) =>
      matches.find((m) => m.fifaNumber === fifaNumber),
    [matches],
  );

  // Initial fetch
  useEffect(() => {
    if (!initialMatches) {
      fetchMatches();
    }
  }, [fetchMatches, initialMatches]);

  // Track if initial fetch is done to avoid double-fetching
  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (!initialMatches) {
      initialFetchDone.current = false;
    } else {
      initialFetchDone.current = true;
    }
  }, [initialMatches]);

  // Tick-based updates - controlled by TimeContext
  // In real mode: fetches every 60 seconds (when there are live/today matches)
  // In simulation mode: doesn't fetch (simulation generates data), but tick still triggers re-renders
  useEffect(() => {
    // Skip the first tick (initial fetch already handled)
    if (tick === 0) return;

    // In simulation mode, we don't need to fetch - simulation generates matches
    if (isSimulated) {
      console.log("[MatchProvider] Simulation tick, skipping API fetch");
      return;
    }

    // Only fetch in real mode when there's a reason to
    const shouldFetch = hasLiveMatches || hasMatchesToday(rawMatches);
    if (!shouldFetch) {
      console.log("[MatchProvider] No live/today matches, skipping fetch");
      return;
    }

    console.log("[MatchProvider] Tick fetch...", { tick, hasLiveMatches });
    fetchMatches();
  }, [tick, isSimulated, hasLiveMatches, rawMatches, fetchMatches]);

  const value: MatchContextValue = {
    matches,
    getMatch,
    getMatchByFifa,
    hasLiveMatches,
    liveMatches,
    loading,
    error,
    lastUpdated,
    refresh,
    isSimulated,
  };

  return (
    <MatchContext.Provider value={value}>{children}</MatchContext.Provider>
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
