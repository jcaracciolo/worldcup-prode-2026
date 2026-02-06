/**
 * API CLIENT - Single interface to external football data
 * 
 * This is the ONLY place that interacts with the external football-data.org API.
 * All match lookups use FIFA match numbers. The API ID mapping is internal.
 * 
 * If we swap APIs in the future, only this file needs to change.
 * 
 * Usage:
 *   const client = await getApiClient();
 *   const score = client.getMatchScore(86);  // FIFA match number
 *   const status = client.getMatchStatus(86);
 */

import { Match, Team } from "@/types/football";

// =====================================================================
// TYPES
// =====================================================================

export interface MatchScore {
  homeGoals: number | null;
  awayGoals: number | null;
  winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
}

export interface MatchStatus {
  status: "SCHEDULED" | "TIMED" | "IN_PLAY" | "PAUSED" | "FINISHED" | "SUSPENDED" | "POSTPONED" | "CANCELLED" | "AWARDED";
  utcDate: string;
}

export interface GroupMatch {
  fifaNumber: number; // Group matches: 1-72
  group: string;
  homeTeam: Team;
  awayTeam: Team;
  score: MatchScore;
  status: MatchStatus;
  utcDate: string;
}

export interface KnockoutMatch {
  fifaNumber: number; // Knockout matches: 73-104
  stage: string;
  homeTeam: Team | null; // May be TBD
  awayTeam: Team | null;
  score: MatchScore;
  status: MatchStatus;
  utcDate: string;
}

// =====================================================================
// API CLIENT CLASS
// =====================================================================

class ApiClient {
  private matches: Match[] = [];
  private apiIdToFifa: Map<number, number> = new Map();
  private fifaToApiId: Map<number, number> = new Map();
  private groupMatchesByFifa: Map<number, Match> = new Map();
  private knockoutMatchesByFifa: Map<number, Match> = new Map();
  private initialized = false;

  /**
   * Initialize the client by fetching all matches from API
   * Called automatically on first use
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/matches`,
        { cache: "no-store" }
      );
      const data = await res.json();
      this.matches = data.matches || [];
      this.buildMappings();
      this.initialized = true;
    } catch (error) {
      console.error("Failed to fetch matches:", error);
      this.matches = [];
      this.initialized = true;
    }
  }

  /**
   * Build internal mappings from API IDs to FIFA numbers
   * This is the ONLY place this mapping exists
   */
  private buildMappings(): void {
    // Group stage matches (FIFA 1-72): assign by date order within each group
    const groupMatches = this.matches.filter(m => m.stage === "GROUP_STAGE");
    
    // Sort all group matches by date
    const sortedGroupMatches = [...groupMatches].sort(
      (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
    );
    
    // Assign FIFA numbers 1-72 in chronological order
    sortedGroupMatches.forEach((match, index) => {
      const fifaNum = index + 1;
      this.apiIdToFifa.set(match.id, fifaNum);
      this.fifaToApiId.set(fifaNum, match.id);
      this.groupMatchesByFifa.set(fifaNum, match);
    });

    // Knockout matches (FIFA 73-104): assign by date order within each stage
    const knockoutStages = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "THIRD_PLACE", "FINAL"];
    const stageBaseNumbers: Record<string, number> = {
      "LAST_32": 73,
      "LAST_16": 89,
      "QUARTER_FINALS": 97,
      "SEMI_FINALS": 101,
      "THIRD_PLACE": 103,
      "FINAL": 104,
    };

    for (const stage of knockoutStages) {
      const stageMatches = this.matches.filter(m => m.stage === stage);
      const sortedStageMatches = [...stageMatches].sort(
        (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
      );

      sortedStageMatches.forEach((match, index) => {
        const fifaNum = stageBaseNumbers[stage] + index;
        this.apiIdToFifa.set(match.id, fifaNum);
        this.fifaToApiId.set(fifaNum, match.id);
        this.knockoutMatchesByFifa.set(fifaNum, match);
      });
    }
  }

  /**
   * Refresh data from API (call periodically for live updates)
   */
  async refresh(): Promise<void> {
    this.initialized = false;
    await this.initialize();
  }

  // =====================================================================
  // PUBLIC API - All lookups by FIFA match number
  // =====================================================================

  /**
   * Get match score by FIFA match number
   */
  getMatchScore(fifaNumber: number): MatchScore | null {
    const match = this.getMatchByFifa(fifaNumber);
    if (!match) return null;

    return {
      homeGoals: match.score.fullTime.home,
      awayGoals: match.score.fullTime.away,
      winner: match.score.winner,
    };
  }

  /**
   * Get match status by FIFA match number
   */
  getMatchStatus(fifaNumber: number): MatchStatus | null {
    const match = this.getMatchByFifa(fifaNumber);
    if (!match) return null;

    return {
      status: match.status,
      utcDate: match.utcDate,
    };
  }

  /**
   * Get teams for a match (from API data, not our bracket structure)
   * For group stage, these are always set
   * For knockout, may be TBD (null) until previous rounds complete
   */
  getMatchTeams(fifaNumber: number): { home: Team | null; away: Team | null } | null {
    const match = this.getMatchByFifa(fifaNumber);
    if (!match) return null;

    return {
      home: match.homeTeam?.id ? match.homeTeam : null,
      away: match.awayTeam?.id ? match.awayTeam : null,
    };
  }

  /**
   * Get full group match data
   */
  getGroupMatch(fifaNumber: number): GroupMatch | null {
    if (fifaNumber < 1 || fifaNumber > 72) return null;
    const match = this.groupMatchesByFifa.get(fifaNumber);
    if (!match) return null;

    return {
      fifaNumber,
      group: match.group || "",
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      score: {
        homeGoals: match.score.fullTime.home,
        awayGoals: match.score.fullTime.away,
        winner: match.score.winner,
      },
      status: {
        status: match.status,
        utcDate: match.utcDate,
      },
      utcDate: match.utcDate,
    };
  }

  /**
   * Get full knockout match data
   */
  getKnockoutMatch(fifaNumber: number): KnockoutMatch | null {
    if (fifaNumber < 73 || fifaNumber > 104) return null;
    const match = this.knockoutMatchesByFifa.get(fifaNumber);
    if (!match) return null;

    return {
      fifaNumber,
      stage: match.stage,
      homeTeam: match.homeTeam?.id ? match.homeTeam : null,
      awayTeam: match.awayTeam?.id ? match.awayTeam : null,
      score: {
        homeGoals: match.score.fullTime.home,
        awayGoals: match.score.fullTime.away,
        winner: match.score.winner,
      },
      status: {
        status: match.status,
        utcDate: match.utcDate,
      },
      utcDate: match.utcDate,
    };
  }

  /**
   * Get all group matches for a specific group
   */
  getGroupMatches(group: string): GroupMatch[] {
    const matches: GroupMatch[] = [];
    for (let i = 1; i <= 72; i++) {
      const match = this.getGroupMatch(i);
      if (match && match.group === group) {
        matches.push(match);
      }
    }
    return matches;
  }

  /**
   * Get all matches for a knockout stage
   */
  getKnockoutStageMatches(stage: string): KnockoutMatch[] {
    const matches: KnockoutMatch[] = [];
    for (let i = 73; i <= 104; i++) {
      const match = this.getKnockoutMatch(i);
      if (match && match.stage === stage) {
        matches.push(match);
      }
    }
    return matches;
  }

  /**
   * Get all group matches grouped by group name
   */
  getAllGroupMatches(): Map<string, GroupMatch[]> {
    const groups = new Map<string, GroupMatch[]>();
    for (let i = 1; i <= 72; i++) {
      const match = this.getGroupMatch(i);
      if (match) {
        if (!groups.has(match.group)) {
          groups.set(match.group, []);
        }
        groups.get(match.group)!.push(match);
      }
    }
    return groups;
  }

  /**
   * Check if a match is finished
   */
  isMatchFinished(fifaNumber: number): boolean {
    const status = this.getMatchStatus(fifaNumber);
    return status?.status === "FINISHED";
  }

  /**
   * Get the winner of a finished knockout match
   * Returns the team that won (for bracket resolution)
   */
  getKnockoutWinner(fifaNumber: number): Team | null {
    const match = this.getMatchByFifa(fifaNumber);
    if (!match || match.status !== "FINISHED") return null;

    const homeGoals = match.score.fullTime.home;
    const awayGoals = match.score.fullTime.away;

    if (homeGoals === null || awayGoals === null) return null;

    // Knockout matches must have a winner (possibly through extra time/penalties)
    if (homeGoals > awayGoals || match.score.winner === "HOME_TEAM") {
      return match.homeTeam?.id ? match.homeTeam : null;
    } else if (awayGoals > homeGoals || match.score.winner === "AWAY_TEAM") {
      return match.awayTeam?.id ? match.awayTeam : null;
    }

    return null;
  }

  // =====================================================================
  // INTERNAL HELPERS
  // =====================================================================

  private getMatchByFifa(fifaNumber: number): Match | null {
    if (fifaNumber >= 1 && fifaNumber <= 72) {
      return this.groupMatchesByFifa.get(fifaNumber) || null;
    }
    if (fifaNumber >= 73 && fifaNumber <= 104) {
      return this.knockoutMatchesByFifa.get(fifaNumber) || null;
    }
    return null;
  }

  // =====================================================================
  // COMPATIBILITY - For transitioning existing code
  // These expose raw Match objects but should be phased out
  // =====================================================================

  /**
   * @deprecated Use getGroupMatch/getKnockoutMatch instead
   * Returns raw API matches - for backwards compatibility during migration
   */
  getRawMatches(): Match[] {
    return this.matches;
  }

  /**
   * @deprecated Internal use only
   * Get API match ID from FIFA number (for database operations)
   */
  getApiMatchId(fifaNumber: number): number | null {
    return this.fifaToApiId.get(fifaNumber) || null;
  }

  /**
   * @deprecated Internal use only
   * Get FIFA number from API match ID (for backwards compatibility)
   */
  getFifaNumber(apiMatchId: number): number | null {
    return this.apiIdToFifa.get(apiMatchId) || null;
  }
}

// =====================================================================
// SINGLETON INSTANCE
// =====================================================================

let clientInstance: ApiClient | null = null;

/**
 * Get the API client instance (singleton)
 * Automatically initializes on first call
 */
export async function getApiClient(): Promise<ApiClient> {
  if (!clientInstance) {
    clientInstance = new ApiClient();
  }
  await clientInstance.initialize();
  return clientInstance;
}

/**
 * Refresh the cached API data
 * Call this periodically for live updates
 */
export async function refreshApiClient(): Promise<void> {
  if (clientInstance) {
    await clientInstance.refresh();
  }
}

// =====================================================================
// STATIC HELPER - For backwards compatibility during migration
// =====================================================================

/**
 * Build API match ID to FIFA number mapping from Match array
 * Use this when you already have Match[] data and need the mapping
 * 
 * Prefer using getApiClient() for new code - it handles caching automatically
 */
export function buildApiToFifaMapping(apiMatches: Match[]): Map<number, number> {
  const mapping = new Map<number, number>();

  // Group stage matches (FIFA 1-72): assign by date order
  const groupMatches = apiMatches.filter(m => m.stage === "GROUP_STAGE");
  const sortedGroupMatches = [...groupMatches].sort(
    (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
  );
  sortedGroupMatches.forEach((match, index) => {
    mapping.set(match.id, index + 1);
  });

  // Knockout matches (FIFA 73-104): assign by date order within each stage
  const knockoutStages = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "THIRD_PLACE", "FINAL"];
  const stageBaseNumbers: Record<string, number> = {
    "LAST_32": 73,
    "LAST_16": 89,
    "QUARTER_FINALS": 97,
    "SEMI_FINALS": 101,
    "THIRD_PLACE": 103,
    "FINAL": 104,
  };

  for (const stage of knockoutStages) {
    const stageMatches = apiMatches.filter(m => m.stage === stage);
    const sortedStageMatches = [...stageMatches].sort(
      (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
    );
    sortedStageMatches.forEach((match, index) => {
      mapping.set(match.id, stageBaseNumbers[stage] + index);
    });
  }

  return mapping;
}
