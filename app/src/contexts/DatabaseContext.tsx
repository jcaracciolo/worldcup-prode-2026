/**
 * Database Context
 *
 * Provides centralized database access to all React components.
 * This is the ONLY way client-side components should access the database.
 *
 * Usage:
 *   const db = useDatabaseService();
 *   const { data, error } = await db.profiles.getProfile(userId);
 */

"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  createClientDatabaseService,
  CURRENT_DB_VERSION,
} from "@/lib/services/database-client";
import {
  DatabaseService,
  DatabaseServiceVersion,
} from "@/lib/services/database-types";

// =====================================================================
// CONTEXT TYPES
// =====================================================================

interface DatabaseContextValue {
  /** The database service instance */
  db: DatabaseService;
  /** Current database service version info */
  version: DatabaseServiceVersion;
}

// =====================================================================
// CONTEXT
// =====================================================================

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

// =====================================================================
// PROVIDER
// =====================================================================

interface DatabaseProviderProps {
  children: React.ReactNode;
}

/**
 * Database Provider
 *
 * Wraps the application with centralized database access.
 * Must be placed high in the component tree, before any components
 * that need database access.
 * 
 * During SSR/build, renders a loading state until client-side initialization.
 */
export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [value, setValue] = useState<DatabaseContextValue | null>(null);

  // Initialize database service only on client-side mount
  useEffect(() => {
    const service = createClientDatabaseService();
    if (service) {
      setValue({
        db: service,
        version: CURRENT_DB_VERSION,
      });
    }
  }, []);

  // During SSR or before client initialization, show loading
  if (!value) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900">
        <div className="text-xl text-white">Loading...</div>
      </div>
    );
  }

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

// =====================================================================
// HOOKS
// =====================================================================

/**
 * Hook to access the database service
 *
 * @throws Error if used outside of DatabaseProvider (should never happen after mount)
 */
export function useDatabase(): DatabaseContextValue {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return context;
}

/**
 * Hook to get just the database service (convenience)
 */
export function useDatabaseService(): DatabaseService {
  const { db } = useDatabase();
  return db;
}
