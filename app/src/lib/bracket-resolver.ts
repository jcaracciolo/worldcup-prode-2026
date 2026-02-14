// Bracket Resolver - resolves knockout teams using ACTUAL results when available
// Priority order:
// 1. API teams - if the API has valid teams (not TBD/placeholders), use them
// 2. Actual results - if a group/match is finished, use the real results
// 3. TBD placeholder - if group isn't complete, return null (UI shows "1A", "2B", etc.)
// The FIFA bracket structure defines which matches feed into which
import { Match, Team, FifaMatchId } from "@/types/football";
import { CalculatedStanding } from "@/types/football";
import { LocalPrediction } from "@/types/database";
import { r32Bracket, r16Bracket, qfBracket, sfBracket } from "./r32-bracket";
import { buildApiToFifaMapping } from "./api-client";

export interface BracketResolverParams {
  matches: Match[];
  predictions: Map<FifaMatchId, LocalPrediction>;
  groupStandings: Map<string, CalculatedStanding[]>; // User's predicted standings
  thirdPlaceQualifying: Map<string, boolean>; // Which 3rd place teams qualify (based on prediction)
  // NEW: Actual standings from real results (optional)
  actualGroupStandings?: Map<string, CalculatedStanding[]>;
  actualThirdPlaceQualifying?: Map<string, boolean>;
}

export interface ResolvedTeams {
  home: Team | null;
  away: Team | null;
}

// Main resolver class - uses FIFA bracket structure + actual results when available
export class BracketResolver {
  private matches: Match[];
  private predictions: Map<FifaMatchId, LocalPrediction>; // Keyed by FIFA match number
  private groupStandings: Map<string, CalculatedStanding[]>; // Predicted standings
  private thirdPlaceQualifying: Map<string, boolean>; // Predicted 3rd place qualifying
  private actualGroupStandings: Map<string, CalculatedStanding[]> | null; // Actual standings from real results
  private actualThirdPlaceQualifying: Map<string, boolean> | null; // Actual 3rd place qualifying
  private resolved: Map<FifaMatchId, ResolvedTeams>; // FIFA match number -> teams

  // FIFA match number mappings
  private apiIdToFifaNumber: Map<number, FifaMatchId>; // API ID -> FIFA number
  private fifaNumberToApiId: Map<FifaMatchId, number>; // FIFA number -> API ID

  constructor(params: BracketResolverParams) {
    this.matches = params.matches;
    this.predictions = params.predictions;
    this.groupStandings = params.groupStandings;
    this.thirdPlaceQualifying = params.thirdPlaceQualifying;
    this.actualGroupStandings = params.actualGroupStandings || null;
    this.actualThirdPlaceQualifying = params.actualThirdPlaceQualifying || null;
    this.resolved = new Map();
    this.apiIdToFifaNumber = new Map();
    this.fifaNumberToApiId = new Map();

    // Build FIFA match number mappings using central tournament function
    this.buildFifaNumberMappings();
  }

  // Check if a team from API is valid (not a placeholder/TBD)
  private isValidApiTeam(team: Team | null): boolean {
    if (!team) return false;
    // Invalid if no id, or tla is empty or looks like a placeholder (e.g., "TBD", "28A", "1A")
    if (!team.id || team.id <= 0) return false;
    if (!team.tla || team.tla.length === 0) return false;
    // Check for placeholder patterns like "1A", "28A", "TBD"
    if (/^\d+[A-Z]$/.test(team.tla)) return false;
    if (team.tla === "TBD" || team.tla === "TBA") return false;
    return true;
  }

  // Check if a group has all matches finished (can use actual standings)
  private isGroupComplete(group: string): boolean {
    const groupMatches = this.matches.filter(
      (m) => m.stage === "GROUP_STAGE" && m.group === group,
    );
    return groupMatches.every(
      (m) =>
        m.status === "FINISHED" &&
        m.score.fullTime.home !== null &&
        m.score.fullTime.away !== null,
    );
  }

  // Check if a knockout match is finished (can use actual winner)
  private isKnockoutMatchFinished(fifaNumber: FifaMatchId): boolean {
    const apiId = this.fifaNumberToApiId.get(fifaNumber);
    if (!apiId) return false;
    const match = this.matches.find((m) => m.id === apiId);
    return match?.status === "FINISHED";
  }

  // Get actual winner of a finished knockout match
  private getActualWinnerByFifa(fifaMatchNumber: FifaMatchId): Team | null {
    const apiId = this.fifaNumberToApiId.get(fifaMatchNumber);
    if (!apiId) return null;
    const match = this.matches.find((m) => m.id === apiId);
    if (!match || match.status !== "FINISHED") return null;

    const home = match.score.fullTime.home ?? 0;
    const away = match.score.fullTime.away ?? 0;

    if (home > away) return match.homeTeam;
    if (away > home) return match.awayTeam;

    // Tie - check winner field from the API
    if (match.score.winner === "HOME_TEAM") return match.homeTeam;
    if (match.score.winner === "AWAY_TEAM") return match.awayTeam;

    // Default to home if can't determine
    return match.homeTeam;
  }

  // Get actual loser of a finished knockout match
  private getActualLoserByFifa(fifaMatchNumber: FifaMatchId): Team | null {
    const winner = this.getActualWinnerByFifa(fifaMatchNumber);
    if (!winner) return null;
    const apiId = this.fifaNumberToApiId.get(fifaMatchNumber);
    if (!apiId) return null;
    const match = this.matches.find((m) => m.id === apiId);
    if (!match) return null;
    return match.homeTeam.id === winner.id ? match.awayTeam : match.homeTeam;
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

  // Get team from group standings - only returns a team if group is complete
  // Returns null for incomplete groups so UI will show TBD placeholder
  private getTeamFromStandings(group: string, position: number): Team | null {
    // Only return a team if the group has finished all matches
    if (!this.isGroupComplete(group)) {
      return null; // UI will show placeholder like "1A", "2B"
    }

    // Use actual standings when available, otherwise predicted
    const standings =
      this.actualGroupStandings?.get(group) ?? this.groupStandings.get(group);
    const qualifyingMap =
      this.actualThirdPlaceQualifying ?? this.thirdPlaceQualifying;

    if (!standings || standings.length < position) return null;
    const standing = standings.find((s) => s.position === position);
    // For 3rd place, check if they qualify
    if (position === 3 && !qualifyingMap?.get(group)) {
      return null;
    }
    return standing?.team || null;
  }

  // Get winner of a match - only returns team if match is finished
  // Returns null for unfinished matches so UI will show TBD placeholder
  private getWinnerByFifa(fifaMatchNumber: FifaMatchId): Team | null {
    // Only return a team if match is finished
    if (this.isKnockoutMatchFinished(fifaMatchNumber)) {
      return this.getActualWinnerByFifa(fifaMatchNumber);
    }
    return null; // UI will show placeholder
  }

  // Get loser of a match - only returns team if match is finished
  // Returns null for unfinished matches so UI will show TBD placeholder
  private getLoserByFifa(fifaMatchNumber: FifaMatchId): Team | null {
    // Only return a team if match is finished
    if (this.isKnockoutMatchFinished(fifaMatchNumber)) {
      return this.getActualLoserByFifa(fifaMatchNumber);
    }
    return null; // UI will show placeholder
  }

  // Resolve all knockout teams
  resolve(): Map<FifaMatchId, ResolvedTeams> {
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

  // R32: Use API teams if available, otherwise calculate from group standings
  private resolveR32(): void {
    const r32Matches = this.matches.filter((m) => m.stage === "LAST_32");

    for (const match of r32Matches) {
      const fifaNumber = this.apiIdToFifaNumber.get(match.id);
      if (!fifaNumber) {
        continue;
      }

      // First, check if API already has valid teams
      const apiHomeValid = this.isValidApiTeam(match.homeTeam);
      const apiAwayValid = this.isValidApiTeam(match.awayTeam);

      // Use API teams if valid, otherwise calculate
      let homeTeam: Team | null = apiHomeValid ? match.homeTeam : null;
      let awayTeam: Team | null = apiAwayValid ? match.awayTeam : null;

      // Calculate missing teams from standings
      if (!homeTeam || !awayTeam) {
        const bracketSlot = r32Bracket.find(
          (b) => b.matchNumber === fifaNumber,
        );
        if (bracketSlot) {
          if (!homeTeam && bracketSlot.homePosition) {
            homeTeam = this.getTeamFromStandings(
              bracketSlot.homePosition.group,
              bracketSlot.homePosition.position,
            );
          }
          if (!awayTeam && bracketSlot.awayPosition) {
            awayTeam = this.getTeamFromStandings(
              bracketSlot.awayPosition.group,
              bracketSlot.awayPosition.position,
            );
          }
        }
      }

      this.resolved.set(fifaNumber, { home: homeTeam, away: awayTeam });
    }
  }

  // R16: Use API teams if available, otherwise calculate from R32 winners
  private resolveR16(): void {
    const r16Matches = this.matches.filter((m) => m.stage === "LAST_16");

    for (const match of r16Matches) {
      const fifaNumber = this.apiIdToFifaNumber.get(match.id);
      if (!fifaNumber) {
        continue;
      }

      // First, check if API already has valid teams
      const apiHomeValid = this.isValidApiTeam(match.homeTeam);
      const apiAwayValid = this.isValidApiTeam(match.awayTeam);

      // Use API teams if valid, otherwise calculate
      let homeTeam: Team | null = apiHomeValid ? match.homeTeam : null;
      let awayTeam: Team | null = apiAwayValid ? match.awayTeam : null;

      // Calculate missing teams from R32 winners
      if (!homeTeam || !awayTeam) {
        const bracketSlot = r16Bracket.find(
          (b) => b.matchNumber === fifaNumber,
        );
        if (bracketSlot) {
          if (!homeTeam) {
            homeTeam = this.getWinnerByFifa(bracketSlot.homeFromR32);
          }
          if (!awayTeam) {
            awayTeam = this.getWinnerByFifa(bracketSlot.awayFromR32);
          }
        }
      }

      this.resolved.set(fifaNumber, { home: homeTeam, away: awayTeam });
    }
  }

  // QF: Use API teams if available, otherwise calculate from R16 winners
  private resolveQF(): void {
    const qfMatches = this.matches.filter((m) => m.stage === "QUARTER_FINALS");

    for (const match of qfMatches) {
      const fifaNumber = this.apiIdToFifaNumber.get(match.id);
      if (!fifaNumber) {
        continue;
      }

      // First, check if API already has valid teams
      const apiHomeValid = this.isValidApiTeam(match.homeTeam);
      const apiAwayValid = this.isValidApiTeam(match.awayTeam);

      // Use API teams if valid, otherwise calculate
      let homeTeam: Team | null = apiHomeValid ? match.homeTeam : null;
      let awayTeam: Team | null = apiAwayValid ? match.awayTeam : null;

      // Calculate missing teams from R16 winners
      if (!homeTeam || !awayTeam) {
        const bracketSlot = qfBracket.find((b) => b.matchNumber === fifaNumber);
        if (bracketSlot) {
          if (!homeTeam) {
            homeTeam = this.getWinnerByFifa(bracketSlot.homeFromR16);
          }
          if (!awayTeam) {
            awayTeam = this.getWinnerByFifa(bracketSlot.awayFromR16);
          }
        }
      }

      this.resolved.set(fifaNumber, { home: homeTeam, away: awayTeam });
    }
  }

  // SF: Use API teams if available, otherwise calculate from QF winners
  private resolveSF(): void {
    const sfMatches = this.matches.filter((m) => m.stage === "SEMI_FINALS");

    for (const match of sfMatches) {
      const fifaNumber = this.apiIdToFifaNumber.get(match.id);
      if (!fifaNumber) {
        continue;
      }

      // First, check if API already has valid teams
      const apiHomeValid = this.isValidApiTeam(match.homeTeam);
      const apiAwayValid = this.isValidApiTeam(match.awayTeam);

      // Use API teams if valid, otherwise calculate
      let homeTeam: Team | null = apiHomeValid ? match.homeTeam : null;
      let awayTeam: Team | null = apiAwayValid ? match.awayTeam : null;

      // Calculate missing teams from QF winners
      if (!homeTeam || !awayTeam) {
        const bracketSlot = sfBracket.find((b) => b.matchNumber === fifaNumber);
        if (bracketSlot) {
          if (!homeTeam) {
            homeTeam = this.getWinnerByFifa(bracketSlot.homeFromQF);
          }
          if (!awayTeam) {
            awayTeam = this.getWinnerByFifa(bracketSlot.awayFromQF);
          }
        }
      }

      this.resolved.set(fifaNumber, { home: homeTeam, away: awayTeam });
    }
  }

  // Third Place: Use API teams if available, otherwise calculate from SF losers
  private resolveThirdPlace(): void {
    const thirdPlaceMatch = this.matches.find((m) => m.stage === "THIRD_PLACE");
    if (!thirdPlaceMatch) return;

    const fifaNumber = this.apiIdToFifaNumber.get(thirdPlaceMatch.id);
    if (!fifaNumber) return;

    // First, check if API already has valid teams
    const apiHomeValid = this.isValidApiTeam(thirdPlaceMatch.homeTeam);
    const apiAwayValid = this.isValidApiTeam(thirdPlaceMatch.awayTeam);

    // Use API teams if valid, otherwise calculate from SF losers
    const homeTeam = apiHomeValid
      ? thirdPlaceMatch.homeTeam
      : this.getLoserByFifa(sfBracket[0].matchNumber);
    const awayTeam = apiAwayValid
      ? thirdPlaceMatch.awayTeam
      : this.getLoserByFifa(sfBracket[1].matchNumber);

    this.resolved.set(fifaNumber, { home: homeTeam, away: awayTeam });
  }

  // Final: Use API teams if available, otherwise calculate from SF winners
  private resolveFinal(): void {
    const finalMatch = this.matches.find((m) => m.stage === "FINAL");
    if (!finalMatch) return;

    const fifaNumber = this.apiIdToFifaNumber.get(finalMatch.id);
    if (!fifaNumber) return;

    // First, check if API already has valid teams
    const apiHomeValid = this.isValidApiTeam(finalMatch.homeTeam);
    const apiAwayValid = this.isValidApiTeam(finalMatch.awayTeam);

    // Use API teams if valid, otherwise calculate from SF winners
    const homeTeam = apiHomeValid
      ? finalMatch.homeTeam
      : this.getWinnerByFifa(sfBracket[0].matchNumber);
    const awayTeam = apiAwayValid
      ? finalMatch.awayTeam
      : this.getWinnerByFifa(sfBracket[1].matchNumber);

    this.resolved.set(fifaNumber, { home: homeTeam, away: awayTeam });
  }
}
