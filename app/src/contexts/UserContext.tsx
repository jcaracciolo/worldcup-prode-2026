"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { useDatabase } from "@/contexts/DatabaseContext";
import { Profile } from "@/types/database";
import { LCE } from "@/types/lce";
import { useCachedData } from "@/hooks/useCachedData";
import { useRevalidatingResource } from "@/hooks/useRevalidatingResource";

// =====================================================================
// TYPES
// =====================================================================

interface UserContextValue {
  /** Current logged-in user's profile */
  user: Profile | null;
  /** Whether user is loading */
  loading: boolean;
  /** Update current user's profile */
  updateProfile: (
    updates: Partial<Profile>,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Get a specific user's profile by ID (fetches & caches) */
  getProfile: (userId: string) => Promise<Profile | null>;
  /** Get a cached profile instantly (null if not yet fetched) */
  getCachedProfile: (userId: string) => Profile | null;
  /** Get all profiles for current competition */
  getAllProfiles: () => Promise<Profile[]>;
  /** Get cached allProfiles result (null if not yet fetched) */
  getCachedAllProfiles: () => Profile[] | null;
}

const UserContext = createContext<UserContextValue | null>(null);

// =====================================================================
// PROVIDER
// =====================================================================

export function UserProvider({ children }: { children: ReactNode }) {
  const { authService, db, currentCompetitionId } = useDatabase();
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Centralized cache — auto-clears on competition switch (keyed by ID, not db object)
  const profileCache = useCachedData<string, Profile, Profile[]>(currentCompetitionId);
  // Destructure stable callbacks for use in dependency arrays
  const cacheSet = profileCache.set;
  const cacheGet = profileCache.get;
  const cacheBulkSet = profileCache.bulk.set;
  const cacheBulkGet = profileCache.bulk.get;

  // Fetch current user on mount and auth changes.
  // Depends on authService (stable) — NOT on db — so competition switches
  // don't trigger a re-fetch / loading flash.
  useEffect(() => {
    let hasData = false;
    const fetchUser = async () => {
      // Only show loading if we have no data yet (stale-while-revalidate)
      if (!hasData) setLoading(true);
      try {
        const { data: profile } = await authService.getUserProfile();
        setUser(profile);
        hasData = !!profile;
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();

    const { unsubscribe } = authService.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        fetchUser();
      } else if (event === "TOKEN_REFRESHED" && !hasData) {
        // Cross-tab sign-in: this tab was unauthenticated but another tab
        // signed in. TOKEN_REFRESHED fires instead of SIGNED_IN.
        fetchUser();
      }
    });

    return () => unsubscribe();
  }, [authService]);

  const updateProfile = useCallback(
    async (updates: Partial<Profile>) => {
      if (!user) return { success: false, error: "Not logged in" };

      const result = await db.profiles.updateProfile(user.id, updates);
      if (result.success) {
        setUser((prev) => (prev ? { ...prev, ...updates } : null));
        return { success: true };
      }
      return { success: false, error: result.error ?? undefined };
    },
    [user, db],
  );

  // In-flight dedup for getAllProfiles
  const allProfilesPromiseRef = useRef<Promise<Profile[]> | null>(null);

  const getAllProfiles = useCallback(async () => {
    // Return existing in-flight promise if one is already running
    if (allProfilesPromiseRef.current) {
      return allProfilesPromiseRef.current;
    }

    // Safe to return cached data — bulkGet rejects stale entries
    // from a different competition synchronously
    const cached = cacheBulkGet();
    if (cached) return cached;

    const promise = (async () => {
      const { data } = await db.profiles.getAllProfiles();
      const profiles = data || [];
      cacheBulkSet(profiles);
      for (const p of profiles) {
        cacheSet(p.id, p);
      }
      return profiles;
    })();

    allProfilesPromiseRef.current = promise;
    try {
      return await promise;
    } finally {
      allProfilesPromiseRef.current = null;
    }
  }, [db, cacheBulkGet, cacheBulkSet, cacheSet]);

  const getCachedAllProfiles = useCallback(
    () => cacheBulkGet(),
    [cacheBulkGet],
  );

  const getProfile = useCallback(
    async (userId: string) => {
      const { data } = await db.profiles.getProfile(userId);
      if (data) cacheSet(userId, data);
      return data;
    },
    [db, cacheSet],
  );

  const getCachedProfile = useCallback(
    (userId: string) => cacheGet(userId) ?? null,
    [cacheGet],
  );

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        updateProfile,
        getProfile,
        getCachedProfile,
        getAllProfiles,
        getCachedAllProfiles,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

// =====================================================================
// HOOK
// =====================================================================

export function useUser(): UserContextValue {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}

/**
 * Hook to get a specific user's profile.
 * Automatically refetches when competition changes (via db dependency).
 */
export function useProfile(userId: string | null): LCE<Profile> {
  const { getProfile, getCachedProfile } = useUser();

  const fetcher = useCallback(async () => {
    const profile = await getProfile(userId!);
    if (!profile) throw new Error("Profile not found");
    return profile;
  }, [userId, getProfile]);

  const getCached = useCallback(
    () => (userId ? getCachedProfile(userId) : null),
    [userId, getCachedProfile],
  );

  return useRevalidatingResource<Profile>(fetcher, getCached, [fetcher], {
    enabled: !!userId,
    disabledContent: null as unknown as Profile,
  });
}

/**
 * Hook to get all profiles for the current competition.
 * Automatically refetches when competition changes (via db dependency).
 */
export function useAllProfiles(): LCE<Profile[]> {
  const { getAllProfiles, getCachedAllProfiles } = useUser();
  return useRevalidatingResource<Profile[]>(
    getAllProfiles,
    getCachedAllProfiles,
    [getAllProfiles],
  );
}
