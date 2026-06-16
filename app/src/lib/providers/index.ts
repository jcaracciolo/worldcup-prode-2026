/**
 * Provider system entry point.
 *
 * Registers all available live providers and exports the composite fetcher.
 * To add a new provider:
 *   1. Create a class implementing LiveDataProvider
 *   2. Register it here with providerRegistry.register(instance, dailyLimit)
 */

import { providerRegistry } from "./provider-registry";
import { ApiFootballProvider } from "./api-football-provider";
import { WorldCup26Provider } from "./worldcup26-provider";

export { getMatchesFromComposite, getPollingIntervalMs } from "./composite-provider";
export { fetchBaseMatch } from "./football-data-provider";
export { providerRegistry } from "./provider-registry";
export type { LiveDataProvider, ProviderHealth, LiveMatchData } from "./types";

// =====================================================================
// PROVIDER REGISTRATION
// =====================================================================

let initialized = false;

/**
 * Initialize all providers. Safe to call multiple times — only runs once.
 */
export function initializeProviders(): void {
  if (initialized) return;
  initialized = true;

  // WorldCup26.ir — free, no auth, tried first (priority 5)
  // Conservative limit to avoid abuse; no official cap published.
  // Resets at 00:00 UTC (3rd arg) to match our daily-counter boundary.
  const wc26 = new WorldCup26Provider();
  providerRegistry.register(wc26, 500, 0);
  console.log(`[providers] Registered: ${wc26.name} (priority ${wc26.priority}, limit 500/day, reset 00:00 UTC)`);

  // Register all API-FOOTBALL keys (API_FOOTBALL_KEY, API_FOOTBALL_KEY_2, etc.)
  // Each gets 100 req/day, auto-failover when one is exhausted.
  // api-football's free-tier daily quota resets at 00:00 UTC.
  const keys = getApiFootballKeys();
  keys.forEach((key, i) => {
    const provider = new ApiFootballProvider(key, i + 1);
    providerRegistry.register(provider, 100, 0);
    console.log(`[providers] Registered: ${provider.name} (priority ${provider.priority}, limit 100/day, reset 00:00 UTC)`);
  });

  if (keys.length === 0) {
    console.warn("[providers] No API_FOOTBALL_KEY set — live data available via worldcup26 only");
  }
}

function getApiFootballKeys(): string[] {
  const keys: string[] = [];
  // API_FOOTBALL_KEY, API_FOOTBALL_KEY_2, API_FOOTBALL_KEY_3, ...
  const first = process.env.API_FOOTBALL_KEY;
  if (first) keys.push(first);
  for (let i = 2; i <= 10; i++) {
    const key = process.env[`API_FOOTBALL_KEY_${i}`];
    if (key) keys.push(key);
  }
  return keys;
}
