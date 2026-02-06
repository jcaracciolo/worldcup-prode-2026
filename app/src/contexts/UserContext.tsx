"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types/database";

interface UserContextValue {
  user: Profile | null;
  loading: boolean;
  refetch: () => Promise<void>;
  /** Update current user's profile */
  updateProfile: (updates: Partial<Profile>) => Promise<{ success: boolean; error?: string }>;
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
  const [profileCache, setProfileCache] = useState<Map<string, Profile>>(new Map());
  const [allProfiles, setAllProfiles] = useState<Profile[] | null>(null);
  const supabase = createClient();

  const fetchUser = async () => {
    setLoading(true);
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .single();
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
    async (updates: Partial<Profile>): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: "Not logged in" };

      try {
        const { error } = await supabase
          .from("profiles")
          .update(updates)
          .eq("id", user.id);

        if (error) throw error;

        // Update local state
        const updatedUser = { ...user, ...updates };
        setUser(updatedUser);
        setProfileCache((prev) => new Map(prev).set(user.id, updatedUser));

        return { success: true };
      } catch (error) {
        console.error("Failed to update profile:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to update profile",
        };
      }
    },
    [user, supabase],
  );

  // Get a profile by user ID (cached)
  const getProfile = useCallback(
    async (userId: string): Promise<Profile | null> => {
      // Check cache first
      const cached = profileCache.get(userId);
      if (cached) return cached;

      try {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (data) {
          setProfileCache((prev) => new Map(prev).set(userId, data));
        }
        return data;
      } catch (error) {
        console.error(`Failed to fetch profile ${userId}:`, error);
        return null;
      }
    },
    [profileCache, supabase],
  );

  // Get all profiles (for leaderboard, cached)
  const getAllProfiles = useCallback(async (): Promise<Profile[]> => {
    // Return cached if available
    if (allProfiles) return allProfiles;

    try {
      const { data } = await supabase.from("profiles").select("*");
      const profiles = (data || []) as Profile[];
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
  }, [allProfiles, supabase]);

  useEffect(() => {
    fetchUser();

    // Listen for auth changes (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        fetchUser();
      }
    });

    return () => subscription.unsubscribe();
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
