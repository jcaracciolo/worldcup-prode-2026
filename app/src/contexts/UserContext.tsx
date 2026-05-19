"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useDatabase } from "@/contexts/DatabaseContext";
import { Profile } from "@/types/database";
import { LCE, lceLoading, lceContent, lceError } from "@/types/lce";
import { useCachedData } from "@/hooks/useCachedData";

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
  const { authService, db } = useDatabase();
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Centralized cache — auto-clears on competition switch (db change)
  const profileCache = useCachedData<string, Profile, Profile[]>(db);

  // Fetch current user on mount and auth changes.
  // Depends on authService (stable) — NOT on db — so competition switches
  // don't trigger a re-fetch / loading flash.
  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      try {
        const { data: profile } = await authService.getUserProfile();
        setUser(profile);
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

  const getAllProfiles = useCallback(async () => {
    const { data } = await db.profiles.getAllProfiles();
    const profiles = data || [];
    profileCache.bulk.set(profiles);
    for (const p of profiles) {
      profileCache.set(p.id, p);
    }
    return profiles;
  }, [db, profileCache]);

  const getCachedAllProfiles = useCallback(
    () => profileCache.bulk.get(),
    [profileCache],
  );

  const getProfile = useCallback(
    async (userId: string) => {
      const { data } = await db.profiles.getProfile(userId);
      if (data) profileCache.set(userId, data);
      return data;
    },
    [db, profileCache],
  );

  const getCachedProfile = useCallback(
    (userId: string) => profileCache.get(userId) ?? null,
    [profileCache],
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

  // Initialize from cache — if we already have this profile, skip loading
  const [state, setState] = useState<LCE<Profile>>(() => {
    if (!userId) return lceContent(null as unknown as Profile);
    const cached = getCachedProfile(userId);
    return cached ? lceContent(cached) : lceLoading();
  });

  useEffect(() => {
    if (!userId) {
      setState(lceContent(null as unknown as Profile));
      return;
    }

    // If we have cached data, keep showing it (don't flash loading)
    const cached = getCachedProfile(userId);
    if (!cached) setState(lceLoading());

    getProfile(userId)
      .then((profile) => {
        setState(profile ? lceContent(profile) : lceError("Profile not found"));
      })
      .catch((err) => {
        setState(lceError(err.message));
      });
  }, [userId, getProfile, getCachedProfile]);

  return state;
}

/**
 * Hook to get all profiles for the current competition.
 * Automatically refetches when competition changes (via db dependency).
 */
export function useAllProfiles(): LCE<Profile[]> {
  const { getAllProfiles, getCachedAllProfiles } = useUser();

  // Initialize from cache — if we already fetched all profiles, skip loading
  const [state, setState] = useState<LCE<Profile[]>>(() => {
    const cached = getCachedAllProfiles();
    return cached ? lceContent(cached) : lceLoading();
  });

  useEffect(() => {
    const cached = getCachedAllProfiles();
    if (!cached) setState(lceLoading());

    getAllProfiles()
      .then((profiles) => {
        setState(lceContent(profiles));
      })
      .catch((err) => {
        setState(lceError(err.message));
      });
  }, [getAllProfiles, getCachedAllProfiles]);

  return state;
}
