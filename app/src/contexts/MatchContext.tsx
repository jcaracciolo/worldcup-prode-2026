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
import {
  Match,
  FifaMatchId,
  asFifaMatchId,
  CalculatedStanding,
} from "@/types/football";
import { LocalPrediction } from "@/types/database";
import { getMatchInfo, Venue } from "@/lib/tournament";
import { getTeamDisplaySimple } from "@/lib/team-display";
import { calculateAllActualStandings } from "@/lib/standings";
import { getQualifyingThirdPlaceTeams } from "@/lib/third-place-ranking";
import { BracketResolver, ResolvedTeams } from "@/lib/bracket-resolver";
import { useSimulation } from "./SimulationContext";
import { useTime } from "./TimeContext";

export type { ResolvedTeams } from "@/lib/bracket-resolver";

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
  /** Ready-to-use display name for home team (e.g., "USA", "1A", "W73", "3rd") */
  homeDisplayName: string;
  /** Ready-to-use display name for away team */
  awayDisplayName: string;
}

interface MatchContextValue {
  /** All matches with live info attached */
  matches: MatchWithLiveInfo[];
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
  /** Knockout teams resolved from actual results (API > calculated > null) */
  resolvedKnockoutTeams: Map<FifaMatchId, ResolvedTeams>;
  /** Actual group standings from real match results */
  actualGroupStandings: Map<string, CalculatedStanding[]>;
  /** Which 3rd place teams qualify based on actual results */
  actualThirdPlaceQualifying: Map<string, boolean>;
  /** Raw matches before knockout team overlay (needed by BracketResolver with predictions) */
  rawProcessedMatches: Match[];
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
 * Enhance a match with live info, FIFA number, venue, and display names
 */
function enhanceMatch(match: Match, currentTime: Date): MatchWithLiveInfo {
  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
  const elapsedMinutes = calculateElapsedMinutes(match, currentTime);
  const period = determinePeriod(match, elapsedMinutes);

  // match.id IS the FIFA number (converted by the API route)
  const fifaNumber = asFifaMatchId(match.id);

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

  // Compute display names (e.g., "USA", "1A", "W73", "3rd")
  const homeDisplayName = getTeamDisplaySimple(
    match.homeTeam,
    match.id,
    "home",
    fifaNumber,
  ).label;
  const awayDisplayName = getTeamDisplaySimple(
    match.awayTeam,
    match.id,
    "away",
    fifaNumber,
  ).label;

  return {
    ...match,
    isLive,
    elapsedMinutes,
    period,
    fifaNumber,
    venueDisplay,
    staticVenue,
    homeDisplayName,
    awayDisplayName,
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

  // Calculate actual group standings for knockout team resolution
  const actualGroupStandings = useMemo(
    () => calculateAllActualStandings(processedMatches),
    [processedMatches],
  );

  // Calculate qualifying 3rd place teams from actual results
  const actualThirdPlaceQualifying = useMemo(
    () => getQualifyingThirdPlaceTeams(actualGroupStandings),
    [actualGroupStandings],
  );

  // Resolve knockout teams from actual results (not user predictions)
  // Priority: API teams > calculated from completed groups/matches > null (TBD)
  const resolvedKnockoutTeams = useMemo(() => {
    if (processedMatches.length === 0) return new Map();
    const resolver = new BracketResolver({
      matches: processedMatches,
      predictions: new Map(), // No predictions — actual results only
      groupStandings: actualGroupStandings,
      thirdPlaceQualifying: actualThirdPlaceQualifying,
    });
    return resolver.resolve();
  }, [processedMatches, actualGroupStandings, actualThirdPlaceQualifying]);

  // Transform raw matches to include live info, FIFA number, venue,
  // and bake resolved knockout teams into match.homeTeam/match.awayTeam.
  // This makes knockout team resolution transparent — every consumer
  // gets correct team data regardless of simulation or API state.
  const matches = useMemo(
    () =>
      processedMatches.map((m) => {
        const enhanced = enhanceMatch(m, currentTime);
        if (m.stage === "GROUP_STAGE") return enhanced;
        const resolved = resolvedKnockoutTeams.get(asFifaMatchId(m.id));
        if (!resolved) return enhanced;
        return {
          ...enhanced,
          homeTeam: resolved.home ?? enhanced.homeTeam,
          awayTeam: resolved.away ?? enhanced.awayTeam,
          homeDisplayName: resolved.homeDisplayName,
          awayDisplayName: resolved.awayDisplayName,
        };
      }),
    [processedMatches, currentTime, resolvedKnockoutTeams],
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
      return;
    }

    // Only fetch in real mode when there's a reason to
    const shouldFetch = hasLiveMatches || hasMatchesToday(rawMatches);
    if (!shouldFetch) {
      return;
    }

    fetchMatches();
  }, [tick, isSimulated, hasLiveMatches, rawMatches, fetchMatches]);

  const value: MatchContextValue = {
    matches,
    hasLiveMatches,
    liveMatches,
    loading,
    error,
    lastUpdated,
    refresh,
    isSimulated,
    resolvedKnockoutTeams,
    actualGroupStandings,
    actualThirdPlaceQualifying,
    rawProcessedMatches: processedMatches,
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
 * Hook to get a single match by FIFA ID with resolved knockout teams and display names.
 *
 * For group stage matches, returns the match as-is (teams are always known).
 * For knockout matches, overlays resolved teams from BracketResolver onto
 * homeTeam/awayTeam and uses resolved display names.
 *
 * The returned match includes:
 * - `homeDisplayName` / `awayDisplayName`: Ready-to-use strings like "USA", "1A", "W73", "3rd"
 *
 * @param fifaId - FIFA match number (1-104)
 * @returns The match with resolved teams and display names, or undefined if not found
 */
export function useMatch(fifaId: FifaMatchId): MatchWithLiveInfo | undefined {
  const { matches } = useMatches();

  return useMemo(() => {
    return matches.find((m) => m.id === fifaId);
  }, [matches, fifaId]);
}

/**
 * Hook to get resolved knockout teams.
 *
 * Without arguments, returns actual data from MatchContext
 * (based on real match results: API > calculated > null).
 *
 * When knockout predictions are provided, runs BracketResolver using
 * actual group standings for R32, and predicted knockout winners for R16+.
 *
 * @param predictions - Optional knockout prediction map keyed by FIFA match number
 */
export function useKnockoutTeams(
  predictions?: Map<FifaMatchId, LocalPrediction>,
): Map<FifaMatchId, ResolvedTeams> {
  const {
    matches,
    rawProcessedMatches,
    resolvedKnockoutTeams,
    actualGroupStandings,
    actualThirdPlaceQualifying,
  } = useMatches();

  const hasPredictions = !!predictions;

  // Resolve knockout bracket using actual standings + knockout predictions.
  // We use rawProcessedMatches (before actual resolved teams are baked in)
  // so BracketResolver doesn't treat baked-in teams as API teams and skip
  // prediction-based resolution for R16+.
  const predictedTeams = useMemo(() => {
    if (!hasPredictions || !predictions) {
      return new Map<FifaMatchId, ResolvedTeams>();
    }
    const resolver = new BracketResolver({
      matches: rawProcessedMatches,
      predictions,
      groupStandings: actualGroupStandings,
      thirdPlaceQualifying: actualThirdPlaceQualifying,
      useKnockoutPredictions: true,
    });
    return resolver.resolve();
  }, [
    hasPredictions,
    rawProcessedMatches,
    predictions,
    actualGroupStandings,
    actualThirdPlaceQualifying,
  ]);

  return hasPredictions ? predictedTeams : resolvedKnockoutTeams;
}
