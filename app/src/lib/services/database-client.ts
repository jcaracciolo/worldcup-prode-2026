/**
 * Database Service - Client Implementation
 *
 * This is the client-side database service that uses the browser Supabase client.
 * For client-side React components only.
 *
 * Usage:
 *   import { createClientDatabaseService } from "@/lib/services/database-client";
 *   const db = createClientDatabaseService();
 *   const { data, error } = await db.profiles.getProfile(userId);
 */

import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { DatabaseService, CURRENT_DB_VERSION } from "./database-types";
import { createDatabaseServiceFromClient } from "./database-shared";

// =====================================================================
// CLIENT-SIDE DATABASE SERVICE
// =====================================================================

let clientDatabaseService: DatabaseService | null = null;

/**
 * Get the client-side database service (singleton)
 * Use this in React components and client-side code
 * Returns null during SSR/build - use only in client components after mount
 */
export function createClientDatabaseService(): DatabaseService | null {
  // During SSR/build, return null - will be initialized client-side
  if (typeof window === "undefined") {
    return null;
  }

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
