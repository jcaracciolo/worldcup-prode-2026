export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          display_name: string
          is_admin: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name: string
          is_admin?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string
          is_admin?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      invite_codes: {
        Row: {
          id: string
          code: string
          created_by: string
          used_by: string | null
          created_at: string
          used_at: string | null
        }
        Insert: {
          id?: string
          code: string
          created_by: string
          used_by?: string | null
          created_at?: string
          used_at?: string | null
        }
        Update: {
          id?: string
          code?: string
          created_by?: string
          used_by?: string | null
          created_at?: string
          used_at?: string | null
        }
      }
      predictions: {
        Row: {
          id: string
          user_id: string
          match_id: number
          home_goals: number | null
          away_goals: number | null
          winner_id: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          match_id: number
          home_goals?: number | null
          away_goals?: number | null
          winner_id?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          match_id?: number
          home_goals?: number | null
          away_goals?: number | null
          winner_id?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      group_standings_overrides: {
        Row: {
          id: string
          user_id: string
          group_name: string
          team_id: number
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          group_name: string
          team_id: number
          position: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          group_name?: string
          team_id?: number
          position?: number
          created_at?: string
          updated_at?: string
        }
      }
      matches_cache: {
        Row: {
          match_id: number
          data: Json
          updated_at: string
        }
        Insert: {
          match_id: number
          data: Json
          updated_at?: string
        }
        Update: {
          match_id?: number
          data?: Json
          updated_at?: string
        }
      }
      tournament_settings: {
        Row: {
          id: number
          group_stage_locked: boolean
          knockout_stage_open: boolean
          knockout_stage_locked: boolean
          updated_at: string
        }
        Insert: {
          id?: number
          group_stage_locked?: boolean
          knockout_stage_open?: boolean
          knockout_stage_locked?: boolean
          updated_at?: string
        }
        Update: {
          id?: number
          group_stage_locked?: boolean
          knockout_stage_open?: boolean
          knockout_stage_locked?: boolean
          updated_at?: string
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type InviteCode = Database['public']['Tables']['invite_codes']['Row']
export type Prediction = Database['public']['Tables']['predictions']['Row']
export type GroupStandingsOverride = Database['public']['Tables']['group_standings_overrides']['Row']
export type MatchCache = Database['public']['Tables']['matches_cache']['Row']
export type TournamentSettings = Database['public']['Tables']['tournament_settings']['Row']
