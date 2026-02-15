// Football-Data.org API Types

/**
 * Branded type for FIFA Match IDs (official match numbers 1-104).
 * Use this to prevent confusion with API IDs (large numbers from football-data.org).
 *
 * FIFA IDs are deterministic: match #1 is always the opening game, match #64 is always the final.
 * API IDs are assigned by the data provider and can change.
 */
export type FifaMatchId = number & { readonly __brand: "FifaMatchId" };

/** Create a FifaMatchId from a number (use only when you know it's a valid FIFA match number) */
export const asFifaMatchId = (n: number): FifaMatchId => n as FifaMatchId;

/** Type guard to check if a value could be a FifaMatchId (1-104) */
export const isValidFifaMatchId = (n: number): n is FifaMatchId =>
  Number.isInteger(n) && n >= 1 && n <= 104;

export interface Team {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string | null;
}

export interface Score {
  home: number | null;
  away: number | null;
}

export interface FullTimeScore {
  home: number | null;
  away: number | null;
}

export interface Match {
  id: number;
  utcDate: string;
  status:
    | "SCHEDULED"
    | "TIMED"
    | "IN_PLAY"
    | "PAUSED"
    | "FINISHED"
    | "SUSPENDED"
    | "POSTPONED"
    | "CANCELLED"
    | "AWARDED";
  matchday: number;
  stage: string;
  group: string | null;
  homeTeam: Team;
  awayTeam: Team;
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    duration: string;
    fullTime: FullTimeScore;
    halfTime: Score;
  };
  venue: string | null;
  referees: Array<{ id: number; name: string; nationality: string }>;
}

export interface Competition {
  id: number;
  name: string;
  code: string;
  type: string;
  emblem: string;
}

export interface MatchesResponse {
  count: number;
  filters: Record<string, unknown>;
  competition: Competition;
  matches: Match[];
}

export interface StandingsTeam {
  team: Team;
  position: number;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface GroupStanding {
  stage: string;
  type: string;
  group: string;
  table: StandingsTeam[];
}

export interface StandingsResponse {
  competition: Competition;
  season: { id: number; startDate: string; endDate: string };
  standings: GroupStanding[];
}

export interface TeamsResponse {
  count: number;
  competition: Competition;
  teams: Team[];
}

// App-specific types

export interface UserPrediction {
  matchId: number;
  homeGoals: number | null;
  awayGoals: number | null;
  winnerId: number | null;
}

export interface CalculatedStanding {
  team: Team;
  position: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
}

export interface PointBreakdown {
  matchId: number;
  description: string;
  points: number;
  type:
    | "result"
    | "goals_home"
    | "goals_away"
    | "group_advance"
    | "group_position"
    | "knockout_win"
    | "knockout_lose"
    | "knockout_tie";
  /** Whether this is from a live match */
  isLive?: boolean;
  // Optional team info for display
  team?: {
    tla: string;
    crest: string | null;
    name: string;
  };
  // Optional match info for display
  matchInfo?: {
    homeTeam: { tla: string; crest: string | null };
    awayTeam: { tla: string; crest: string | null };
    homeGoals: number;
    awayGoals: number;
    stage: string;
  };
  // Optional prediction info for display (what the user predicted)
  prediction?: {
    homeGoals: number | null;
    awayGoals: number | null;
  };
}

export interface UserScore {
  userId: string;
  displayName: string;
  totalPoints: number;
  livePoints: number;
  groupStagePoints: number;
  groupBonusPoints: number;
  knockoutPoints: number;
  /** Leaderboard position (handles ties - users with same score share position) */
  position: number;
  /** Full scoring breakdown for all matches (may be empty for privacy before stage locks) */
  breakdown?: PointBreakdown[];
}
