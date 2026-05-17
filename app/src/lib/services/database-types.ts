/**
 * Database Service Types
 *
 * Type definitions for all database operations.
 * This interface allows for versioning and swapping implementations.
 */

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

  /** Get all profiles, optionally override competition filter */
  getAllProfiles(
    overrideCompetitionId?: string,
  ): Promise<ServiceResult<Profile[]>>;

  /** Update a profile */
  updateProfile(
    userId: string,
    updates: Partial<Omit<Profile, "id" | "created_at">>,
  ): Promise<ServiceVoidResult>;
}

// =====================================================================
// COMPETITION OPERATIONS
// =====================================================================

export interface CompetitionService {
  /** Get all competitions */
  getAll(): Promise<ServiceResult<Competition[]>>;

  /** Get a competition by ID */
  getById(competitionId: string): Promise<ServiceResult<Competition>>;

  /** Create a new competition (admin only) */
  create(
    name: string,
    description: string | null,
    seasonId: number | null,
    createdBy: string,
  ): Promise<ServiceResult<Competition>>;

  /** Update a competition (admin only) */
  update(
    competitionId: string,
    updates: Partial<Omit<Competition, "id" | "created_at" | "created_by">>,
  ): Promise<ServiceVoidResult>;
}

// =====================================================================
// COMPETITION MEMBER OPERATIONS
// =====================================================================

export interface CompetitionMemberService {
  /** Get all competitions a user belongs to */
  getUserCompetitions(userId: string): Promise<ServiceResult<Competition[]>>;

  /** Get all members of a competition */
  getCompetitionMembers(
    competitionId: string,
  ): Promise<ServiceResult<CompetitionMember[]>>;

  /** Add a user to a competition */
  addMember(
    userId: string,
    competitionId: string,
    invitedBy?: string,
  ): Promise<ServiceVoidResult>;

  /** Check if a user is a member of a competition */
  isMember(
    userId: string,
    competitionId: string,
  ): Promise<ServiceResult<boolean>>;
}

// =====================================================================
// INVITE CODE OPERATIONS
// =====================================================================

export interface InviteCodeWithUsedBy extends InviteCode {
  used_by_profile?: { id: string; display_name: string } | null;
  competition?: Competition | null;
}

export interface InviteCodeService {
  /** Get all invite codes with used_by profile info (for current competition) */
  getAllInviteCodes(): Promise<ServiceResult<InviteCodeWithUsedBy[]>>;

  /** Get all invite codes for a specific competition (admin) */
  getAllInviteCodesForCompetition(
    competitionId: string,
  ): Promise<ServiceResult<InviteCodeWithUsedBy[]>>;

  /** Check if an invite code is valid (exists and unused) */
  checkInviteCode(
    code: string,
  ): Promise<ServiceResult<{ id: string; competition_id: string }>>;

  /** Create a new invite code for a specific competition */
  createInviteCode(
    code: string,
    createdBy: string,
    competitionId: string,
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
      penalty_winner: "HOME" | "AWAY" | null;
    }>,
  ): Promise<ServiceVoidResult>;
}

// =====================================================================
// GROUP STANDINGS OVERRIDE OPERATIONS
// =====================================================================

export interface OverrideService {
  /** Get overrides for a specific user */
  getUserOverrides(
    userId: string,
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
    }>,
  ): Promise<ServiceVoidResult>;
}

// =====================================================================
// THIRD PLACE OVERRIDE OPERATIONS
// =====================================================================

export interface ThirdPlaceOverrideService {
  /** Get third-place overrides for a specific user */
  getUserThirdPlaceOverrides(
    userId: string,
  ): Promise<ServiceResult<ThirdPlaceOverride[]>>;

  /** Get all third-place overrides (for leaderboard) */
  getAllThirdPlaceOverrides(): Promise<ServiceResult<ThirdPlaceOverride[]>>;

  /** Save/upsert third-place overrides for a user */
  saveThirdPlaceOverrides(
    userId: string,
    overrides: Array<{
      group_name: string;
      rank: number;
    }>,
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
    data: unknown,
  ): Promise<ServiceVoidResult>;

  /** Clear all match caches */
  clearMatchCaches(): Promise<ServiceVoidResult>;
}

// =====================================================================
// TOURNAMENT SETTINGS OPERATIONS
// =====================================================================

export interface TournamentSettingsService {
  /** Get tournament settings (for current competition) */
  getSettings(): Promise<ServiceResult<TournamentSettings>>;

  /** Get tournament settings for a specific competition */
  getSettingsForCompetition(
    competitionId: string,
  ): Promise<ServiceResult<TournamentSettings>>;

  /** Update tournament settings (for current competition) */
  updateSettings(
    updates: Partial<Omit<TournamentSettings, "competition_id" | "updated_at">>,
  ): Promise<ServiceVoidResult>;

  /** Update tournament settings for a specific competition (admin) */
  updateSettingsForCompetition(
    competitionId: string,
    updates: Partial<Omit<TournamentSettings, "competition_id" | "updated_at">>,
  ): Promise<ServiceVoidResult>;

  /** Create tournament settings for a new competition */
  createSettings(competitionId: string): Promise<ServiceVoidResult>;
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

  /** Get the current authenticated user's profile */
  getUserProfile(): Promise<ServiceResult<Profile>>;

  /** Sign in with email and password */
  signInWithPassword(
    email: string,
    password: string,
  ): Promise<ServiceResult<AuthSession>>;

  /** Sign up with email and password */
  signUp(
    email: string,
    password: string,
    metadata?: { display_name?: string },
  ): Promise<ServiceResult<AuthUser>>;

  /** Sign out the current user */
  signOut(): Promise<ServiceVoidResult>;

  /** Update user password */
  updatePassword(newPassword: string): Promise<ServiceVoidResult>;

  /** Subscribe to auth state changes */
  onAuthStateChange(
    callback: (event: string, session: AuthSession | null) => void,
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

  // Competition operations (admin)
  competitions: CompetitionService;

  // Competition member operations
  competitionMembers: CompetitionMemberService;

  // Invite code operations
  inviteCodes: InviteCodeService;

  // Prediction operations
  predictions: PredictionService;

  // Override operations
  overrides: OverrideService;

  // Third-place override operations
  thirdPlaceOverrides: ThirdPlaceOverrideService;

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
  version: "2.0.0",
  description: "Supabase PostgreSQL with multi-competition support",
};
