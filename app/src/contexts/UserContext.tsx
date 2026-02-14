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
  /** Get a specific user's profile by ID */
  getProfile: (userId: string) => Promise<Profile | null>;
  /** Get all profiles for current competition */
  getAllProfiles: () => Promise<Profile[]>;
}

const UserContext = createContext<UserContextValue | null>(null);

// =====================================================================
// PROVIDER
// =====================================================================

export function UserProvider({ children }: { children: ReactNode }) {
  const { db } = useDatabase();
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch current user on mount and auth changes
  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      try {
        const { data: authUser } = await db.auth.getUser();
        if (authUser) {
          const { data: profile } = await db.profiles.getProfile(authUser.id);
          setUser(profile);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();

    const { unsubscribe } = db.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        fetchUser();
      }
    });

    return () => unsubscribe();
  }, [db]);

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
    return data || [];
  }, [db]);

  const getProfile = useCallback(
    async (userId: string) => {
      const { data } = await db.profiles.getProfile(userId);
      return data;
    },
    [db],
  );

  return (
    <UserContext.Provider
      value={{ user, loading, updateProfile, getProfile, getAllProfiles }}
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
