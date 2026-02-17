import { FifaMatchId } from "./football";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          is_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name: string;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      competitions: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          season_id: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          season_id?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          season_id?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      competition_members: {
        Row: {
          user_id: string;
          competition_id: string;
          joined_at: string;
          invited_by: string | null;
        };
        Insert: {
          user_id: string;
          competition_id: string;
          joined_at?: string;
          invited_by?: string | null;
        };
        Update: {
          user_id?: string;
          competition_id?: string;
          joined_at?: string;
          invited_by?: string | null;
        };
      };
      invite_codes: {
        Row: {
          id: string;
          code: string;
          competition_id: string;
          created_by: string;
          used_by: string | null;
          created_at: string;
          used_at: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          competition_id: string;
          created_by: string;
          used_by?: string | null;
          created_at?: string;
          used_at?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          competition_id?: string;
          created_by?: string;
          used_by?: string | null;
          created_at?: string;
          used_at?: string | null;
        };
      };
      predictions: {
        Row: {
          id: string;
          user_id: string;
          competition_id: string;
          match_id: number;
          home_goals: number | null;
          away_goals: number | null;
          penalty_winner: "HOME" | "AWAY" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          competition_id: string;
          match_id: number;
          home_goals?: number | null;
          away_goals?: number | null;
          penalty_winner?: "HOME" | "AWAY" | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          competition_id?: string;
          match_id?: number;
          home_goals?: number | null;
          away_goals?: number | null;
          penalty_winner?: "HOME" | "AWAY" | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      group_standings_overrides: {
        Row: {
          id: string;
          user_id: string;
          competition_id: string;
          group_name: string;
          team_id: number;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          competition_id: string;
          group_name: string;
          team_id: number;
          position: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          competition_id?: string;
          group_name?: string;
          team_id?: number;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      matches_cache: {
        Row: {
          match_id: number;
          data: Json;
          updated_at: string;
        };
        Insert: {
          match_id: number;
          data: Json;
          updated_at?: string;
        };
        Update: {
          match_id?: number;
          data?: Json;
          updated_at?: string;
        };
      };
      tournament_settings: {
        Row: {
          competition_id: string;
          group_stage_locked: boolean;
          knockout_stage_open: boolean;
          knockout_stage_locked: boolean;
          updated_at: string;
        };
        Insert: {
          competition_id: string;
          group_stage_locked?: boolean;
          knockout_stage_open?: boolean;
          knockout_stage_locked?: boolean;
          updated_at?: string;
        };
        Update: {
          competition_id?: string;
          group_stage_locked?: boolean;
          knockout_stage_open?: boolean;
          knockout_stage_locked?: boolean;
          updated_at?: string;
        };
      };
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Competition = Database["public"]["Tables"]["competitions"]["Row"];
export type CompetitionMember =
  Database["public"]["Tables"]["competition_members"]["Row"];
export type InviteCode = Database["public"]["Tables"]["invite_codes"]["Row"];
/** Raw prediction type from database - use TypedPrediction for type-safe match_id */
export type Prediction = Database["public"]["Tables"]["predictions"]["Row"];
/** Prediction with match_id typed as FifaMatchId (use this in most code) */
export type TypedPrediction = Omit<Prediction, "match_id"> & {
  match_id: FifaMatchId;
};
export type GroupStandingsOverride =
  Database["public"]["Tables"]["group_standings_overrides"]["Row"];
export type MatchCache = Database["public"]["Tables"]["matches_cache"]["Row"];
export type TournamentSettings =
  Database["public"]["Tables"]["tournament_settings"]["Row"];

// Local types for editing - omit DB-managed fields
export type LocalPrediction = Omit<
  Prediction,
  "id" | "user_id" | "competition_id" | "created_at" | "updated_at"
>;
export type LocalGroupStandingsOverride = Omit<
  GroupStandingsOverride,
  "id" | "user_id" | "competition_id" | "created_at" | "updated_at"
>;
