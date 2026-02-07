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

import { Match, Team, FifaMatchId, asFifaMatchId } from "@/types/football";

// =====================================================================
// TYPES
// =====================================================================

export interface MatchScore {
  homeGoals: number | null;
  awayGoals: number | null;
  winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
}

export interface MatchStatus {
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
        { cache: "no-store" },
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
   * Uses the official FIFA schedule for correct match numbering
   */
  private buildMappings(): void {
    // Use the centralized mapping function that matches to official FIFA schedule
    const mapping = buildApiToFifaMapping(this.matches);

    // Populate our internal data structures
    mapping.forEach((fifaNum, apiId) => {
      const match = this.matches.find((m) => m.id === apiId);
      if (!match) return;

      this.apiIdToFifa.set(apiId, fifaNum);
      this.fifaToApiId.set(fifaNum, apiId);

      if (fifaNum >= 1 && fifaNum <= 72) {
        this.groupMatchesByFifa.set(fifaNum, match);
      } else {
        this.knockoutMatchesByFifa.set(fifaNum, match);
      }
    });
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
  getMatchTeams(
    fifaNumber: number,
  ): { home: Team | null; away: Team | null } | null {
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
// STATIC MAPPING - API Match IDs to FIFA Match Numbers
// =====================================================================

/**
 * Explicit mapping from football-data.org API match IDs to FIFA match numbers.
 * This ensures consistent, deterministic match numbering regardless of API order.
 *
 * Source: football-data.org API for 2026 World Cup (competition ID 2000)
 * FIFA numbers: 1-72 = group stage, 73-88 = round of 32, 89-96 = round of 16,
 *               97-100 = quarter-finals, 101-102 = semi-finals, 103 = 3rd place, 104 = final
 */
const API_ID_TO_FIFA: Record<number, number> = {
  // Group Stage - Matchday 1 (FIFA 1-24)
  537327: 1, // MEX vs RSA - Jun 11
  537328: 2, // KOR vs TBD - Jun 12
  537333: 3, // CAN vs TBD - Jun 12
  537345: 4, // USA vs PAR - Jun 13
  537346: 5, // AUS vs TBD - Jun 13
  537334: 6, // QAT vs SUI - Jun 13
  537339: 7, // BRA vs MAR - Jun 13
  537340: 8, // HAI vs SCO - Jun 14
  537351: 9, // GER vs CUR - Jun 14
  537357: 10, // NED vs JPN - Jun 14
  537352: 11, // CIV vs ECU - Jun 14
  537358: 12, // TBD vs TUN - Jun 15
  537369: 13, // ESP vs CPV - Jun 15
  537363: 14, // BEL vs EGY - Jun 15
  537370: 15, // KSA vs URU - Jun 15
  537364: 16, // IRN vs NZL - Jun 16
  537391: 17, // FRA vs SEN - Jun 16
  537392: 18, // TBD vs NOR - Jun 17
  537397: 19, // ARG vs ALG - Jun 17
  537398: 20, // AUT vs JOR - Jun 17
  537403: 21, // POR vs TBD - Jun 17
  537409: 22, // ENG vs CRO - Jun 17
  537410: 23, // GHA vs PAN - Jun 17
  537404: 24, // UZB vs COL - Jun 18

  // Group Stage - Matchday 2 (FIFA 25-48)
  537329: 25, // TBD vs RSA - Jun 18
  537335: 26, // SUI vs TBD - Jun 18
  537336: 27, // CAN vs QAT - Jun 18
  537330: 28, // MEX vs KOR - Jun 19
  537347: 29, // TBD vs PAR - Jun 19
  537348: 30, // USA vs AUS - Jun 19
  537342: 31, // SCO vs MAR - Jun 19
  537341: 32, // BRA vs HAI - Jun 20
  537360: 33, // TUN vs JPN - Jun 20
  537359: 34, // NED vs TBD - Jun 20
  537353: 35, // GER vs CIV - Jun 20
  537354: 36, // ECU vs CUR - Jun 21
  537371: 37, // ESP vs KSA - Jun 21
  537365: 38, // BEL vs IRN - Jun 21
  537372: 39, // URU vs CPV - Jun 21
  537366: 40, // NZL vs EGY - Jun 22
  537399: 41, // ARG vs AUT - Jun 22
  537393: 42, // FRA vs TBD - Jun 22
  537394: 43, // NOR vs SEN - Jun 23
  537400: 44, // JOR vs ALG - Jun 23
  537405: 45, // POR vs UZB - Jun 23
  537411: 46, // ENG vs GHA - Jun 23
  537412: 47, // PAN vs CRO - Jun 23
  537406: 48, // COL vs TBD - Jun 24

  // Group Stage - Matchday 3 (FIFA 49-72)
  537337: 49, // SUI vs CAN - Jun 24 (concurrent with 50)
  537338: 50, // TBD vs QAT - Jun 24 (concurrent with 49)
  537344: 51, // MAR vs HAI - Jun 24 (concurrent with 52)
  537343: 52, // SCO vs BRA - Jun 24 (concurrent with 51)
  537331: 53, // TBD vs MEX - Jun 25 (concurrent with 54)
  537332: 54, // RSA vs KOR - Jun 25 (concurrent with 53)
  537355: 55, // ECU vs GER - Jun 25 (concurrent with 56)
  537356: 56, // CUR vs CIV - Jun 25 (concurrent with 55)
  537361: 57, // TUN vs NED - Jun 25 (concurrent with 58)
  537362: 58, // JPN vs TBD - Jun 25 (concurrent with 57)
  537349: 59, // TBD vs USA - Jun 26 (concurrent with 60)
  537350: 60, // PAR vs AUS - Jun 26 (concurrent with 59)
  537395: 61, // NOR vs FRA - Jun 26 (concurrent with 62)
  537396: 62, // SEN vs TBD - Jun 26 (concurrent with 61)
  537373: 63, // URU vs ESP - Jun 27 (concurrent with 64)
  537374: 64, // CPV vs KSA - Jun 27 (concurrent with 63)
  537367: 65, // NZL vs BEL - Jun 27 (concurrent with 66)
  537368: 66, // EGY vs IRN - Jun 27 (concurrent with 65)
  537413: 67, // PAN vs ENG - Jun 27 (concurrent with 68)
  537414: 68, // CRO vs GHA - Jun 27 (concurrent with 67)
  537407: 69, // COL vs POR - Jun 27 (concurrent with 70)
  537408: 70, // TBD vs UZB - Jun 27 (concurrent with 69)
  537401: 71, // JOR vs ARG - Jun 28 (concurrent with 72)
  537402: 72, // ALG vs AUT - Jun 28 (concurrent with 71)

  // Round of 32 (FIFA 73-88)
  537417: 73, // Jun 28
  537423: 74, // Jun 29
  537415: 75, // Jun 29
  537418: 76, // Jun 30
  537424: 77, // Jun 30
  537416: 78, // Jun 30
  537425: 79, // Jul 1
  537426: 80, // Jul 1
  537422: 81, // Jul 1
  537421: 82, // Jul 2
  537420: 83, // Jul 2
  537419: 84, // Jul 2
  537429: 85, // Jul 3
  537428: 86, // Jul 3
  537427: 87, // Jul 3
  537430: 88, // Jul 4

  // Round of 16 (FIFA 89-96)
  537376: 89, // Jul 4
  537375: 90, // Jul 4
  537377: 91, // Jul 5
  537378: 92, // Jul 6
  537379: 93, // Jul 6
  537380: 94, // Jul 7
  537381: 95, // Jul 7
  537382: 96, // Jul 7

  // Quarter-finals (FIFA 97-100)
  537383: 97, // Jul 9
  537384: 98, // Jul 10
  537385: 99, // Jul 11
  537386: 100, // Jul 12

  // Semi-finals (FIFA 101-102)
  537387: 101, // Jul 14
  537388: 102, // Jul 15

  // Third place (FIFA 103)
  537389: 103, // Jul 18

  // Final (FIFA 104)
  537390: 104, // Jul 19
};

/**
 * Build API match ID to FIFA number mapping from Match array
 * Uses the static API_ID_TO_FIFA mapping for consistent numbering.
 *
 * Prefer using getApiClient() for new code - it handles caching automatically
 */
export function buildApiToFifaMapping(
  apiMatches: Match[],
): Map<number, FifaMatchId> {
  const mapping = new Map<number, FifaMatchId>();

  for (const match of apiMatches) {
    const fifaNumber = API_ID_TO_FIFA[match.id];
    if (fifaNumber !== undefined) {
      mapping.set(match.id, asFifaMatchId(fifaNumber));
    }
  }

  return mapping;
}
