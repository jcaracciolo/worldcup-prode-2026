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
 * Manages provider ordering, health tracking, and availability checks.
 */
class ProviderRegistry {
  private providers = new Map<string, { provider: LiveDataProvider; dailyLimit: number }>();

  /**
   * Register a live data provider.
   * @param provider The provider implementation
   * @param dailyLimit Max requests per day for this provider (for health tracking)
   */
  register(provider: LiveDataProvider, dailyLimit: number): void {
    this.providers.set(provider.name, { provider, dailyLimit });
    // Ensure state exists
    getOrCreateState(provider.name);
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

  /** Record a general error */
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
