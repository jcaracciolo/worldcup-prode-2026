/**
 * Database Service - Client Implementation
 *
 * This is the client-side database service that uses the browser Supabase client.
 * For client-side React components only.
 *
 * IMPORTANT: For competition-scoped operations, use useDatabaseService() from
 * DatabaseContext instead. This standalone client does not have access to the
 * current competition context and all competition-scoped queries will return
 * empty results.
 *
 * This is primarily intended for:
 * - Operations that don't need competition scope (auth, profiles, competitions list)
 * - Admin operations that explicitly pass competition ID
 *
 * Usage:
 *   import { createClientDatabaseService } from "@/lib/services/database-client";
 *   const db = createClientDatabaseService();
 *   const { data, error } = await db.profiles.getProfile(userId);
 */

import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { DatabaseService, CURRENT_DB_VERSION } from "./database-types";
import { createDatabaseServiceFromClient, GetCompetitionIdFn } from "./database-shared";

// =====================================================================
// CLIENT-SIDE DATABASE SERVICE
// =====================================================================

let clientDatabaseService: DatabaseService | null = null;

/**
 * Get the client-side database service (singleton)
 * Use this in React components and client-side code
 * Returns null during SSR/build - use only in client components after mount
 *
 * @param getCompetitionId - Optional function to get current competition ID.
 *                          If not provided, competition-scoped queries will
 *                          return empty results.
 */
export function createClientDatabaseService(
  getCompetitionId?: GetCompetitionIdFn,
): DatabaseService | null {
  // During SSR/build, return null - will be initialized client-side
  if (typeof window === "undefined") {
    return null;
  }

  // If a custom getCompetitionId is provided, don't use the singleton
  if (getCompetitionId) {
    const supabase = createBrowserClient();
    if (!supabase) {
      console.warn("Failed to create Supabase client");
      return null;
    }
    return createDatabaseServiceFromClient(supabase, getCompetitionId);
  }

  // Use singleton for cases without competition scope
  if (clientDatabaseService) return clientDatabaseService;

  const supabase = createBrowserClient();
  if (!supabase) {
    // This can happen if env vars are missing
    console.warn("Failed to create Supabase client");
    return null;
  }

  clientDatabaseService = createDatabaseServiceFromClient(supabase);
  return clientDatabaseService;
}

// =====================================================================
// VERSION EXPORT
// =====================================================================

export { CURRENT_DB_VERSION };
