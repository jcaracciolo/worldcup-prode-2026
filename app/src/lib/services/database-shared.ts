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
  ThirdPlaceOverrideService,
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
  ThirdPlaceOverride,
  MatchCache,
  TournamentSettings,
} from "@/types/database";

// =====================================================================
// HELPERS
// =====================================================================

/**
 * Supabase returns at most 1000 rows by default (PostgREST limit).
 * This helper paginates through all results to ensure no data is lost.
 */
async function fetchAllRows<T>(
  queryBuilder: ReturnType<SupabaseClient["from"]>,
  selectColumns: string,
  filters: Record<string, string>,
  pageSize = 1000,
): Promise<{ data: T[]; error: string | null }> {
  const allData: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = queryBuilder
      .select(selectColumns)
      .range(from, from + pageSize - 1);
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
    const { data, error } = await query;
    if (error) return { data: [], error: error.message };
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData.push(...(data as T[]));
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        from += pageSize;
      }
    }
  }

  return { data: allData, error: null };
}

// =====================================================================
// TYPES
// =====================================================================

/** Function type for getting the current competition ID */
export type GetCompetitionIdFn = () => string | null;

// =====================================================================
// PROFILE SERVICE IMPLEMENTATION
// =====================================================================

export function createProfileService(
  supabase: SupabaseClient,
  competitionId?: string | null,
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

    async getAllProfiles(
      overrideCompetitionId?: string,
    ): Promise<ServiceResult<Profile[]>> {
      try {
        const effectiveCompetitionId = overrideCompetitionId ?? competitionId;

        if (effectiveCompetitionId) {
          // Get only profiles for users in the current competition
          // Must specify the FK relationship since there are two (user_id and invited_by)
          const { data, error } = await supabase
            .from("competition_members")
            .select("user_id, profiles!competition_members_user_id_fkey(*)")
            .eq("competition_id", effectiveCompetitionId);

          if (error) {
            console.error(
              "[DB] Competition members query error:",
              error.message,
            );
            throw new Error(
              error.message || "Failed to query competition members",
            );
          }

          // Extract profiles from the join result (using .single() FK returns object, otherwise returns array)
          const profiles = (data || [])
            .map((row) => {
              const profile = row.profiles;
              // Handle both array (default) and object (single FK) cases
              return Array.isArray(profile) ? profile[0] : profile;
            })
            .filter((p): p is Profile => p !== null && p !== undefined);

          return { data: profiles, error: null };
        }

        // Fall back to all profiles if no competition selected
        const { data, error } = await supabase.from("profiles").select("*");

        if (error) {
          throw new Error(error.message || "Failed to query profiles");
        }
        return { data: data || [], error: null };
      } catch (error) {
        console.error("[DB] Failed to get all profiles:", error);
        return {
          data: null,
          error: error instanceof Error ? error.message : String(error),
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
        const { data, error } = await supabase
          .from("competition_members")
          .select("competition_id, competitions(*)")
          .eq("user_id", userId);

        if (error) throw error;

        // Extract competitions from the joined results
        const competitions = (data || [])
          .map((row) => {
            const comp = row.competitions;
            // Handle both array (default) and object (single FK) cases
            return Array.isArray(comp) ? comp[0] : comp;
          })
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
  competitionId: string | null,
): InviteCodeService {
  return {
    async getAllInviteCodes(): Promise<ServiceResult<InviteCodeWithUsedBy[]>> {
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
  competitionId: string | null,
): PredictionService {
  return {
    async getUserPredictions(
      userId: string,
    ): Promise<ServiceResult<Prediction[]>> {
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
      if (!competitionId) {
        return { data: [], error: null };
      }
      try {
        // Use paginated fetch to avoid Supabase's default 1000-row limit
        const result = await fetchAllRows<Prediction>(
          supabase.from("predictions"),
          "*",
          { competition_id: competitionId },
        );

        if (result.error) throw new Error(result.error);
        return { data: result.data, error: null };
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
        penalty_winner: "HOME" | "AWAY" | null;
      }>,
    ): Promise<ServiceVoidResult> {
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
            penalty_winner: p.penalty_winner,
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
  competitionId: string | null,
): OverrideService {
  return {
    async getUserOverrides(
      userId: string,
    ): Promise<ServiceResult<GroupStandingsOverride[]>> {
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
      if (!competitionId) {
        return { data: [], error: null };
      }
      try {
        // Use paginated fetch to avoid Supabase's default 1000-row limit
        const result = await fetchAllRows<GroupStandingsOverride>(
          supabase.from("group_standings_overrides"),
          "*",
          { competition_id: competitionId },
        );

        if (result.error) throw new Error(result.error);
        return { data: result.data, error: null };
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
// THIRD PLACE OVERRIDE SERVICE IMPLEMENTATION
// =====================================================================

export function createThirdPlaceOverrideService(
  supabase: SupabaseClient,
  competitionId: string | null,
): ThirdPlaceOverrideService {
  return {
    async getUserThirdPlaceOverrides(
      userId: string,
    ): Promise<ServiceResult<ThirdPlaceOverride[]>> {
      if (!competitionId) {
        return { data: [], error: null };
      }
      try {
        const { data, error } = await supabase
          .from("third_place_overrides")
          .select("*")
          .eq("user_id", userId)
          .eq("competition_id", competitionId);

        if (error) throw error;
        return { data: data || [], error: null };
      } catch (error) {
        console.error(
          `[DB] Failed to get third-place overrides for user ${userId}:`,
          error,
        );
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async getAllThirdPlaceOverrides(): Promise<
      ServiceResult<ThirdPlaceOverride[]>
    > {
      if (!competitionId) {
        return { data: [], error: null };
      }
      try {
        const result = await fetchAllRows<ThirdPlaceOverride>(
          supabase.from("third_place_overrides"),
          "*",
          { competition_id: competitionId },
        );

        if (result.error) throw new Error(result.error);
        return { data: result.data, error: null };
      } catch (error) {
        console.error("[DB] Failed to get all third-place overrides:", error);
        return {
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    async saveThirdPlaceOverrides(
      userId: string,
      overrides: Array<{
        group_name: string;
        rank: number;
      }>,
    ): Promise<ServiceVoidResult> {
      if (!competitionId) {
        return { success: false, error: "No competition selected" };
      }
      try {
        if (overrides.length === 0) {
          return { success: true, error: null };
        }

        const { error } = await supabase
          .from("third_place_overrides")
          .upsert(
            overrides.map((o) => ({
              user_id: userId,
              competition_id: competitionId,
              group_name: o.group_name,
              rank: o.rank,
            })),
            { onConflict: "user_id,competition_id,group_name" },
          );

        if (error) throw error;
        return { success: true, error: null };
      } catch (error) {
        console.error(
          `[DB] Failed to save third-place overrides for user ${userId}:`,
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
  competitionId: string | null,
): TournamentSettingsService {
  return {
    async getSettings(): Promise<ServiceResult<TournamentSettings>> {
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
        // AuthSessionMissingError is expected when no user is logged in — not a real error
        const isSessionMissing =
          error instanceof Error && error.name === "AuthSessionMissingError";
        if (!isSessionMissing) {
          console.error("[Auth] Failed to get user:", error);
        }
        return {
          data: null,
          error: isSessionMissing
            ? null
            : error instanceof Error
              ? error.message
              : "Unknown error",
        };
      }
    },

    async getUserProfile(): Promise<ServiceResult<Profile>> {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) return { data: null, error: null };

        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        const isSessionMissing =
          error instanceof Error && error.name === "AuthSessionMissingError";
        if (!isSessionMissing) {
          console.error("[Auth] Failed to get user profile:", error);
        }
        return {
          data: null,
          error: isSessionMissing
            ? null
            : error instanceof Error
              ? error.message
              : "Unknown error",
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
        // Use 'local' scope to only sign out the current browser/tab.
        // 'global' scope invalidates sessions on ALL devices/tabs which can
        // cause unexpected auth loss in other open tabs.
        const { error } = await supabase.auth.signOut({ scope: "local" });
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
 * @param competitionId - The current competition ID (for scoped queries)
 */
export function createDatabaseServiceFromClient(
  supabase: SupabaseClient,
  competitionId: string | null = null,
): DatabaseService {
  return {
    auth: createAuthService(supabase),
    profiles: createProfileService(supabase, competitionId),
    competitions: createCompetitionService(supabase),
    competitionMembers: createCompetitionMemberService(supabase),
    inviteCodes: createInviteCodeService(supabase, competitionId),
    predictions: createPredictionService(supabase, competitionId),
    overrides: createOverrideService(supabase, competitionId),
    thirdPlaceOverrides: createThirdPlaceOverrideService(supabase, competitionId),
    matchesCache: createMatchesCacheService(supabase),
    tournamentSettings: createTournamentSettingsService(
      supabase,
      competitionId,
    ),
  };
}
