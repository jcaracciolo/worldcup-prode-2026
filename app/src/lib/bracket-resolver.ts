// Bracket Resolver - resolves knockout teams using ACTUAL results when available
// Priority order:
// 1. API teams - if the API has valid teams (not TBD/placeholders), use them
// 2. Actual results - if a group/match is finished, use the real results
// 3. TBD placeholder - if group isn't complete, return null (UI shows "1A", "2B", etc.)
// The FIFA bracket structure defines which matches feed into which
import { Match, Team, FifaMatchId, asFifaMatchId } from "@/types/football";
import { CalculatedStanding } from "@/types/football";
import { LocalPrediction } from "@/types/database";
import { r32Bracket, r16Bracket, qfBracket, sfBracket } from "./r32-bracket";
import { getKnockoutTbdLabel } from "./scoring";

export interface BracketResolverParams {
  matches: Match[];
  predictions: Map<FifaMatchId, LocalPrediction>;
  groupStandings: Map<string, CalculatedStanding[]>;
  thirdPlaceQualifying: Map<string, boolean>;
  /**
   * When true, use knockout predictions to resolve later rounds (R16+)
   * when actual match results are not yet available.
   * R32 is always resolved from actual data (API teams → group standings → TBD).
   */
  useKnockoutPredictions?: boolean;
}

export interface ResolvedTeams {
  home: Team | null;
  away: Team | null;
  /** Ready-to-use display name for home team (e.g., "USA", "1A", "W73", "3rd") */
  homeDisplayName: string;
  /** Ready-to-use display name for away team */
  awayDisplayName: string;
}

// Main resolver class - uses FIFA bracket structure + actual results when available
export class BracketResolver {
  private matches: Match[];
  private predictions: Map<FifaMatchId, LocalPrediction>; // Keyed by FIFA match number
  private groupStandings: Map<string, CalculatedStanding[]>;
  private thirdPlaceQualifying: Map<string, boolean>;
  private useKnockoutPredictions: boolean; // Use knockout predictions for R16+ when unfinished
  private resolved: Map<FifaMatchId, ResolvedTeams>; // FIFA match number -> teams

  constructor(params: BracketResolverParams) {
    this.matches = params.matches;
    this.predictions = params.predictions;
    this.groupStandings = params.groupStandings;
    this.thirdPlaceQualifying = params.thirdPlaceQualifying;
    this.useKnockoutPredictions = params.useKnockoutPredictions || false;
    this.resolved = new Map();
  }

  /**
   * Helper to set resolved teams with computed display names
   * If team exists: uses team.tla; if null: uses bracket label (1A, W73, L101, etc.)
   */
  private setResolved(
    fifaNumber: FifaMatchId,
    home: Team | null,
    away: Team | null,
  ): void {
    const homeDisplayName =
      home?.tla ?? getKnockoutTbdLabel(fifaNumber, "home");
    const awayDisplayName =
      away?.tla ?? getKnockoutTbdLabel(fifaNumber, "away");
    this.resolved.set(fifaNumber, {
      home,
      away,
      homeDisplayName,
      awayDisplayName,
    });
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
    const match = this.matches.find((m) => m.id === fifaNumber);
    return match?.status === "FINISHED";
  }

  // Get actual winner of a finished knockout match
  private getActualWinnerByFifa(fifaMatchNumber: FifaMatchId): Team | null {
    const match = this.matches.find((m) => m.id === fifaMatchNumber);
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
    const match = this.matches.find((m) => m.id === fifaMatchNumber);
    if (!match) return null;
    return match.homeTeam.id === winner.id ? match.awayTeam : match.homeTeam;
  }

  // match.id IS the FIFA number now, no mapping needed

  // Get team from group standings - only returns a team if group is complete
  // R32 always uses actual data, never predicted group standings
  private getTeamFromStandings(group: string, position: number): Team | null {
    // Only return a team if the group has finished all matches
    if (!this.isGroupComplete(group)) {
      return null; // UI will show placeholder like "1A", "2B"
    }

    const standings = this.groupStandings.get(group);
    if (!standings || standings.length < position) return null;
    const standing = standings.find((s) => s.position === position);
    // For 3rd place, check if they qualify
    if (position === 3 && !this.thirdPlaceQualifying.get(group)) {
      return null;
    }
    return standing?.team || null;
  }

  // Get winner of a match - only returns team if match is finished
  // When usePredictedStandings is true, falls back to predicted winner
  private getWinnerByFifa(fifaMatchNumber: FifaMatchId): Team | null {
    // Always use actual winner if match is finished
    if (this.isKnockoutMatchFinished(fifaMatchNumber)) {
      return this.getActualWinnerByFifa(fifaMatchNumber);
    }

    // In knockout predictions mode, use prediction to determine winner
    if (this.useKnockoutPredictions) {
      return this.getPredictedWinnerByFifa(fifaMatchNumber);
    }

    return null; // UI will show placeholder
  }

  // Get loser of a match - only returns team if match is finished
  // When usePredictedStandings is true, falls back to predicted loser
  private getLoserByFifa(fifaMatchNumber: FifaMatchId): Team | null {
    // Always use actual loser if match is finished
    if (this.isKnockoutMatchFinished(fifaMatchNumber)) {
      return this.getActualLoserByFifa(fifaMatchNumber);
    }

    // In knockout predictions mode, use prediction to determine loser
    if (this.useKnockoutPredictions) {
      return this.getPredictedLoserByFifa(fifaMatchNumber);
    }

    return null; // UI will show placeholder
  }

  // Get predicted winner from user's predictions
  private getPredictedWinnerByFifa(fifaMatchNumber: FifaMatchId): Team | null {
    const resolved = this.resolved.get(fifaMatchNumber);
    if (!resolved?.home || !resolved?.away) return null;

    const prediction = this.predictions.get(fifaMatchNumber);
    if (
      !prediction ||
      prediction.home_goals === null ||
      prediction.away_goals === null
    ) {
      return null;
    }

    if (prediction.home_goals > prediction.away_goals) return resolved.home;
    if (prediction.away_goals > prediction.home_goals) return resolved.away;

    // Tie - use winner_id
    if (prediction.winner_id === resolved.home.id) return resolved.home;
    if (prediction.winner_id === resolved.away.id) return resolved.away;

    return null; // Tie with no winner selected
  }

  // Get predicted loser from user's predictions
  private getPredictedLoserByFifa(fifaMatchNumber: FifaMatchId): Team | null {
    const winner = this.getPredictedWinnerByFifa(fifaMatchNumber);
    if (!winner) return null;

    const resolved = this.resolved.get(fifaMatchNumber);
    if (!resolved?.home || !resolved?.away) return null;

    return resolved.home.id === winner.id ? resolved.away : resolved.home;
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
      const fifaNumber = asFifaMatchId(match.id);

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

      this.setResolved(fifaNumber, homeTeam, awayTeam);
    }
  }

  // R16: Use API teams if available, otherwise calculate from R32 winners
  private resolveR16(): void {
    const r16Matches = this.matches.filter((m) => m.stage === "LAST_16");

    for (const match of r16Matches) {
      const fifaNumber = asFifaMatchId(match.id);

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

      this.setResolved(fifaNumber, homeTeam, awayTeam);
    }
  }

  // QF: Use API teams if available, otherwise calculate from R16 winners
  private resolveQF(): void {
    const qfMatches = this.matches.filter((m) => m.stage === "QUARTER_FINALS");

    for (const match of qfMatches) {
      const fifaNumber = asFifaMatchId(match.id);

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

      this.setResolved(fifaNumber, homeTeam, awayTeam);
    }
  }

  // SF: Use API teams if available, otherwise calculate from QF winners
  private resolveSF(): void {
    const sfMatches = this.matches.filter((m) => m.stage === "SEMI_FINALS");

    for (const match of sfMatches) {
      const fifaNumber = asFifaMatchId(match.id);

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

      this.setResolved(fifaNumber, homeTeam, awayTeam);
    }
  }

  // Third Place: Use API teams if available, otherwise calculate from SF losers
  private resolveThirdPlace(): void {
    const thirdPlaceMatch = this.matches.find((m) => m.stage === "THIRD_PLACE");
    if (!thirdPlaceMatch) return;

    const fifaNumber = asFifaMatchId(thirdPlaceMatch.id);

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

    this.setResolved(fifaNumber, homeTeam, awayTeam);
  }

  // Final: Use API teams if available, otherwise calculate from SF winners
  private resolveFinal(): void {
    const finalMatch = this.matches.find((m) => m.stage === "FINAL");
    if (!finalMatch) return;

    const fifaNumber = asFifaMatchId(finalMatch.id);

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

    this.setResolved(fifaNumber, homeTeam, awayTeam);
  }
}
