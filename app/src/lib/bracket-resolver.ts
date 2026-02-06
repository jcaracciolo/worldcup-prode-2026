// Bracket Resolver - resolves knockout teams based on USER PREDICTIONS only
// R32 teams come from group standings (calculated from user's group predictions)
// R16+ teams come from winners of previous rounds (based on user's knockout predictions)
// The FIFA bracket structure defines which matches feed into which
import { Match, Team } from "@/types/football";
import { CalculatedStanding } from "@/types/football";
import { Prediction } from "@/types/database";
import { r32Bracket, r16Bracket, qfBracket, sfBracket } from "./r32-bracket";
import { getVenue } from "./venues";
import {
  R32_MATCH_SCHEDULE,
  R16_MATCH_SCHEDULE,
  QF_MATCH_SCHEDULE,
  SF_MATCH_SCHEDULE,
} from "./fifa-match-schedule";

export interface BracketResolverParams {
  matches: Match[];
  predictions: Map<number, Prediction>;
  groupStandings: Map<string, CalculatedStanding[]>;
  thirdPlaceQualifying: Map<string, boolean>;
}

export interface ResolvedTeams {
  home: Team | null;
  away: Team | null;
}

// Helper to sort matches by date
function sortByDate(matches: Match[]): Match[] {
  return [...matches].sort(
    (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
  );
}

// Main resolver class - uses FIFA bracket structure + user predictions
export class BracketResolver {
  private matches: Match[];
  private predictions: Map<number, Prediction>;
  private groupStandings: Map<string, CalculatedStanding[]>;
  private thirdPlaceQualifying: Map<string, boolean>;
  private resolved: Map<number, ResolvedTeams>; // API match ID -> teams

  // FIFA match number mappings
  private apiIdToFifaNumber: Map<number, number>; // API ID -> FIFA number
  private fifaNumberToApiId: Map<number, number>; // FIFA number -> API ID

  constructor(params: BracketResolverParams) {
    this.matches = params.matches;
    this.predictions = params.predictions;
    this.groupStandings = params.groupStandings;
    this.thirdPlaceQualifying = params.thirdPlaceQualifying;
    this.resolved = new Map();
    this.apiIdToFifaNumber = new Map();
    this.fifaNumberToApiId = new Map();

    // Build FIFA match number mappings based on date order
    this.buildFifaNumberMappings();
  }

  // Map API match IDs to FIFA match numbers using venue-based lookup
  // FIFA doesn't number matches strictly chronologically
  private buildFifaNumberMappings(): void {
    // Helper to find FIFA number from venue schedule
    const findFifaNumber = (
      match: Match,
      schedule: Record<string, Record<string, number>>,
    ): number | null => {
      const matchDate = new Date(match.utcDate);
      const dateKey = matchDate.toISOString().split("T")[0];
      const daySchedule = schedule[dateKey];
      
      if (!daySchedule) return null;
      
      // First try using match.venue from API (most accurate source)
      if (match.venue) {
        const venueLower = match.venue.toLowerCase();
        for (const [keyword, fifaNum] of Object.entries(daySchedule)) {
          if (venueLower.includes(keyword)) {
            return fifaNum;
          }
        }
      }
      
      // Fallback: try using venue from our static venues.ts mapping
      const venue = getVenue(match.id);
      if (venue) {
        const cityLower = venue.city.toLowerCase();
        const stadiumLower = venue.stadium.toLowerCase();
        
        for (const [keyword, fifaNum] of Object.entries(daySchedule)) {
          if (cityLower.includes(keyword) || stadiumLower.includes(keyword)) {
            return fifaNum;
          }
        }
      }
      
      return null;
    };

    // R32 matches (FIFA 73-88)
    const r32Matches = this.matches.filter((m) => m.stage === "LAST_32");
    for (const match of r32Matches) {
      const fifaNum = findFifaNumber(match, R32_MATCH_SCHEDULE);
      if (fifaNum) {
        this.apiIdToFifaNumber.set(match.id, fifaNum);
        this.fifaNumberToApiId.set(fifaNum, match.id);
      }
    }
    
    // If venue-based matching didn't work for some matches, fall back to date order
    // for any unassigned matches
    const assignedR32FifaNums = new Set(
      [...this.apiIdToFifaNumber.entries()]
        .filter(([id]) => r32Matches.some((m) => m.id === id))
        .map(([, num]) => num)
    );
    
    if (assignedR32FifaNums.size < r32Matches.length) {
      const sortedR32 = sortByDate(r32Matches);
      let nextFifaNum = 73;
      for (const match of sortedR32) {
        if (!this.apiIdToFifaNumber.has(match.id)) {
          // Find next unassigned FIFA number
          while (assignedR32FifaNums.has(nextFifaNum) && nextFifaNum <= 88) {
            nextFifaNum++;
          }
          if (nextFifaNum <= 88) {
            this.apiIdToFifaNumber.set(match.id, nextFifaNum);
            this.fifaNumberToApiId.set(nextFifaNum, match.id);
            assignedR32FifaNums.add(nextFifaNum);
            nextFifaNum++;
          }
        }
      }
    }

    // R16 matches (FIFA 89-96) - similar venue-based approach
    const r16Matches = this.matches.filter((m) => m.stage === "LAST_16");
    for (const match of r16Matches) {
      const fifaNum = findFifaNumber(match, R16_MATCH_SCHEDULE);
      if (fifaNum) {
        this.apiIdToFifaNumber.set(match.id, fifaNum);
        this.fifaNumberToApiId.set(fifaNum, match.id);
      }
    }
    
    // Fallback for R16
    const assignedR16FifaNums = new Set(
      [...this.apiIdToFifaNumber.entries()]
        .filter(([id]) => r16Matches.some((m) => m.id === id))
        .map(([, num]) => num)
    );
    if (assignedR16FifaNums.size < r16Matches.length) {
      const sortedR16 = sortByDate(r16Matches);
      let nextFifaNum = 89;
      for (const match of sortedR16) {
        if (!this.apiIdToFifaNumber.has(match.id)) {
          while (assignedR16FifaNums.has(nextFifaNum) && nextFifaNum <= 96) {
            nextFifaNum++;
          }
          if (nextFifaNum <= 96) {
            this.apiIdToFifaNumber.set(match.id, nextFifaNum);
            this.fifaNumberToApiId.set(nextFifaNum, match.id);
            nextFifaNum++;
          }
        }
      }
    }

    // QF matches (FIFA 97-100)
    const qfMatches = this.matches.filter((m) => m.stage === "QUARTER_FINALS");
    for (const match of qfMatches) {
      const fifaNum = findFifaNumber(match, QF_MATCH_SCHEDULE);
      if (fifaNum) {
        this.apiIdToFifaNumber.set(match.id, fifaNum);
        this.fifaNumberToApiId.set(fifaNum, match.id);
      }
    }
    
    // Fallback for QF
    const assignedQFFifaNums = new Set(
      [...this.apiIdToFifaNumber.entries()]
        .filter(([id]) => qfMatches.some((m) => m.id === id))
        .map(([, num]) => num)
    );
    if (assignedQFFifaNums.size < qfMatches.length) {
      const sortedQF = sortByDate(qfMatches);
      let nextFifaNum = 97;
      for (const match of sortedQF) {
        if (!this.apiIdToFifaNumber.has(match.id)) {
          while (assignedQFFifaNums.has(nextFifaNum) && nextFifaNum <= 100) {
            nextFifaNum++;
          }
          if (nextFifaNum <= 100) {
            this.apiIdToFifaNumber.set(match.id, nextFifaNum);
            this.fifaNumberToApiId.set(nextFifaNum, match.id);
            nextFifaNum++;
          }
        }
      }
    }

    // SF matches (FIFA 101-102)
    const sfMatches = this.matches.filter((m) => m.stage === "SEMI_FINALS");
    for (const match of sfMatches) {
      const fifaNum = findFifaNumber(match, SF_MATCH_SCHEDULE);
      if (fifaNum) {
        this.apiIdToFifaNumber.set(match.id, fifaNum);
        this.fifaNumberToApiId.set(fifaNum, match.id);
      }
    }
    
    // Fallback for SF
    const assignedSFFifaNums = new Set(
      [...this.apiIdToFifaNumber.entries()]
        .filter(([id]) => sfMatches.some((m) => m.id === id))
        .map(([, num]) => num)
    );
    if (assignedSFFifaNums.size < sfMatches.length) {
      const sortedSF = sortByDate(sfMatches);
      let nextFifaNum = 101;
      for (const match of sortedSF) {
        if (!this.apiIdToFifaNumber.has(match.id)) {
          while (assignedSFFifaNums.has(nextFifaNum) && nextFifaNum <= 102) {
            nextFifaNum++;
          }
          if (nextFifaNum <= 102) {
            this.apiIdToFifaNumber.set(match.id, nextFifaNum);
            this.fifaNumberToApiId.set(nextFifaNum, match.id);
            nextFifaNum++;
          }
        }
      }
    }

    // Third place (FIFA 103)
    const thirdPlace = this.matches.find((m) => m.stage === "THIRD_PLACE");
    if (thirdPlace) {
      this.apiIdToFifaNumber.set(thirdPlace.id, 103);
      this.fifaNumberToApiId.set(103, thirdPlace.id);
    }

    // Final (FIFA 104)
    const final = this.matches.find((m) => m.stage === "FINAL");
    if (final) {
      this.apiIdToFifaNumber.set(final.id, 104);
      this.fifaNumberToApiId.set(104, final.id);
    }
  }

  // Get team from user's predicted group standings
  private getTeamFromStandings(group: string, position: number): Team | null {
    const standings = this.groupStandings.get(group);
    if (!standings || standings.length < position) return null;
    const standing = standings.find((s) => s.position === position);
    // For 3rd place, check if they qualify
    if (position === 3 && !this.thirdPlaceQualifying.get(group)) {
      return null;
    }
    return standing?.team || null;
  }

  // Get predicted winner of a match by FIFA match number
  private getPredictedWinnerByFifa(fifaMatchNumber: number): Team | null {
    const apiId = this.fifaNumberToApiId.get(fifaMatchNumber);
    if (!apiId) return null;

    const pred = this.predictions.get(apiId);
    const teams = this.resolved.get(apiId);
    if (!teams) return null;

    if (!pred || pred.home_goals === null || pred.away_goals === null) {
      // No prediction - default to home team to avoid null propagation
      return teams.home;
    }

    if (pred.home_goals > pred.away_goals) {
      return teams.home;
    } else if (pred.away_goals > pred.home_goals) {
      return teams.away;
    } else {
      // Tie - check winner_id, default to home if not selected
      if (pred.winner_id) {
        if (teams.home?.id === pred.winner_id) return teams.home;
        if (teams.away?.id === pred.winner_id) return teams.away;
      }
      return teams.home;
    }
  }

  // Get predicted loser of a match by FIFA match number
  private getPredictedLoserByFifa(fifaMatchNumber: number): Team | null {
    const apiId = this.fifaNumberToApiId.get(fifaMatchNumber);
    if (!apiId) return null;

    const pred = this.predictions.get(apiId);
    const teams = this.resolved.get(apiId);
    if (!teams) return null;

    if (!pred || pred.home_goals === null || pred.away_goals === null) {
      return teams.away;
    }

    if (pred.home_goals < pred.away_goals) {
      return teams.home;
    } else if (pred.away_goals < pred.home_goals) {
      return teams.away;
    } else {
      // Tie - loser is the one NOT selected as winner
      if (pred.winner_id) {
        if (teams.home?.id === pred.winner_id) return teams.away;
        if (teams.away?.id === pred.winner_id) return teams.home;
      }
      return teams.away;
    }
  }

  // Resolve all knockout teams
  resolve(): Map<number, ResolvedTeams> {
    // Step 1: R32 - teams from group standings (user predictions)
    this.resolveR32();

    // Step 2: R16 - winners from R32 (following FIFA bracket)
    this.resolveR16();

    // Step 3: QF - winners from R16 (following FIFA bracket)
    this.resolveQF();

    // Step 4: SF - winners from QF (following FIFA bracket)
    this.resolveSF();

    // Step 5: Third Place - SF losers
    this.resolveThirdPlace();

    // Step 6: Final - SF winners
    this.resolveFinal();

    return this.resolved;
  }

  // R32: Get teams from user's GROUP STAGE predictions (not API!)
  private resolveR32(): void {
    const r32Matches = this.matches.filter((m) => m.stage === "LAST_32");

    for (const match of r32Matches) {
      const fifaNumber = this.apiIdToFifaNumber.get(match.id);
      if (!fifaNumber) {
        this.resolved.set(match.id, { home: null, away: null });
        continue;
      }

      // Find the bracket slot for this FIFA match number
      const bracketSlot = r32Bracket.find((b) => b.matchNumber === fifaNumber);
      if (!bracketSlot) {
        this.resolved.set(match.id, { home: null, away: null });
        continue;
      }

      // Get teams from USER'S predicted group standings
      const homeTeam = bracketSlot.homePosition
        ? this.getTeamFromStandings(
            bracketSlot.homePosition.group,
            bracketSlot.homePosition.position,
          )
        : null; // 3rd place teams need dynamic resolution

      const awayTeam = bracketSlot.awayPosition
        ? this.getTeamFromStandings(
            bracketSlot.awayPosition.group,
            bracketSlot.awayPosition.position,
          )
        : null; // 3rd place teams need dynamic resolution

      this.resolved.set(match.id, { home: homeTeam, away: awayTeam });
    }
  }

  // R16: Get teams from R32 winners following FIFA bracket structure
  private resolveR16(): void {
    const r16Matches = this.matches.filter((m) => m.stage === "LAST_16");

    for (const match of r16Matches) {
      const fifaNumber = this.apiIdToFifaNumber.get(match.id);
      if (!fifaNumber) {
        this.resolved.set(match.id, { home: null, away: null });
        continue;
      }

      // Find the bracket slot - tells us which R32 matches feed into this R16 match
      const bracketSlot = r16Bracket.find((b) => b.matchNumber === fifaNumber);
      if (!bracketSlot) {
        this.resolved.set(match.id, { home: null, away: null });
        continue;
      }

      // Get winners from the specific R32 matches defined by FIFA bracket
      const homeTeam = this.getPredictedWinnerByFifa(bracketSlot.homeFromR32);
      const awayTeam = this.getPredictedWinnerByFifa(bracketSlot.awayFromR32);

      this.resolved.set(match.id, { home: homeTeam, away: awayTeam });
    }
  }

  // QF: Get teams from R16 winners following FIFA bracket structure
  private resolveQF(): void {
    const qfMatches = this.matches.filter((m) => m.stage === "QUARTER_FINALS");

    for (const match of qfMatches) {
      const fifaNumber = this.apiIdToFifaNumber.get(match.id);
      if (!fifaNumber) {
        this.resolved.set(match.id, { home: null, away: null });
        continue;
      }

      const bracketSlot = qfBracket.find((b) => b.matchNumber === fifaNumber);
      if (!bracketSlot) {
        this.resolved.set(match.id, { home: null, away: null });
        continue;
      }

      const homeTeam = this.getPredictedWinnerByFifa(bracketSlot.homeFromR16);
      const awayTeam = this.getPredictedWinnerByFifa(bracketSlot.awayFromR16);

      this.resolved.set(match.id, { home: homeTeam, away: awayTeam });
    }
  }

  // SF: Get teams from QF winners following FIFA bracket structure
  private resolveSF(): void {
    const sfMatches = this.matches.filter((m) => m.stage === "SEMI_FINALS");

    for (const match of sfMatches) {
      const fifaNumber = this.apiIdToFifaNumber.get(match.id);
      if (!fifaNumber) {
        this.resolved.set(match.id, { home: null, away: null });
        continue;
      }

      const bracketSlot = sfBracket.find((b) => b.matchNumber === fifaNumber);
      if (!bracketSlot) {
        this.resolved.set(match.id, { home: null, away: null });
        continue;
      }

      const homeTeam = this.getPredictedWinnerByFifa(bracketSlot.homeFromQF);
      const awayTeam = this.getPredictedWinnerByFifa(bracketSlot.awayFromQF);

      this.resolved.set(match.id, { home: homeTeam, away: awayTeam });
    }
  }

  // Third Place: Losers of the two SF matches (FIFA 101 and 102)
  private resolveThirdPlace(): void {
    const thirdPlaceMatch = this.matches.find((m) => m.stage === "THIRD_PLACE");
    if (!thirdPlaceMatch) return;

    const homeTeam = this.getPredictedLoserByFifa(101);
    const awayTeam = this.getPredictedLoserByFifa(102);

    this.resolved.set(thirdPlaceMatch.id, { home: homeTeam, away: awayTeam });
  }

  // Final: Winners of the two SF matches (FIFA 101 and 102)
  private resolveFinal(): void {
    const finalMatch = this.matches.find((m) => m.stage === "FINAL");
    if (!finalMatch) return;

    const homeTeam = this.getPredictedWinnerByFifa(101);
    const awayTeam = this.getPredictedWinnerByFifa(102);

    this.resolved.set(finalMatch.id, { home: homeTeam, away: awayTeam });
  }
}

// Export helper for R32Preview (for display labels)
// Uses venue-based mapping to correctly identify FIFA match numbers
export function buildMatchNumberMapping(matches: Match[]): Map<number, number> {
  const mapping = new Map<number, number>();
  const assignedNums = new Set<number>();
  
  // Helper to find FIFA number from venue
  const findFifaNumber = (
    match: Match,
    schedule: Record<string, Record<string, number>>,
  ): number | null => {
    const matchDate = new Date(match.utcDate);
    const dateKey = matchDate.toISOString().split("T")[0];
    const daySchedule = schedule[dateKey];
    
    if (!daySchedule) return null;
    
    // First try using match.venue from API (most accurate source)
    if (match.venue) {
      const venueLower = match.venue.toLowerCase();
      for (const [keyword, fifaNum] of Object.entries(daySchedule)) {
        if (venueLower.includes(keyword)) {
          return fifaNum;
        }
      }
    }
    
    // Fallback: use venue from our static venues.ts mapping
    const venue = getVenue(match.id);
    if (venue) {
      const cityLower = venue.city.toLowerCase();
      const stadiumLower = venue.stadium.toLowerCase();
      
      for (const [keyword, fifaNum] of Object.entries(daySchedule)) {
        if (cityLower.includes(keyword) || stadiumLower.includes(keyword)) {
          return fifaNum;
        }
      }
    }
    
    return null;
  };
  
  // R32 matches
  const r32Matches = matches.filter((m) => m.stage === "LAST_32");
  for (const match of r32Matches) {
    const fifaNum = findFifaNumber(match, R32_MATCH_SCHEDULE);
    if (fifaNum && !assignedNums.has(fifaNum)) {
      mapping.set(match.id, fifaNum);
      assignedNums.add(fifaNum);
    }
  }
  
  // Fallback for unmatched R32 matches (sequential by date)
  const sortedR32 = sortByDate(r32Matches);
  let nextFifaNum = 73;
  for (const match of sortedR32) {
    if (!mapping.has(match.id)) {
      while (assignedNums.has(nextFifaNum) && nextFifaNum <= 88) {
        nextFifaNum++;
      }
      if (nextFifaNum <= 88) {
        mapping.set(match.id, nextFifaNum);
        assignedNums.add(nextFifaNum);
        nextFifaNum++;
      }
    }
  }
  
  return mapping;
}
