"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import {
  DatabaseService,
  CURRENT_DB_VERSION,
} from "@/lib/services/database-types";
import { createDatabaseServiceFromClient } from "@/lib/services/database-shared";
import { Competition } from "@/types/database";

// =====================================================================
// TYPES
// =====================================================================

const COMPETITION_STORAGE_KEY = "worldcupprode_competition_id";

interface DatabaseContextValue {
  /** The database service instance (for mutations) */
  db: DatabaseService;
  /** Current competition ID */
  currentCompetitionId: string | null;
  /** Current competition object */
  currentCompetition: Competition | null;
  /** List of competitions the user belongs to */
  userCompetitions: Competition[];
  /** Whether competition data is loading */
  competitionLoading: boolean;
  /** Switch to a different competition */
  switchCompetition: (competitionId: string) => void;
  /** Refresh user's competition list */
  refreshCompetitions: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

// =====================================================================
// PROVIDER
// =====================================================================

interface DatabaseProviderProps {
  children: React.ReactNode;
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  // Competition state
  const [currentCompetitionId, setCurrentCompetitionId] = useState<
    string | null
  >(null);
  const [userCompetitions, setUserCompetitions] = useState<Competition[]>([]);
  const [competitionLoading, setCompetitionLoading] = useState(true);

  // Create the database service with competition ID
  // Recreated when competition changes, triggering re-renders in consumers that depend on [db]
  const db = useMemo(() => {
    // During SSR/build, return null - will be initialized client-side
    if (typeof window === "undefined") {
      // Return a minimal service for SSR (won't be used)
      return null;
    }

    const supabase = createBrowserClient();
    if (!supabase) {
      console.warn("Failed to create Supabase client");
      return null;
    }

    return createDatabaseServiceFromClient(supabase, currentCompetitionId);
  }, [currentCompetitionId]);

  // Load user's competitions after auth
  const loadUserCompetitions = useCallback(
    async (userId: string) => {
      if (!db) return;

      setCompetitionLoading(true);
      try {
        const { data: competitions, error } =
          await db.competitionMembers.getUserCompetitions(userId);

        if (error) {
          console.error("[DB] Failed to load user competitions:", error);
          setUserCompetitions([]);
          return;
        }

        setUserCompetitions(competitions || []);

        // Auto-select competition
        const savedCompetitionId =
          typeof window !== "undefined"
            ? localStorage.getItem(COMPETITION_STORAGE_KEY)
            : null;

        if (competitions && competitions.length > 0) {
          // Check if saved competition is still valid
          const savedIsValid =
            savedCompetitionId &&
            competitions.some((c) => c.id === savedCompetitionId);

          if (savedIsValid) {
            setCurrentCompetitionId(savedCompetitionId);
          } else {
            // Use first competition as default
            setCurrentCompetitionId(competitions[0].id);
            if (typeof window !== "undefined") {
              localStorage.setItem(COMPETITION_STORAGE_KEY, competitions[0].id);
            }
          }
        } else {
          setCurrentCompetitionId(null);
        }
      } finally {
        setCompetitionLoading(false);
      }
    },
    [db],
  );

  // Listen for auth changes to load competitions
  useEffect(() => {
    if (!db) return;

    // Check for existing user on mount
    const checkUser = async () => {
      const { data: user } = await db.auth.getUser();
      if (user) {
        await loadUserCompetitions(user.id);
      } else {
        setCompetitionLoading(false);
      }
    };

    checkUser();

    // Subscribe to auth changes
    const { unsubscribe } = db.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        loadUserCompetitions(session.user.id);
      } else if (event === "SIGNED_OUT") {
        setUserCompetitions([]);
        setCurrentCompetitionId(null);
        setCompetitionLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [db, loadUserCompetitions]);

  // Switch competition
  const switchCompetition = useCallback(
    (competitionId: string) => {
      // Verify user has access to this competition
      const hasAccess = userCompetitions.some((c) => c.id === competitionId);
      if (!hasAccess) {
        console.warn(
          "[DB] User does not have access to competition:",
          competitionId,
        );
        return;
      }

      setCurrentCompetitionId(competitionId);
      if (typeof window !== "undefined") {
        localStorage.setItem(COMPETITION_STORAGE_KEY, competitionId);
      }

      // Clear match caches on competition switch
      if (db) {
        db.matchesCache.clearMatchCaches().catch(console.error);
      }
    },
    [userCompetitions, db],
  );

  // Refresh competitions list
  const refreshCompetitions = useCallback(async () => {
    if (!db) return;
    const { data: user } = await db.auth.getUser();
    if (user) {
      await loadUserCompetitions(user.id);
    }
  }, [db, loadUserCompetitions]);

  // Get current competition object
  const currentCompetition = useMemo(() => {
    if (!currentCompetitionId) return null;
    return userCompetitions.find((c) => c.id === currentCompetitionId) || null;
  }, [currentCompetitionId, userCompetitions]);

  // Don't render children until db is ready (client-side only)
  if (typeof window !== "undefined" && !db) {
    return null;
  }

  // For SSR, render children but with a placeholder db
  const contextDb = db || createPlaceholderDb();

  const value: DatabaseContextValue = {
    db: contextDb,
    currentCompetitionId,
    currentCompetition,
    userCompetitions,
    competitionLoading,
    switchCompetition,
    refreshCompetitions,
  };

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
 * Access the full database context (includes competition management)
 */
export function useDatabase(): DatabaseContextValue {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return context;
}

/**
 * Access just the database service (for most components)
 * This is the preferred hook for database operations
 */
export function useDatabaseService(): DatabaseService {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error(
      "useDatabaseService must be used within a DatabaseProvider",
    );
  }
  return context.db;
}

// =====================================================================
// PLACEHOLDER DATABASE SERVICE (for SSR)
// =====================================================================

function createPlaceholderDb(): DatabaseService {
  const notAvailable = () => {
    throw new Error("Database not available during SSR");
  };

  return {
    auth: {
      getUser: notAvailable,
      signInWithPassword: notAvailable,
      signUp: notAvailable,
      signOut: notAvailable,
      updatePassword: notAvailable,
      onAuthStateChange: () => ({ unsubscribe: () => {} }),
    },
    profiles: {
      getProfile: notAvailable,
      getAllProfiles: notAvailable,
      updateProfile: notAvailable,
    },
    competitions: {
      getAll: notAvailable,
      getById: notAvailable,
      create: notAvailable,
      update: notAvailable,
    },
    competitionMembers: {
      getUserCompetitions: notAvailable,
      getCompetitionMembers: notAvailable,
      addMember: notAvailable,
      isMember: notAvailable,
    },
    inviteCodes: {
      getAllInviteCodes: notAvailable,
      getAllInviteCodesForCompetition: notAvailable,
      checkInviteCode: notAvailable,
      createInviteCode: notAvailable,
      useInviteCode: notAvailable,
    },
    predictions: {
      getUserPredictions: notAvailable,
      getAllPredictions: notAvailable,
      savePredictions: notAvailable,
    },
    overrides: {
      getUserOverrides: notAvailable,
      getAllOverrides: notAvailable,
      saveOverrides: notAvailable,
    },
    matchesCache: {
      getCachedMatches: notAvailable,
      getIndividualCachedMatches: notAvailable,
      updateMatchesCache: notAvailable,
      updateIndividualMatchCache: notAvailable,
      clearMatchCaches: notAvailable,
    },
    tournamentSettings: {
      getSettings: notAvailable,
      getSettingsForCompetition: notAvailable,
      updateSettings: notAvailable,
      updateSettingsForCompetition: notAvailable,
      createSettings: notAvailable,
    },
  };
}

// =====================================================================
// VERSION EXPORT
// =====================================================================

export { CURRENT_DB_VERSION };
