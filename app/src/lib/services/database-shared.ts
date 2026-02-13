/**
 * Database Service - Shared Implementation
 *
 * This file contains the core database service implementations that are shared
 * between client and server. It does NOT import any environment-specific code.
 *
 * Version: 1.0.0
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  DatabaseService,
  AuthService,
  AuthUser,
  AuthSession,
  ProfileService,
  InviteCodeService,
  PredictionService,
  OverrideService,
  MatchesCacheService,
  TournamentSettingsService,
  ServiceResult,
  ServiceVoidResult,
  InviteCodeWithUsedBy,
} from "./database-types";
import {
  Profile,
  InviteCode,
  Prediction,
  GroupStandingsOverride,
  MatchCache,
  TournamentSettings,
} from "@/types/database";

// =====================================================================
// PROFILE SERVICE IMPLEMENTATION
// =====================================================================

export function createProfileService(supabase: SupabaseClient): ProfileService {
  return {
    async getProfile(userId: string): Promise<ServiceResult<Profile>> {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        console.error(`[DB] Failed to get profile ${userId}:`, error);
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async getAllProfiles(): Promise<ServiceResult<Profile[]>> {
      try {
        const { data, error } = await supabase.from("profiles").select("*");

        if (error) throw error;
        return { data: data || [], error: null };
      } catch (error) {
        console.error("[DB] Failed to get all profiles:", error);
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async updateProfile(
      userId: string,
      updates: Partial<Omit<Profile, "id" | "created_at">>
    ): Promise<ServiceVoidResult> {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", userId);

        if (error) throw error;
        return { success: true, error: null };
      } catch (error) {
        console.error(`[DB] Failed to update profile ${userId}:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  };
}

// =====================================================================
// INVITE CODE SERVICE IMPLEMENTATION
// =====================================================================

export function createInviteCodeService(supabase: SupabaseClient): InviteCodeService {
  return {
    async getAllInviteCodes(): Promise<ServiceResult<InviteCodeWithUsedBy[]>> {
      try {
        // Get all invite codes
        const { data: codes, error: codesError } = await supabase
          .from("invite_codes")
          .select("*")
          .order("created_at", { ascending: false });

        if (codesError) throw codesError;

        const typedCodes = (codes || []) as InviteCode[];

        // Get used_by profiles
        const usedByIds = typedCodes
          .filter((c) => c.used_by)
          .map((c) => c.used_by) as string[];

        if (usedByIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", usedByIds);

          const profileMap = new Map(
            ((profiles || []) as { id: string; display_name: string }[]).map(
              (p) => [p.id, p]
            )
          );

          return {
            data: typedCodes.map((c) => ({
              ...c,
              used_by_profile: c.used_by
                ? profileMap.get(c.used_by) || null
                : null,
            })),
            error: null,
          };
        }

        return {
          data: typedCodes.map((c) => ({ ...c, used_by_profile: null })),
          error: null,
        };
      } catch (error) {
        console.error("[DB] Failed to get all invite codes:", error);
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async checkInviteCode(
      code: string
    ): Promise<ServiceResult<{ id: string }>> {
      try {
        const { data, error } = await supabase
          .from("invite_codes")
          .select("id")
          .eq("code", code)
          .is("used_by", null)
          .single();

        if (error) throw error;
        return { data, error: null };
      } catch {
        // Not found is expected, don't log as error
        return { data: null, error: null };
      }
    },

    async createInviteCode(
      code: string,
      createdBy: string
    ): Promise<ServiceResult<InviteCode>> {
      try {
        const { data, error } = await supabase
          .from("invite_codes")
          .insert({ code, created_by: createdBy })
          .select()
          .single();

        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        console.error("[DB] Failed to create invite code:", error);
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async useInviteCode(
      code: string,
      userId: string
    ): Promise<ServiceVoidResult> {
      try {
        const { data, error } = await supabase
          .from("invite_codes")
          .update({
            used_by: userId,
            used_at: new Date().toISOString(),
          })
          .eq("code", code)
          .is("used_by", null)
          .select();

        if (error) throw error;

        // Check if any row was actually updated
        if (!data || data.length === 0) {
          return {
            success: false,
            error: "Invite code not found or already used",
          };
        }

        return { success: true, error: null };
      } catch (error) {
        console.error("[DB] Failed to use invite code:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  };
}

// =====================================================================
// PREDICTION SERVICE IMPLEMENTATION
// =====================================================================

export function createPredictionService(supabase: SupabaseClient): PredictionService {
  return {
    async getUserPredictions(
      userId: string
    ): Promise<ServiceResult<Prediction[]>> {
      try {
        const { data, error } = await supabase
          .from("predictions")
          .select("*")
          .eq("user_id", userId);

        if (error) throw error;
        return { data: data || [], error: null };
      } catch (error) {
        console.error(`[DB] Failed to get predictions for user ${userId}:`, error);
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async getAllPredictions(): Promise<ServiceResult<Prediction[]>> {
      try {
        const { data, error } = await supabase.from("predictions").select("*");

        if (error) throw error;
        return { data: data || [], error: null };
      } catch (error) {
        console.error("[DB] Failed to get all predictions:", error);
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async savePredictions(
      userId: string,
      predictions: Array<{
        match_id: number;
        home_goals: number | null;
        away_goals: number | null;
        winner_id: number | null;
      }>
    ): Promise<ServiceVoidResult> {
      try {
        const predictionsArray = predictions
          .filter((p) => p.home_goals !== null || p.away_goals !== null)
          .map((p) => ({
            user_id: userId,
            match_id: p.match_id,
            home_goals: p.home_goals,
            away_goals: p.away_goals,
            winner_id: p.winner_id,
          }));

        if (predictionsArray.length === 0) {
          return { success: true, error: null };
        }

        const { error } = await supabase
          .from("predictions")
          .upsert(predictionsArray, { onConflict: "user_id,match_id" });

        if (error) throw error;
        return { success: true, error: null };
      } catch (error) {
        console.error(`[DB] Failed to save predictions for user ${userId}:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  };
}

// =====================================================================
// OVERRIDE SERVICE IMPLEMENTATION
// =====================================================================

export function createOverrideService(supabase: SupabaseClient): OverrideService {
  return {
    async getUserOverrides(
      userId: string
    ): Promise<ServiceResult<GroupStandingsOverride[]>> {
      try {
        const { data, error } = await supabase
          .from("group_standings_overrides")
          .select("*")
          .eq("user_id", userId);

        if (error) throw error;
        return { data: data || [], error: null };
      } catch (error) {
        console.error(`[DB] Failed to get overrides for user ${userId}:`, error);
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async getAllOverrides(): Promise<ServiceResult<GroupStandingsOverride[]>> {
      try {
        const { data, error } = await supabase
          .from("group_standings_overrides")
          .select("*");

        if (error) throw error;
        return { data: data || [], error: null };
      } catch (error) {
        console.error("[DB] Failed to get all overrides:", error);
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async saveOverrides(
      userId: string,
      overrides: Array<{
        group_name: string;
        team_id: number;
        position: number;
      }>
    ): Promise<ServiceVoidResult> {
      try {
        if (overrides.length === 0) {
          return { success: true, error: null };
        }

        const { error } = await supabase
          .from("group_standings_overrides")
          .upsert(
            overrides.map((o) => ({
              user_id: userId,
              group_name: o.group_name,
              team_id: o.team_id,
              position: o.position,
            })),
            { onConflict: "user_id,group_name,team_id" }
          );

        if (error) throw error;
        return { success: true, error: null };
      } catch (error) {
        console.error(`[DB] Failed to save overrides for user ${userId}:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  };
}

// =====================================================================
// MATCHES CACHE SERVICE IMPLEMENTATION
// =====================================================================

export function createMatchesCacheService(
  supabase: SupabaseClient
): MatchesCacheService {
  return {
    async getCachedMatches(): Promise<ServiceResult<MatchCache>> {
      try {
        const { data, error } = await supabase
          .from("matches_cache")
          .select("*")
          .eq("match_id", 0) // match_id 0 = full matches list cache
          .single();

        if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found
        return { data: data || null, error: null };
      } catch (error) {
        console.error("[DB] Failed to get cached matches:", error);
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async getIndividualCachedMatches(): Promise<ServiceResult<MatchCache[]>> {
      try {
        const { data, error } = await supabase
          .from("matches_cache")
          .select("*")
          .neq("match_id", 0);

        if (error) throw error;
        return { data: data || [], error: null };
      } catch (error) {
        console.error("[DB] Failed to get individual cached matches:", error);
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async updateMatchesCache(data: unknown): Promise<ServiceVoidResult> {
      try {
        const now = new Date().toISOString();
        const { error } = await supabase.from("matches_cache").upsert({
          match_id: 0,
          data: { matches: data, fetchedAt: now },
          updated_at: now,
        });

        if (error) throw error;
        return { success: true, error: null };
      } catch (error) {
        console.error("[DB] Failed to update matches cache:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async updateIndividualMatchCache(
      matchId: number,
      data: unknown
    ): Promise<ServiceVoidResult> {
      try {
        const { error } = await supabase.from("matches_cache").upsert({
          match_id: matchId,
          data,
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;
        return { success: true, error: null };
      } catch (error) {
        console.error(`[DB] Failed to update match cache ${matchId}:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async clearMatchCaches(): Promise<ServiceVoidResult> {
      try {
        const { error } = await supabase
          .from("matches_cache")
          .delete()
          .neq("match_id", -999); // Delete all (neq with impossible value)

        if (error) throw error;
        return { success: true, error: null };
      } catch (error) {
        console.error("[DB] Failed to clear match caches:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  };
}

// =====================================================================
// TOURNAMENT SETTINGS SERVICE IMPLEMENTATION
// =====================================================================

export function createTournamentSettingsService(
  supabase: SupabaseClient
): TournamentSettingsService {
  return {
    async getSettings(): Promise<ServiceResult<TournamentSettings>> {
      try {
        const { data, error } = await supabase
          .from("tournament_settings")
          .select("*")
          .eq("id", 1)
          .single();

        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        console.error("[DB] Failed to get tournament settings:", error);
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async updateSettings(
      updates: Partial<Omit<TournamentSettings, "id" | "updated_at">>
    ): Promise<ServiceVoidResult> {
      try {
        const { error } = await supabase
          .from("tournament_settings")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", 1);

        if (error) throw error;
        return { success: true, error: null };
      } catch (error) {
        console.error("[DB] Failed to update tournament settings:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  };
}

// =====================================================================
// AUTH SERVICE IMPLEMENTATION
// =====================================================================

export function createAuthService(supabase: SupabaseClient): AuthService {
  return {
    async getUser(): Promise<ServiceResult<AuthUser>> {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!user) return { data: null, error: null };
        return {
          data: { id: user.id, email: user.email },
          error: null,
        };
      } catch (error) {
        console.error("[Auth] Failed to get user:", error);
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async signInWithPassword(
      email: string,
      password: string
    ): Promise<ServiceResult<AuthSession>> {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (!data.user) return { data: null, error: "No user returned" };
        return {
          data: {
            user: { id: data.user.id, email: data.user.email },
          },
          error: null,
        };
      } catch (error) {
        console.error("[Auth] Failed to sign in:", error);
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async signUp(
      email: string,
      password: string,
      metadata?: { display_name?: string }
    ): Promise<ServiceResult<AuthUser>> {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: metadata ? { data: metadata } : undefined,
        });
        if (error) throw error;
        if (!data.user) return { data: null, error: "No user returned" };
        return {
          data: { id: data.user.id, email: data.user.email },
          error: null,
        };
      } catch (error) {
        console.error("[Auth] Failed to sign up:", error);
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async signOut(): Promise<ServiceVoidResult> {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return { success: true, error: null };
      } catch (error) {
        console.error("[Auth] Failed to sign out:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async updatePassword(newPassword: string): Promise<ServiceVoidResult> {
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (error) throw error;
        return { success: true, error: null };
      } catch (error) {
        console.error("[Auth] Failed to update password:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    onAuthStateChange(
      callback: (event: string, session: AuthSession | null) => void
    ): { unsubscribe: () => void } {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          callback(
            event,
            session?.user
              ? { user: { id: session.user.id, email: session.user.email } }
              : null
          );
        }
      );
      return { unsubscribe: () => subscription.unsubscribe() };
    },
  };
}

// =====================================================================
// DATABASE SERVICE FACTORY
// =====================================================================

/**
 * Create a DatabaseService from a Supabase client
 * This factory is used by both client and server implementations
 */
export function createDatabaseServiceFromClient(
  supabase: SupabaseClient
): DatabaseService {
  return {
    auth: createAuthService(supabase),
    profiles: createProfileService(supabase),
    inviteCodes: createInviteCodeService(supabase),
    predictions: createPredictionService(supabase),
    overrides: createOverrideService(supabase),
    matchesCache: createMatchesCacheService(supabase),
    tournamentSettings: createTournamentSettingsService(supabase),
  };
}
