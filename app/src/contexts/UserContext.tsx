"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useDatabaseService, useDatabase } from "@/contexts/DatabaseContext";
import { Profile } from "@/types/database";

interface UserContextValue {
  user: Profile | null;
  loading: boolean;
  refetch: () => Promise<void>;
  /** Update current user's profile */
  updateProfile: (
    updates: Partial<Profile>,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Get a profile by user ID (cached) */
  getProfile: (userId: string) => Promise<Profile | null>;
  /** Get all profiles (cached, for leaderboard) */
  getAllProfiles: () => Promise<Profile[]>;
}

const UserContext = createContext<UserContextValue | null>(null);

interface UserProviderProps {
  children: ReactNode;
}

/**
 * Provides the current authenticated user's profile
 * Also provides profile fetching and caching for other users
 */
export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileCache, setProfileCache] = useState<Map<string, Profile>>(
    new Map(),
  );
  const [allProfiles, setAllProfiles] = useState<Profile[] | null>(null);
  
  // Database service for all operations (auth + data)
  const db = useDatabaseService();
  const { currentCompetitionId } = useDatabase();

  // Clear profiles cache when competition changes
  useEffect(() => {
    setAllProfiles(null);
  }, [currentCompetitionId]);

  const fetchUser = async (isRefresh = false) => {
    // Only show loading on initial fetch, not on refresh
    if (!isRefresh) {
      setLoading(true);
    }
    try {
      // Use database service for auth
      const { data: authUser } = await db.auth.getUser();

      if (authUser) {
        // Use database service for profile fetch
        const { data: profile } = await db.profiles.getProfile(authUser.id);
        setUser(profile);
        // Also cache the current user's profile
        if (profile) {
          setProfileCache((prev) => new Map(prev).set(profile.id, profile));
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Update current user's profile
  const updateProfile = useCallback(
    async (
      updates: Partial<Profile>,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: "Not logged in" };

      try {
        // Use database service for profile update
        const result = await db.profiles.updateProfile(user.id, updates);

        if (!result.success) {
          throw new Error(result.error || "Failed to update profile");
        }

        // Update local state
        const updatedUser = { ...user, ...updates };
        setUser(updatedUser);
        setProfileCache((prev) => new Map(prev).set(user.id, updatedUser));

        return { success: true };
      } catch (error) {
        console.error("Failed to update profile:", error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to update profile",
        };
      }
    },
    [user, db],
  );

  // Get a profile by user ID (cached)
  const getProfile = useCallback(
    async (userId: string): Promise<Profile | null> => {
      // Check cache first
      const cached = profileCache.get(userId);
      if (cached) return cached;

      try {
        // Use database service for profile fetch
        const { data } = await db.profiles.getProfile(userId);

        if (data) {
          setProfileCache((prev) => new Map(prev).set(userId, data));
        }
        return data;
      } catch (error) {
        console.error(`Failed to fetch profile ${userId}:`, error);
        return null;
      }
    },
    [profileCache, db],
  );

  // Get all profiles (for leaderboard, cached)
  const getAllProfiles = useCallback(async (): Promise<Profile[]> => {
    // Return cached if available
    if (allProfiles) return allProfiles;

    try {
      // Use database service for all profiles fetch
      const { data } = await db.profiles.getAllProfiles();
      const profiles = data || [];
      setAllProfiles(profiles);
      // Also populate individual cache
      profiles.forEach((p) => {
        setProfileCache((prev) => new Map(prev).set(p.id, p));
      });
      return profiles;
    } catch (error) {
      console.error("Failed to fetch all profiles:", error);
      return [];
    }
  }, [allProfiles, db]);

  useEffect(() => {
    fetchUser();

    // Listen for auth changes (login/logout) via database service
    const { unsubscribe } = db.auth.onAuthStateChange((event: string) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        fetchUser();
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        refetch: fetchUser,
        updateProfile,
        getProfile,
        getAllProfiles,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

/**
 * Hook to get the current user
 */
export function useUser(): UserContextValue {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
