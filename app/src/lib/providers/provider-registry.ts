import type {
  LiveDataProvider,
  ProviderHealth,
  ProviderState,
} from "./types";

// =====================================================================
// PROVIDER REGISTRY
// =====================================================================

/** In-memory state per provider. Survives across requests in the same process. */
const providerStates = new Map<string, ProviderState>();

function getUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getOrCreateState(name: string): ProviderState {
  const today = getUtcDateString();
  let state = providerStates.get(name);

  if (!state || state.lastResetDate !== today) {
    // New provider or new UTC day — reset counters
    state = {
      requestsToday: 0,
      rateLimitedUntil: null,
      lastError: null,
      lastSuccessAt: state?.lastSuccessAt ?? null,
      lastResetDate: today,
    };
    providerStates.set(name, state);
  }

  return state;
}

/**
 * Registry for live data providers.
 * Manages provider ordering, health tracking, budget calculations,
 * and round-robin selection for distributing load across providers.
 */
class ProviderRegistry {
  private providers = new Map<
    string,
    { provider: LiveDataProvider; dailyLimit: number; resetHourUtc: number }
  >();
  private roundRobinIndex = 0;

  /**
   * Register a live data provider.
   * @param provider The provider implementation
   * @param dailyLimit Max requests per day for this provider
   * @param resetHourUtc Hour (UTC, 0-23) at which the provider's daily quota
   *   resets. api-football resets at 00:00 UTC. Used to compute exactly when
   *   an exhausted provider becomes available again.
   */
  register(
    provider: LiveDataProvider,
    dailyLimit: number,
    resetHourUtc = 0,
  ): void {
    this.providers.set(provider.name, { provider, dailyLimit, resetHourUtc });
    getOrCreateState(provider.name);
  }

  /**
   * Compute the next time a provider's daily quota resets, based on our
   * understanding of its reset hour (UTC). Always returns a time in the future.
   */
  private nextResetTime(resetHourUtc: number): Date {
    const now = new Date();
    const next = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        resetHourUtc,
        0,
        0,
        0,
      ),
    );
    // If today's reset hour has already passed, roll to tomorrow.
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  }

  /** Remove a provider by name */
  unregister(name: string): void {
    this.providers.delete(name);
    providerStates.delete(name);
  }

  /** Get all registered providers sorted by priority (lowest first) */
  getAll(): LiveDataProvider[] {
    return [...this.providers.values()]
      .sort((a, b) => a.provider.priority - b.provider.priority)
      .map((e) => e.provider);
  }

  /** Get only available providers (not rate-limited, under daily limit), sorted by priority */
  getAvailable(): LiveDataProvider[] {
    const now = new Date();
    return this.getAll().filter((p) => {
      const entry = this.providers.get(p.name)!;
      const state = getOrCreateState(p.name);

      // Check rate limit expiry
      if (state.rateLimitedUntil && now < state.rateLimitedUntil) {
        return false;
      }
      // Clear expired rate limit
      if (state.rateLimitedUntil && now >= state.rateLimitedUntil) {
        state.rateLimitedUntil = null;
      }
      // Check daily limit
      if (state.requestsToday >= entry.dailyLimit) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get the next available provider using round-robin rotation.
   * Distributes load evenly across providers instead of always hitting the first one.
   */
  getNextAvailable(): LiveDataProvider | null {
    const available = this.getAvailable();
    if (available.length === 0) return null;

    const index = this.roundRobinIndex % available.length;
    this.roundRobinIndex++;
    return available[index];
  }

  /** Total daily request budget across all registered providers */
  getTotalDailyBudget(): number {
    let total = 0;
    for (const entry of this.providers.values()) {
      total += entry.dailyLimit;
    }
    return total;
  }

  /** Remaining requests today across all providers */
  getTotalRemainingBudget(): number {
    let remaining = 0;
    const now = new Date();
    for (const [name, entry] of this.providers.entries()) {
      const state = getOrCreateState(name);
      // Skip rate-limited providers (temporarily unavailable)
      if (state.rateLimitedUntil && now < state.rateLimitedUntil) continue;
      const left = Math.max(0, entry.dailyLimit - state.requestsToday);
      remaining += left;
    }
    return remaining;
  }

  /** Record a successful request for a provider */
  recordSuccess(name: string): void {
    const state = getOrCreateState(name);
    state.requestsToday++;
    state.lastSuccessAt = new Date();
    state.lastError = null;
  }

  /** Record a rate-limit (429) response */
  recordRateLimit(name: string, retryAfterSeconds: number): void {
    const state = getOrCreateState(name);
    state.requestsToday++;
    state.rateLimitedUntil = new Date(Date.now() + retryAfterSeconds * 1000);
    state.lastError = `Rate limited until ${state.rateLimitedUntil.toISOString()}`;
  }

  /**
   * Mark a provider as quota-exhausted until its next daily reset.
   * Sets the request counter to the daily limit and blocks it until the
   * provider's known reset time (e.g. 00:00 UTC for api-football), so we stop
   * wasting calls on a dead provider but resume the moment quota returns.
   */
  recordQuotaExhausted(name: string): void {
    const entry = this.providers.get(name);
    const state = getOrCreateState(name);
    if (entry) {
      state.requestsToday = entry.dailyLimit;
    }
    const resetTime = this.nextResetTime(entry?.resetHourUtc ?? 0);
    state.rateLimitedUntil = resetTime;
    state.lastError = `Quota exhausted until ${resetTime.toISOString()}`;
  }

  /** Record a general error (network failure or non-quota error response) */
  recordError(name: string, error: string): void {
    const state = getOrCreateState(name);
    state.lastError = error;
  }

  /** Get health status for all providers */
  getHealth(): ProviderHealth[] {
    const now = new Date();
    return this.getAll().map((p) => {
      const entry = this.providers.get(p.name)!;
      const state = getOrCreateState(p.name);
      const rateLimited = state.rateLimitedUntil && now < state.rateLimitedUntil;
      const overLimit = state.requestsToday >= entry.dailyLimit;

      return {
        name: p.name,
        requestsToday: state.requestsToday,
        dailyLimit: entry.dailyLimit,
        rateLimitedUntil: state.rateLimitedUntil,
        lastError: state.lastError,
        lastSuccessAt: state.lastSuccessAt,
        isAvailable: !rateLimited && !overLimit,
      };
    });
  }
}

/** Singleton registry instance */
export const providerRegistry = new ProviderRegistry();
