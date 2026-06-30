/**
 * CENTRALIZED TIME UTILITY
 *
 * Single source of truth for all time-related functionality.
 * This module can be injected with simulated time by the SimulationContext.
 *
 * IMPORTANT: All code that needs the "current time" should use these functions
 * instead of `new Date()` or `Date.now()`.
 */

import { GROUP_STAGE_SCHEDULE, KNOCKOUT_SCHEDULE } from "./tournament";

// =====================================================================
// TOURNAMENT DATE CONSTANTS
// =====================================================================

/** First match: June 11, 2026 18:00 UTC */
export const TOURNAMENT_START = new Date(Date.UTC(2026, 5, 11, 18, 0, 0));

/** First group stage match */
export const GROUP_STAGE_START = new Date(Date.UTC(2026, 5, 11, 18, 0, 0));

/** Last group stage match: June 28, 2026 18:00 UTC (match 72) */
export const GROUP_STAGE_END = new Date(Date.UTC(2026, 5, 28, 18, 0, 0));

/** First knockout match: June 28, 2026 19:00 UTC (match 73 - R32) */
export const KNOCKOUT_START = new Date(Date.UTC(2026, 5, 28, 19, 0, 0));

/**
 * Knockout bracket deadline: June 29, 2026 17:00 UTC.
 * After the first knockout match kicks off, the rest of the bracket stays
 * editable until this deadline (gives players one extra day). Any individual
 * match that kicks off before this deadline is locked at its own kickoff.
 */
export const KNOCKOUT_DEADLINE = new Date(Date.UTC(2026, 5, 29, 17, 0, 0));

/** Final: July 19, 2026 21:00 UTC */
export const TOURNAMENT_END = new Date(Date.UTC(2026, 6, 19, 21, 0, 0));

// =====================================================================
// TIME PROVIDER INTERFACE
// =====================================================================

/**
 * Interface for time provider that can be implemented by SimulationContext
 */
export interface TimeProvider {
  getCurrentTime: () => Date;
  isSimulated: boolean;
}

/**
 * Default time provider that returns real time
 */
export const defaultTimeProvider: TimeProvider = {
  getCurrentTime: () => new Date(),
  isSimulated: false,
};

// Global time provider - can be overridden by SimulationContext
let currentTimeProvider: TimeProvider = defaultTimeProvider;

/**
 * Set the time provider (called by SimulationContext)
 */
export function setTimeProvider(provider: TimeProvider): void {
  currentTimeProvider = provider;
}

/**
 * Get the current time (respects simulation mode)
 * This is the ONLY function that should be used to get "now"
 */
export function getCurrentTime(): Date {
  return currentTimeProvider.getCurrentTime();
}

/**
 * Check if we're in simulation mode
 */
export function isSimulatedTime(): boolean {
  return currentTimeProvider.isSimulated;
}

// =====================================================================
// STAGE LOCK FUNCTIONS
// These determine if predictions are locked based on time
// =====================================================================

/**
 * Check if the group stage is locked (first match has started)
 */
export function isGroupStageLocked(now?: Date): boolean {
  const currentTime = now ?? getCurrentTime();
  return currentTime >= GROUP_STAGE_START;
}

/**
 * Check if knockout stage predictions are open
 * Knockout opens when group stage STARTS - users can start making
 * knockout predictions as soon as the tournament begins
 */
export function isKnockoutStageOpen(now?: Date): boolean {
  const currentTime = now ?? getCurrentTime();
  // Open when group stage starts (tournament begins)
  return currentTime >= GROUP_STAGE_START;
}

/**
 * Check if the knockout stage is locked (the bracket-completion deadline has
 * passed). After this, the WHOLE knockout bracket is locked for editing and all
 * predictions are revealed. Before this, individual matches may still be locked
 * via isKnockoutMatchLocked once they kick off.
 */
export function isKnockoutStageLocked(now?: Date): boolean {
  const currentTime = now ?? getCurrentTime();
  return currentTime >= KNOCKOUT_DEADLINE;
}

/**
 * Check if a specific knockout match is locked (for editing AND visibility).
 * A knockout match is locked when EITHER:
 *   - the global bracket deadline has passed (KNOCKOUT_DEADLINE), or
 *   - that specific match has kicked off (now >= its scheduled start).
 * This lets the first match lock at kickoff while the rest of the bracket
 * stays open until the deadline.
 */
export function isKnockoutMatchLocked(
  matchUtcDate: string | Date,
  now?: Date,
): boolean {
  const currentTime = now ?? getCurrentTime();
  if (currentTime >= KNOCKOUT_DEADLINE) return true;
  const matchTime =
    typeof matchUtcDate === "string" ? new Date(matchUtcDate) : matchUtcDate;
  return currentTime >= matchTime;
}

/**
 * Get days until knockout bracket locks (null if already locked or >5 days)
 * Returns number of days if 5 or less, null otherwise
 */
export function getDaysUntilKnockoutLocks(now?: Date): number | null {
  const currentTime = now ?? getCurrentTime();

  if (currentTime >= KNOCKOUT_DEADLINE) {
    return null; // Already locked
  }

  const diff = KNOCKOUT_DEADLINE.getTime() - currentTime.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days <= 5) {
    return days;
  }

  return null;
}

/**
 * Check if a specific match is locked (has started or finished)
 */
export function isMatchLocked(
  matchUtcDate: string | Date,
  now?: Date,
): boolean {
  const currentTime = now ?? getCurrentTime();
  const matchTime =
    typeof matchUtcDate === "string" ? new Date(matchUtcDate) : matchUtcDate;
  return currentTime >= matchTime;
}

/**
 * Get the lock status for all stages
 */
export function getStageLockStatus(now?: Date): {
  groupStageLocked: boolean;
  knockoutStageOpen: boolean;
  knockoutStageLocked: boolean;
  daysUntilKnockoutLocks: number | null;
} {
  const currentTime = now ?? getCurrentTime();
  return {
    groupStageLocked: isGroupStageLocked(currentTime),
    knockoutStageOpen: isKnockoutStageOpen(currentTime),
    knockoutStageLocked: isKnockoutStageLocked(currentTime),
    daysUntilKnockoutLocks: getDaysUntilKnockoutLocks(currentTime),
  };
}

/**
 * Get the match datetime from FIFA number
 */
export function getMatchDateTime(fifaNumber: number): Date | null {
  const allSchedule = [...GROUP_STAGE_SCHEDULE, ...KNOCKOUT_SCHEDULE];
  const matchInfo = allSchedule.find((m) => m.fifaNumber === fifaNumber);
  if (!matchInfo) return null;

  const [year, month, day] = matchInfo.date.split("-").map(Number);
  const [hour, minute] = matchInfo.time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
}

/**
 * Calculate time until a match starts
 */
export function getTimeUntilMatch(
  matchUtcDate: string | Date,
  now?: Date,
): {
  days: number;
  hours: number;
  minutes: number;
  total: number;
  hasStarted: boolean;
} {
  const currentTime = now ?? getCurrentTime();
  const matchTime =
    typeof matchUtcDate === "string" ? new Date(matchUtcDate) : matchUtcDate;

  const diff = matchTime.getTime() - currentTime.getTime();

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, total: 0, hasStarted: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { days, hours, minutes, total: diff, hasStarted: false };
}
