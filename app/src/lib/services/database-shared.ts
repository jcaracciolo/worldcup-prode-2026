/**
 * Database Service - Shared Implementation
 *
 * This file contains the core database service implementations that are shared
 * between client and server. It does NOT import any environment-specific code.
 *
 * Version: 2.0.0 - Multi-competition support
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  DatabaseService,
  AuthService,
  AuthUser,
  AuthSession,
  ProfileService,
  CompetitionService,
  CompetitionMemberService,
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
  Competition,
  CompetitionMember,
  InviteCode,
  Prediction,
  GroupStandingsOverride,
  MatchCache,
  TournamentSettings,
} from "@/types/database";

// Type for getting current competition ID (provided by DatabaseContext)
export type GetCompetitionIdFn = () => string | null;

// =====================================================================
// PROFILE SERVICE IMPLEMENTATION
// =====================================================================

export function createProfileService(
  supabase: SupabaseClient,
  getCompetitionId?: GetCompetitionIdFn,
): ProfileService {
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
        const competitionId = getCompetitionId?.();
        
        if (competitionId) {
          // Get only profiles for users in the current competition
          const { data, error } = await supabase
            .from("competition_members")
            .select("profiles(*)")
            .eq("competition_id", competitionId);

          if (error) throw error;
          
          // Extract profiles from the join result
          const profiles = (data || [])
            .map((row: { profiles: Profile }) => row.profiles)
            .filter(Boolean);
          
          return { data: profiles, error: null };
        }

        // Fall back to all profiles if no competition selected
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
      updates: Partial<Omit<Profile, "id" | "created_at">>,
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
// COMPETITION SERVICE IMPLEMENTATION
// =====================================================================

export function createCompetitionService(
  supabase: SupabaseClient,
): CompetitionService {
  return {
    async getAll(): Promise<ServiceResult<Competition[]>> {
      try {
        const { data, error } = await supabase
          .from("competitions")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        return { data: data || [], error: null };
      } catch (error) {
        console.error("[DB] Failed to get all competitions:", error);
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async getById(competitionId: string): Promise<ServiceResult<Competition>> {
      try {
        const { data, error } = await supabase
          .from("competitions")
          .select("*")
          .eq("id", competitionId)
          .single();

        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        console.error(
          `[DB] Failed to get competition ${competitionId}:`,
          error,
        );
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async create(
      name: string,
      description: string | null,
      seasonId: number | null,
      createdBy: string,
    ): Promise<ServiceResult<Competition>> {
      try {
        const { data, error } = await supabase
          .from("competitions")
          .insert({
            name,
            description,
            season_id: seasonId,
            created_by: createdBy,
          })
          .select()
          .single();

        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        console.error("[DB] Failed to create competition:", error);
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async update(
      competitionId: string,
      updates: Partial<Omit<Competition, "id" | "created_at" | "created_by">>,
    ): Promise<ServiceVoidResult> {
      try {
        const { error } = await supabase
          .from("competitions")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", competitionId);

        if (error) throw error;
        return { success: true, error: null };
      } catch (error) {
        console.error(
          `[DB] Failed to update competition ${competitionId}:`,
          error,
        );
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  };
}

// =====================================================================
// COMPETITION MEMBER SERVICE IMPLEMENTATION
// =====================================================================

export function createCompetitionMemberService(
  supabase: SupabaseClient,
): CompetitionMemberService {
  return {
    async getUserCompetitions(
      userId: string,
    ): Promise<ServiceResult<Competition[]>> {
      try {
        n.from("competition_members")
          .select("competition_id, competitions(*)")
          .eq("user_id", userId);

        if (error) throw error;

        // Extract competitions from the joined results
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const competitions = (data || [])
          .map((row: any) => row.competitions as Competition)
          .filter((c): c is Competition => c !== null);

        return { data: competitions, error: null };
      } catch (error) {
        console.error(
          `[DB] Failed to get competitions for user ${userId}:`,
          error,
        );
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async getCompetitionMembers(
      competitionId: string,
    ): Promise<ServiceResult<CompetitionMember[]>> {
      try {
        const { data, error } = await supabase
          .from("competition_members")
          .select("*")
          .eq("competition_id", competitionId);

        if (error) throw error;
        return { data: data || [], error: null };
      } catch (error) {
        console.error(
          `[DB] Failed to get members for competition ${competitionId}:`,
          error,
        );
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async addMember(
      userId: string,
      competitionId: string,
      invitedBy?: string,
    ): Promise<ServiceVoidResult> {
      try {
        const { error } = await supabase.from("competition_members").insert({
          user_id: userId,
          competition_id: competitionId,
          invited_by: invitedBy || null,
        });

        if (error) throw error;
        return { success: true, error: null };
      } catch (error) {
        console.error(
          `[DB] Failed to add member ${userId} to competition ${competitionId}:`,
          error,
        );
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async isMember(
      userId: string,
      competitionId: string,
    ): Promise<ServiceResult<boolean>> {
      try {
        const { data, error } = await supabase
          .from("competition_members")
          .select("user_id")
          .eq("user_id", userId)
          .eq("competition_id", competitionId)
          .single();

        if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found
        return { data: !!data, error: null };
      } catch (error) {
        console.error(`[DB] Failed to check membership:`, error);
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  };
}

// =====================================================================
// INVITE CODE SERVICE IMPLEMENTATION
// =====================================================================

export function createInviteCodeService(
  supabase: SupabaseClient,
  getCompetitionId: GetCompetitionIdFn,
): InviteCodeService {
  return {
    async getAllInviteCodes(): Promise<ServiceResult<InviteCodeWithUsedBy[]>> {
      const competitionId = getCompetitionId();
      if (!competitionId) {
        return { data: [], error: null };
      }
      return this.getAllInviteCodesForCompetition(competitionId);
    },

    async getAllInviteCodesForCompetition(
      competitionId: string,
    ): Promise<ServiceResult<InviteCodeWithUsedBy[]>> {
      try {
        // Get all invite codes for this competition
        const { data: codes, error: codesError } = await supabase
          .from("invite_codes")
          .select("*, competitions(*)")
          .eq("competition_id", competitionId)
          .order("created_at", { ascending: false });

        if (codesError) throw codesError;

        const typedCodes = (codes || []) as (InviteCode & {
          competitions: Competition;
        })[];

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
              (p) => [p.id, p],
            ),
          );

          return {
            data: typedCodes.map((c) => ({
              ...c,
              used_by_profile: c.used_by
                ? profileMap.get(c.used_by) || null
                : null,
              competition: c.competitions || null,
            })),
            error: null,
          };
        }

        return {
          data: typedCodes.map((c) => ({
            ...c,
            used_by_profile: null,
            competition: c.competitions || null,
          })),
          error: null,
        };
      } catch (error) {
        console.error(
          "[DB] Failed to get invite codes for competition:",
          error,
        );
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async checkInviteCode(
      code: string,
    ): Promise<ServiceResult<{ id: string; competition_id: string }>> {
      try {
        const { data, error } = await supabase
          .from("invite_codes")
          .select("id, competition_id")
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
      createdBy: string,
      competitionId: string,
    ): Promise<ServiceResult<InviteCode>> {
      try {
        const { data, error } = await supabase
          .from("invite_codes")
          .insert({
            code,
            created_by: createdBy,
            competition_id: competitionId,
          })
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
      userId: string,
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

export function createPredictionService(
  supabase: SupabaseClient,
  getCompetitionId: GetCompetitionIdFn,
): PredictionService {
  return {
    async getUserPredictions(
      userId: string,
    ): Promise<ServiceResult<Prediction[]>> {
      const competitionId = getCompetitionId();
      if (!competitionId) {
        return { data: [], error: null };
      }
      try {
        const { data, error } = await supabase
          .from("predictions")
          .select("*")
          .eq("user_id", userId)
          .eq("competition_id", competitionId);

        if (error) throw error;
        return { data: data || [], error: null };
      } catch (error) {
        console.error(
          `[DB] Failed to get predictions for user ${userId}:`,
          error,
        );
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async getAllPredictions(): Promise<ServiceResult<Prediction[]>> {
      const competitionId = getCompetitionId();
      if (!competitionId) {
        return { data: [], error: null };
      }
      try {
        const { data, error } = await supabase
          .from("predictions")
          .select("*")
          .eq("competition_id", competitionId);

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
      }>,
    ): Promise<ServiceVoidResult> {
      const competitionId = getCompetitionId();
      if (!competitionId) {
        return { success: false, error: "No competition selected" };
      }
      try {
        const predictionsArray = predictions
          .filter((p) => p.home_goals !== null || p.away_goals !== null)
          .map((p) => ({
            user_id: userId,
            competition_id: competitionId,
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
          .upsert(predictionsArray, {
            onConflict: "user_id,competition_id,match_id",
          });

        if (error) throw error;
        return { success: true, error: null };
      } catch (error) {
        console.error(
          `[DB] Failed to save predictions for user ${userId}:`,
          error,
        );
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

export function createOverrideService(
  supabase: SupabaseClient,
  getCompetitionId: GetCompetitionIdFn,
): OverrideService {
  return {
    async getUserOverrides(
      userId: string,
    ): Promise<ServiceResult<GroupStandingsOverride[]>> {
      const competitionId = getCompetitionId();
      if (!competitionId) {
        return { data: [], error: null };
      }
      try {
        const { data, error } = await supabase
          .from("group_standings_overrides")
          .select("*")
          .eq("user_id", userId)
          .eq("competition_id", competitionId);

        if (error) throw error;
        return { data: data || [], error: null };
      } catch (error) {
        console.error(
          `[DB] Failed to get overrides for user ${userId}:`,
          error,
        );
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async getAllOverrides(): Promise<ServiceResult<GroupStandingsOverride[]>> {
      const competitionId = getCompetitionId();
      if (!competitionId) {
        return { data: [], error: null };
      }
      try {
        const { data, error } = await supabase
          .from("group_standings_overrides")
          .select("*")
          .eq("competition_id", competitionId);

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
      }>,
    ): Promise<ServiceVoidResult> {
      const competitionId = getCompetitionId();
      if (!competitionId) {
        return { success: false, error: "No competition selected" };
      }
      try {
        if (overrides.length === 0) {
          return { success: true, error: null };
        }

        const { error } = await supabase
          .from("group_standings_overrides")
          .upsert(
            overrides.map((o) => ({
              user_id: userId,
              competition_id: competitionId,
              group_name: o.group_name,
              team_id: o.team_id,
              position: o.position,
            })),
            { onConflict: "user_id,competition_id,group_name,team_id" },
          );

        if (error) throw error;
        return { success: true, error: null };
      } catch (error) {
        console.error(
          `[DB] Failed to save overrides for user ${userId}:`,
          error,
        );
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
  supabase: SupabaseClient,
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
      data: unknown,
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
  supabase: SupabaseClient,
  getCompetitionId: GetCompetitionIdFn,
): TournamentSettingsService {
  return {
    async getSettings(): Promise<ServiceResult<TournamentSettings>> {
      const competitionId = getCompetitionId();
      if (!competitionId) {
        return { data: null, error: "No competition selected" };
      }
      return this.getSettingsForCompetition(competitionId);
    },

    async getSettingsForCompetition(
      competitionId: string,
    ): Promise<ServiceResult<TournamentSettings>> {
      try {
        const { data, error } = await supabase
          .from("tournament_settings")
          .select("*")
          .eq("competition_id", competitionId)
          .single();

        if (error && error.code !== "PGRST116") throw error;

        // If no settings exist, return default values
        if (!data) {
          return {
            data: {
              competition_id: competitionId,
              group_stage_locked: false,
              knockout_stage_open: false,
              knockout_stage_locked: false,
              updated_at: new Date().toISOString(),
            },
            error: null,
          };
        }

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
      updates: Partial<
        Omit<TournamentSettings, "competition_id" | "updated_at">
      >,
    ): Promise<ServiceVoidResult> {
      const competitionId = getCompetitionId();
      if (!competitionId) {
        return { success: false, error: "No competition selected" };
      }
      return this.updateSettingsForCompetition(competitionId, updates);
    },

    async updateSettingsForCompetition(
      competitionId: string,
      updates: Partial<
        Omit<TournamentSettings, "competition_id" | "updated_at">
      >,
    ): Promise<ServiceVoidResult> {
      try {
        const { error } = await supabase.from("tournament_settings").upsert({
          competition_id: competitionId,
          ...updates,
          updated_at: new Date().toISOString(),
        });

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

    async createSettings(competitionId: string): Promise<ServiceVoidResult> {
      try {
        const { error } = await supabase.from("tournament_settings").insert({
          competition_id: competitionId,
          group_stage_locked: false,
          knockout_stage_open: false,
          knockout_stage_locked: false,
        });

        if (error) throw error;
        return { success: true, error: null };
      } catch (error) {
        console.error("[DB] Failed to create tournament settings:", error);
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
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
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
      password: string,
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
      metadata?: { display_name?: string },
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
      callback: (event: string, session: AuthSession | null) => void,
    ): { unsubscribe: () => void } {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        callback(
          event,
          session?.user
            ? { user: { id: session.user.id, email: session.user.email } }
            : null,
        );
      });
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
 *
 * @param supabase - The Supabase client instance
 * @param getCompetitionId - Function that returns the current competition ID (for scoped queries)
 */
export function createDatabaseServiceFromClient(
  supabase: SupabaseClient,
  getCompetitionId: GetCompetitionIdFn = () => null,
): DatabaseService {
  return {
    auth: createAuthService(supabase),
    profiles: createProfileService(supabase, getCompetitionId),
    competitions: createCompetitionService(supabase),
    competitionMembers: createCompetitionMemberService(supabase),
    inviteCodes: createInviteCodeService(supabase, getCompetitionId),
    predictions: createPredictionService(supabase, getCompetitionId),
    overrides: createOverrideService(supabase, getCompetitionId),
    matchesCache: createMatchesCacheService(supabase),
    tournamentSettings: createTournamentSettingsService(
      supabase,
      getCompetitionId,
    ),
  };
}
