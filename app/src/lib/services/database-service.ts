/**
 * Database Service - Server-Side Implementation
 *
 * This is the server-side database service that uses the Supabase server client.
 * For API routes and server components only.
 *
 * Version: 1.0.0
 *
 * Usage (server-side):
 *   import { createServerDatabaseService } from "@/lib/services/database-service";
 *   const db = await createServerDatabaseService();
 *   const { data, error } = await db.profiles.getAllProfiles();
 */

import {
  createClient as createServerClient,
  createServiceClient,
} from "@/lib/supabase/server";
import { DatabaseService, CURRENT_DB_VERSION } from "./database-types";
import { createDatabaseServiceFromClient } from "./database-shared";

// =====================================================================
// SERVER-SIDE DATABASE SERVICE
// =====================================================================

/**
 * Get a server-side database service
 * Use this in API routes and server components
 */
export async function createServerDatabaseService(): Promise<DatabaseService> {
  const supabase = await createServerClient();
  return createDatabaseServiceFromClient(supabase);
}

/**
 * Get a server-side database service with service role (admin) privileges
 * Use this for operations that bypass RLS
 */
export async function createServiceDatabaseService(): Promise<DatabaseService> {
  const supabase = await createServiceClient();
  return createDatabaseServiceFromClient(supabase);
}

// =====================================================================
// VERSION EXPORT
// =====================================================================

export { CURRENT_DB_VERSION };
