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
  AuthService,
  DatabaseService,
  CURRENT_DB_VERSION,
} from "@/lib/services/database-types";
import {
  createAuthService,
  createDatabaseServiceFromClient,
} from "@/lib/services/database-shared";
import { Competition } from "@/types/database";

// =====================================================================
// TYPES
// =====================================================================

const COMPETITION_STORAGE_KEY = "worldcupprode_competition_id";

interface DatabaseContextValue {
  /** Stable auth service — NOT recreated on competition switch */
  authService: AuthService;
  /** The database service instance (competition-scoped, for data mutations) */
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

  // Stable Supabase client reference (singleton, never changes)
  const supabaseClient = useMemo(() => {
    if (typeof window === "undefined") return null;
    return createBrowserClient();
  }, []);

  // Stable auth service — created once, never recreated on competition switch.
  // This prevents auth-dependent consumers (e.g. UserContext) from re-running
  // their effects when only the competition changes.
  const authService = useMemo(() => {
    if (!supabaseClient) return null;
    return createAuthService(supabaseClient);
  }, [supabaseClient]);

  // Stable database service for loading competitions — NOT scoped to any competition.
  // This breaks the circular dependency: loadUserCompetitions → setCompetitionId → db recreated → effect re-runs
  const stableDb = useMemo(() => {
    if (!supabaseClient) return null;
    return createDatabaseServiceFromClient(supabaseClient, null);
  }, [supabaseClient]);

  // Competition-scoped database service.
  // Recreated when competition changes, but auth operations should use
  // authService above instead of db.auth.
  const db = useMemo(() => {
    if (!supabaseClient) return null;
    return createDatabaseServiceFromClient(
      supabaseClient,
      currentCompetitionId,
    );
  }, [supabaseClient, currentCompetitionId]);

  // Load user's competitions after auth (with in-flight dedup)
  const competitionsPromiseRef = React.useRef<Promise<void> | null>(null);

  const loadUserCompetitions = useCallback(
    async (userId: string) => {
      if (!stableDb || !authService) return;

      // Dedup: if already loading, return the existing promise
      if (competitionsPromiseRef.current) {
        return competitionsPromiseRef.current;
      }

      const promise = (async () => {
      setCompetitionLoading(true);
      try {
        const { data: competitions, error } =
          await stableDb.competitionMembers.getUserCompetitions(userId);

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
      })();

      competitionsPromiseRef.current = promise;
      try {
        await promise;
      } finally {
        competitionsPromiseRef.current = null;
      }
    },
    [stableDb, authService],
  );

  // Listen for auth changes to load competitions.
  // Uses authService + stableDb (both stable) so this effect doesn't re-run on competition switch.
  useEffect(() => {
    if (!authService || !stableDb) return;

    // Check for existing user on mount
    const checkUser = async () => {
      const { data: user } = await authService.getUser();
      if (user) {
        await loadUserCompetitions(user.id);
      } else {
        // Unauthenticated guest: pick a default competition so public data
        // (leaderboard, predictions panel, profiles) still loads correctly.
        try {
          const savedId =
            typeof window !== "undefined"
              ? localStorage.getItem(COMPETITION_STORAGE_KEY)
              : null;

          if (savedId) {
            setCurrentCompetitionId(savedId);
          } else {
            const { data: competitions } = await stableDb.competitions.getAll();
            if (competitions && competitions.length > 0) {
              setCurrentCompetitionId(competitions[0].id);
            }
          }
        } catch {
          // Silently fall back — guest will see empty data
        }
        setCompetitionLoading(false);
      }
    };

    checkUser();

    // Subscribe to auth changes
    const { unsubscribe } = authService.onAuthStateChange((event, session) => {
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
  }, [authService, stableDb, loadUserCompetitions]);

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
    if (!authService) return;
    const { data: user } = await authService.getUser();
    if (user) {
      await loadUserCompetitions(user.id);
    }
  }, [authService, loadUserCompetitions]);

  // Get current competition object
  const currentCompetition = useMemo(() => {
    if (!currentCompetitionId) return null;
    return userCompetitions.find((c) => c.id === currentCompetitionId) || null;
  }, [currentCompetitionId, userCompetitions]);

  // Don't render children until db and authService are ready (client-side only)
  if (typeof window !== "undefined" && (!db || !authService)) {
    return null;
  }

  // For SSR, render children but with a placeholder db
  const contextDb = db || createPlaceholderDb();
  const contextAuth = authService || createPlaceholderDb().auth;

  const value: DatabaseContextValue = {
    authService: contextAuth,
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
      getUserProfile: notAvailable,
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
    thirdPlaceOverrides: {
      getUserThirdPlaceOverrides: notAvailable,
      getAllThirdPlaceOverrides: notAvailable,
      saveThirdPlaceOverrides: notAvailable,
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
