/**
 * Database Service Types
 *
 * Type definitions for all database operations.
 * This interface allows for versioning and swapping implementations.
 */

import {
  Profile,
  InviteCode,
  Prediction,
  GroupStandingsOverride,
  MatchCache,
  TournamentSettings,
} from "@/types/database";

// =====================================================================
// RESULT TYPES
// =====================================================================

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

export interface ServiceVoidResult {
  success: boolean;
  error: string | null;
}

// =====================================================================
// PROFILE OPERATIONS
// =====================================================================

export interface ProfileService {
  /** Get a profile by ID */
  getProfile(userId: string): Promise<ServiceResult<Profile>>;

  /** Get all profiles */
  getAllProfiles(): Promise<ServiceResult<Profile[]>>;

  /** Update a profile */
  updateProfile(
    userId: string,
    updates: Partial<Omit<Profile, "id" | "created_at">>
  ): Promise<ServiceVoidResult>;
}

// =====================================================================
// INVITE CODE OPERATIONS
// =====================================================================

export interface InviteCodeWithUsedBy extends InviteCode {
  used_by_profile?: { id: string; display_name: string } | null;
}

export interface InviteCodeService {
  /** Get all invite codes with used_by profile info */
  getAllInviteCodes(): Promise<ServiceResult<InviteCodeWithUsedBy[]>>;

  /** Check if an invite code is valid (exists and unused) */
  checkInviteCode(code: string): Promise<ServiceResult<{ id: string }>>;

  /** Create a new invite code */
  createInviteCode(
    code: string,
    createdBy: string
  ): Promise<ServiceResult<InviteCode>>;

  /** Mark an invite code as used */
  useInviteCode(code: string, userId: string): Promise<ServiceVoidResult>;
}

// =====================================================================
// PREDICTION OPERATIONS
// =====================================================================

export interface PredictionService {
  /** Get predictions for a specific user */
  getUserPredictions(userId: string): Promise<ServiceResult<Prediction[]>>;

  /** Get all predictions (for leaderboard) */
  getAllPredictions(): Promise<ServiceResult<Prediction[]>>;

  /** Save/upsert predictions for a user */
  savePredictions(
    userId: string,
    predictions: Array<{
      match_id: number;
      home_goals: number | null;
      away_goals: number | null;
      winner_id: number | null;
    }>
  ): Promise<ServiceVoidResult>;
}

// =====================================================================
// GROUP STANDINGS OVERRIDE OPERATIONS
// =====================================================================

export interface OverrideService {
  /** Get overrides for a specific user */
  getUserOverrides(
    userId: string
  ): Promise<ServiceResult<GroupStandingsOverride[]>>;

  /** Get all overrides (for leaderboard) */
  getAllOverrides(): Promise<ServiceResult<GroupStandingsOverride[]>>;

  /** Save/upsert overrides for a user */
  saveOverrides(
    userId: string,
    overrides: Array<{
      group_name: string;
      team_id: number;
      position: number;
    }>
  ): Promise<ServiceVoidResult>;
}

// =====================================================================
// MATCHES CACHE OPERATIONS
// =====================================================================

export interface MatchesCacheService {
  /** Get cached matches list (match_id = 0) */
  getCachedMatches(): Promise<ServiceResult<MatchCache>>;

  /** Get individual cached match results */
  getIndividualCachedMatches(): Promise<ServiceResult<MatchCache[]>>;

  /** Update matches cache */
  updateMatchesCache(data: unknown): Promise<ServiceVoidResult>;

  /** Update individual match cache */
  updateIndividualMatchCache(
    matchId: number,
    data: unknown
  ): Promise<ServiceVoidResult>;

  /** Clear all match caches */
  clearMatchCaches(): Promise<ServiceVoidResult>;
}

// =====================================================================
// TOURNAMENT SETTINGS OPERATIONS
// =====================================================================

export interface TournamentSettingsService {
  /** Get tournament settings */
  getSettings(): Promise<ServiceResult<TournamentSettings>>;

  /** Update tournament settings */
  updateSettings(
    updates: Partial<Omit<TournamentSettings, "id" | "updated_at">>
  ): Promise<ServiceVoidResult>;
}

// =====================================================================
// AUTH OPERATIONS
// =====================================================================

export interface AuthUser {
  id: string;
  email?: string;
}

export interface AuthSession {
  user: AuthUser;
}

export interface AuthService {
  /** Get the current authenticated user */
  getUser(): Promise<ServiceResult<AuthUser>>;

  /** Sign in with email and password */
  signInWithPassword(
    email: string,
    password: string
  ): Promise<ServiceResult<AuthSession>>;

  /** Sign up with email and password */
  signUp(
    email: string,
    password: string,
    metadata?: { display_name?: string }
  ): Promise<ServiceResult<AuthUser>>;

  /** Sign out the current user */
  signOut(): Promise<ServiceVoidResult>;

  /** Update user password */
  updatePassword(newPassword: string): Promise<ServiceVoidResult>;

  /** Subscribe to auth state changes */
  onAuthStateChange(
    callback: (event: string, session: AuthSession | null) => void
  ): { unsubscribe: () => void };
}

// =====================================================================
// COMBINED DATABASE SERVICE INTERFACE
// =====================================================================

export interface DatabaseService {
  // Auth operations
  auth: AuthService;

  // Profile operations
  profiles: ProfileService;

  // Invite code operations
  inviteCodes: InviteCodeService;

  // Prediction operations
  predictions: PredictionService;

  // Override operations
  overrides: OverrideService;

  // Matches cache operations (typically server-side only)
  matchesCache: MatchesCacheService;

  // Tournament settings operations
  tournamentSettings: TournamentSettingsService;
}

// =====================================================================
// VERSION INFO
// =====================================================================

export interface DatabaseServiceVersion {
  version: string;
  description: string;
}

export const CURRENT_DB_VERSION: DatabaseServiceVersion = {
  version: "1.0.0",
  description: "Supabase PostgreSQL implementation",
};
