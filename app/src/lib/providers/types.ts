import type { Match } from "@/types/football";

// =====================================================================
// LIVE DATA PROVIDER INTERFACE
// =====================================================================

/**
 * Normalized live match data returned by any live provider.
 * The composite provider matches this to base fixtures by team name + date.
 */
export interface LiveMatchData {
  homeTeamName: string;
  awayTeamName: string;
  utcDate: string;
  status: Match["status"];
  homeGoals: number | null;
  awayGoals: number | null;
  /** Minutes elapsed in the match (if available) */
  elapsed?: number;
}

/**
 * Interface that all live data providers must implement.
 * Providers are queried in priority order — lower priority number = tried first.
 */
export interface LiveDataProvider {
  /** Fetch live/recent match data. Only called when matches may be live. */
  fetchLiveMatches(): Promise<LiveMatchData[]>;
  /** Provider display name for logging */
  readonly name: string;
  /** Lower = higher priority (tried first). E.g., 10, 20, 30. */
  readonly priority: number;
}

// =====================================================================
// PROVIDER HEALTH TRACKING
// =====================================================================

export interface ProviderHealth {
  name: string;
  requestsToday: number;
  dailyLimit: number;
  /** If set, provider is rate-limited until this time */
  rateLimitedUntil: Date | null;
  lastError: string | null;
  lastSuccessAt: Date | null;
  /** Derived: not rate-limited AND under daily limit */
  isAvailable: boolean;
}

/**
 * Mutable state tracked per provider at runtime.
 * Reset daily at midnight UTC.
 */
export interface ProviderState {
  requestsToday: number;
  rateLimitedUntil: Date | null;
  lastError: string | null;
  lastSuccessAt: Date | null;
  lastResetDate: string; // "YYYY-MM-DD" in UTC
}

// =====================================================================
// STATUS MAPPING — API-FOOTBALL
// =====================================================================

/**
 * Maps API-FOOTBALL fixture status short codes to our normalized Match status.
 * Reference: https://www.api-football.com/documentation-v3#tag/Fixtures/operation/get-fixtures
 */
export const API_FOOTBALL_STATUS_MAP: Record<string, Match["status"]> = {
  // Not started
  TBD: "TIMED",
  NS: "TIMED",
  // In play
  "1H": "IN_PLAY",
  "2H": "IN_PLAY",
  ET: "IN_PLAY",
  P: "IN_PLAY",
  LIVE: "IN_PLAY",
  // Paused / break
  HT: "PAUSED",
  BT: "PAUSED",
  // Finished
  FT: "FINISHED",
  AET: "FINISHED",
  PEN: "FINISHED",
  // Other
  SUSP: "SUSPENDED",
  INT: "SUSPENDED",
  PST: "POSTPONED",
  CANC: "CANCELLED",
  ABD: "CANCELLED",
  AWD: "AWARDED",
  WO: "AWARDED",
};

// =====================================================================
// PROVIDER ERRORS
// =====================================================================

export class ProviderRateLimitError extends Error {
  /** Seconds until rate limit resets (from Retry-After header or default) */
  retryAfterSeconds: number;

  constructor(providerName: string, retryAfterSeconds: number = 900) {
    super(`${providerName}: rate limited, retry after ${retryAfterSeconds}s`);
    this.name = "ProviderRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class ProviderError extends Error {
  constructor(providerName: string, message: string) {
    super(`${providerName}: ${message}`);
    this.name = "ProviderError";
  }
}
