// Bracket Resolver - resolves knockout teams based on USER PREDICTIONS only
// R32 teams come from group standings (calculated from user's group predictions)
// R16+ teams come from winners of previous rounds (based on user's knockout predictions)
// The FIFA bracket structure defines which matches feed into which
import { Match, Team } from "@/types/football";
import { CalculatedStanding } from "@/types/football";
import { Prediction } from "@/types/database";
import { r32Bracket, r16Bracket, qfBracket, sfBracket } from "./r32-bracket";
import { getBracketSource } from "./tournament";
import { buildApiToFifaMapping } from "./api-client";

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

    // Build FIFA match number mappings using central tournament function
    this.buildFifaNumberMappings();
  }

  // Map API match IDs to FIFA match numbers using central tournament function
  private buildFifaNumberMappings(): void {
    const mapping = buildApiToFifaMapping(this.matches);
    
    // Build both directions
    for (const [apiId, fifaNum] of mapping) {
      this.apiIdToFifaNumber.set(apiId, fifaNum);
      this.fifaNumberToApiId.set(fifaNum, apiId);
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

