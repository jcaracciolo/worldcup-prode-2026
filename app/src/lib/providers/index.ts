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

export { getMatchesFromComposite } from "./composite-provider";
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

  // API-FOOTBALL: 100 requests/day on free tier
  if (process.env.API_FOOTBALL_KEY) {
    providerRegistry.register(new ApiFootballProvider(), 100);
    console.log("[providers] Registered: api-football (priority 10, limit 100/day)");
  } else {
    console.warn("[providers] API_FOOTBALL_KEY not set — api-football provider disabled");
  }

  // Add more providers here:
  // if (process.env.ISPORTS_API_KEY) {
  //   providerRegistry.register(new ISportsProvider(), 200);
  // }
}
