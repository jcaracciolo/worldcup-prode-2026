/**
 * Services Index
 *
 * Centralized exports for all service layer modules.
 */

// Client-side Database Service
export { createClientDatabaseService } from "./database-client";

// Server-side Database Service
export {
  createServerDatabaseService,
  createServiceDatabaseService,
  CURRENT_DB_VERSION,
} from "./database-service";

// Database Types
export type {
  DatabaseService,
  ProfileService,
  InviteCodeService,
  PredictionService,
  OverrideService,
  MatchesCacheService,
  TournamentSettingsService,
  ServiceResult,
  ServiceVoidResult,
  InviteCodeWithUsedBy,
  DatabaseServiceVersion,
} from "./database-types";
