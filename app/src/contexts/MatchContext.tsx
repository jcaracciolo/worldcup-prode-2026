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
import { Match, FifaMatchId, CalculatedStanding } from "@/types/football";
import { getMatchInfo, Venue } from "@/lib/tournament";
import { getTeamDisplaySimple } from "@/lib/team-display";
import { isMatchLive } from "@/lib/scoring";
import {
  LiveBracketResolver,
  ResolvedTeams,
  LiveBracket,
} from "@/lib/live-bracket-resolver";
import { useSimulation } from "./SimulationContext";
import { useTime } from "./TimeContext";

export type { ResolvedTeams, LiveBracket } from "@/lib/live-bracket-resolver";

// =====================================================================
// TYPES
// =====================================================================

/**
 * Returns the "match day" date string (YYYY-MM-DD) for a given date.
 * Matches before 6am local are grouped with the previous calendar day,
 * since late-night kickoffs (midnight, 1am, etc.) belong to the prior match day.
 */
export function getMatchDay(date: Date): string {
  const shifted = new Date(date.getTime() - 6 * 60 * 60 * 1000);
  return shifted.toLocaleDateString("en-CA");
}

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
  /** Matches scheduled for today (user's local date), sorted by kick-off time */
  todaysMatches: MatchWithLiveInfo[];
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
  /** Full live bracket (teams + actual group standings + third-place qualifying) */
  liveBracket: LiveBracket;
  /** Raw matches before knockout team overlay */
  rawProcessedMatches: Match[];
  /** Group stage matches bucketed by group name (GROUP_A, GROUP_B, etc.) */
  groups: Map<string, MatchWithLiveInfo[]>;
  /** Knockout matches bucketed by stage (ROUND_OF_32, ROUND_OF_16, etc.) */
  knockoutStages: Map<string, MatchWithLiveInfo[]>;
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
  const elapsedRealMs = currentTime.getTime() - kickOff.getTime();
  const elapsedRealMin = elapsedRealMs / 60000;

  // Estimate match minutes accounting for halftime break (~15 min)
  // First half: 0-45 real min → 0'-45' match time
  // Halftime: 45-60 real min → 45' (paused)
  // Second half: 60+ real min → 45' + (realMin - 60)
  const HALF_TIME_BREAK = 15;
  let matchMinutes: number;
  if (elapsedRealMin <= 45) {
    matchMinutes = elapsedRealMin;
  } else if (elapsedRealMin <= 45 + HALF_TIME_BREAK) {
    matchMinutes = 45; // halftime
  } else {
    matchMinutes = elapsedRealMin - HALF_TIME_BREAK;
  }

  // Clamp to reasonable values (0-120 for extra time)
  return Math.max(0, Math.min(Math.floor(matchMinutes), 120));
}

/**
 * Determine the current period of a live match
 */
function determinePeriod(
  match: Match,
  elapsedMinutes: number | null,
): MatchWithLiveInfo["period"] {
  if (match.status === "PAUSED") {
    return "HALF_TIME";
  }

  if (match.status !== "IN_PLAY") {
    return null;
  }

  if (!elapsedMinutes) return "FIRST_HALF";

  if (elapsedMinutes <= 45) {
    return "FIRST_HALF";
  } else if (elapsedMinutes <= 90) {
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
  const isLive = isMatchLive(match);
  const elapsedMinutes = calculateElapsedMinutes(match, currentTime);
  const period = determinePeriod(match, elapsedMinutes);

  // match.id IS the FIFA number (converted by the API route)
  const fifaNumber = match.id;

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
    fifaNumber,
    "home",
  );
  const awayDisplayName = getTeamDisplaySimple(
    match.awayTeam,
    fifaNumber,
    "away",
  );

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

  // Resolve the live bracket: computes actual group standings, third-place
  // qualifying, and knockout teams from match results.
  const liveBracket = useMemo(() => {
    if (processedMatches.length === 0) {
      return {
        kind: "live" as const,
        teams: new Map<FifaMatchId, ResolvedTeams>(),
        groupStandings: new Map<string, CalculatedStanding[]>(),
        thirdPlaceQualifying: new Map<string, boolean>(),
      };
    }
    return new LiveBracketResolver(processedMatches).resolve();
  }, [processedMatches]);

  // Convenience alias for internal use (match enhancement below)
  const resolvedKnockoutTeams = liveBracket.teams;

  // Transform raw matches to include live info, FIFA number, venue,
  // and bake resolved knockout teams into match.homeTeam/match.awayTeam.
  // This makes knockout team resolution transparent — every consumer
  // gets correct team data regardless of simulation or API state.
  const matches = useMemo(
    () =>
      processedMatches.map((m) => {
        const enhanced = enhanceMatch(m, currentTime);
        if (m.stage === "GROUP_STAGE") return enhanced;
        const resolved = resolvedKnockoutTeams.get(m.id);
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

  // Today's "match day" — matches before 6am local are grouped with previous day
  const todayStr = getMatchDay(currentTime);

  // Matches scheduled for today's match day, sorted by kick-off time
  const todaysMatches = useMemo(() => {
    return matches
      .filter((m) => getMatchDay(new Date(m.utcDate)) === todayStr)
      .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
  }, [matches, todayStr]);

  // Group stage matches bucketed by group name
  const groups = useMemo(() => {
    const map = new Map<string, MatchWithLiveInfo[]>();
    for (const m of matches) {
      if (m.stage !== "GROUP_STAGE" || !m.group) continue;
      if (!map.has(m.group)) map.set(m.group, []);
      map.get(m.group)!.push(m);
    }
    return map;
  }, [matches]);

  // Knockout matches bucketed by stage
  const knockoutStages = useMemo(() => {
    const map = new Map<string, MatchWithLiveInfo[]>();
    for (const m of matches) {
      if (m.stage === "GROUP_STAGE") continue;
      if (!map.has(m.stage)) map.set(m.stage, []);
      map.get(m.stage)!.push(m);
    }
    return map;
  }, [matches]);

  // Server-recommended polling interval (dynamic based on live provider budget)
  const pollIntervalRef = useRef(60_000);

  // Fetch matches from API
  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch("/api/matches", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch matches");
      const data = await res.json();
      setRawMatches(data.matches || []);
      setLastUpdated(new Date());
      setError(null);
      // Update polling interval from server recommendation
      if (data.pollIntervalMs && typeof data.pollIntervalMs === "number") {
        pollIntervalRef.current = data.pollIntervalMs;
      }
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

  // Refresh immediately when the tab/app returns to the foreground.
  // Mobile browsers suspend background timers (and lock screens pause the page
  // entirely), so the polling timer stops while the app is backgrounded.
  // Without this, a returning user would wait up to a full poll interval (60s)
  // before seeing live score updates. A short throttle dedupes the
  // visibilitychange + focus pair and rapid foreground/background toggles.
  const lastForegroundFetchRef = useRef(0);
  useEffect(() => {
    if (isSimulated) return;

    const onForeground = () => {
      if (document.visibilityState !== "visible") return;
      if (!(hasLiveMatches || hasMatchesTodayRef.current)) return;
      const now = Date.now();
      if (now - lastForegroundFetchRef.current < 5_000) return;
      lastForegroundFetchRef.current = now;
      fetchMatches();
    };

    document.addEventListener("visibilitychange", onForeground);
    window.addEventListener("focus", onForeground);
    return () => {
      document.removeEventListener("visibilitychange", onForeground);
      window.removeEventListener("focus", onForeground);
    };
  }, [isSimulated, hasLiveMatches, fetchMatches]);

  // Initial fetch
  useEffect(() => {
    if (!initialMatches) {
      fetchMatches();
    }
  }, [fetchMatches, initialMatches]);

  // Ref so the polling effect can check without a dependency loop
  const hasMatchesTodayRef = useRef(todaysMatches.length > 0);
  hasMatchesTodayRef.current = todaysMatches.length > 0;

  // Dynamic polling — uses server-recommended interval from pollIntervalMs.
  // The server calculates this based on remaining live provider budget ÷ remaining
  // live match minutes. More providers = shorter interval (auto-scales).
  useEffect(() => {
    // In simulation mode, we don't fetch — simulation generates data
    if (isSimulated) return;

    // Self-scheduling timer: fetches, then schedules next fetch at server-recommended interval
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const scheduleNext = () => {
      if (cancelled) return;

      const shouldFetch = hasLiveMatches || hasMatchesTodayRef.current;
      const interval = shouldFetch ? pollIntervalRef.current : 60_000;

      timeoutId = setTimeout(async () => {
        if (cancelled) return;
        if (hasLiveMatches || hasMatchesTodayRef.current) {
          await fetchMatches();
        }
        scheduleNext();
      }, interval);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isSimulated, hasLiveMatches, fetchMatches]);

  // Tick-based re-renders (for time display updates, not fetching)
  // The tick from TimeContext still triggers re-renders for elapsed minutes, etc.
  // but fetching is handled by the dynamic timer above.
  useEffect(() => {
    // This effect just exists so that `tick` changes cause a re-render,
    // which updates computed values like elapsedMinutes.
  }, [tick]);

  const value: MatchContextValue = {
    matches,
    todaysMatches,
    hasLiveMatches,
    liveMatches,
    loading,
    error,
    lastUpdated,
    refresh,
    isSimulated,
    liveBracket,
    rawProcessedMatches: processedMatches,
    groups,
    knockoutStages,
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
