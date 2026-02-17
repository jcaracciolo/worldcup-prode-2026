// Bracket Resolver - resolves knockout teams from group standings and match results
//
// Two modes:
// 1. Actual mode (default): uses real match results and actual group standings.
//    Priority: API teams → actual results → null (TBD placeholder).
//
// 2. Prediction mode (useKnockoutPredictions: true): R32 matchups still come
//    from actual data (real teams or placeholders). But R32 winners and all
//    subsequent rounds are resolved from user predictions, not actual results.
//    This shows the user's predicted bracket: who they think wins each match.
//
// The FIFA bracket structure defines which matches feed into which
import { Match, Team, FifaMatchId, asFifaMatchId } from "@/types/football";
import { CalculatedStanding } from "@/types/football";
import { LocalPrediction } from "@/types/database";
import { r32Bracket, r16Bracket, qfBracket, sfBracket } from "./r32-bracket";
import { getBracketLabel } from "./team-display";
import { getThirdPlaceTeamForMatch } from "./third-place-ranking";

export interface BracketResolverParams {
  matches: Match[];
  predictions: Map<FifaMatchId, LocalPrediction>;
  groupStandings: Map<string, CalculatedStanding[]>;
  thirdPlaceQualifying: Map<string, boolean>;
  /**
   * When true, knockout match winners/losers are resolved from predictions:
   * - R32 matchups still come from actual data (API teams / actual group standings)
   * - R32 winners come from user's predicted scores (not actual results)
   * - R16+ teams chain from predicted winners of previous rounds
   * This shows the user's predicted bracket, not what actually happened.
   */
  useKnockoutPredictions?: boolean;
  /**
   * When true, always resolve teams from standings/predictions, never from API teams.
   * Used by the scoring path to compute the user's predicted bracket
   * (what teams the user predicted for each slot based on their group predictions).
   */
  alwaysResolveFromStandings?: boolean;
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
  private alwaysResolveFromStandings: boolean; // Skip API teams, always use standings/predictions
  private resolved: Map<FifaMatchId, ResolvedTeams>; // FIFA match number -> teams

  constructor(params: BracketResolverParams) {
    this.matches = params.matches;
    this.predictions = params.predictions;
    this.groupStandings = params.groupStandings;
    this.thirdPlaceQualifying = params.thirdPlaceQualifying;
    this.useKnockoutPredictions = params.useKnockoutPredictions || false;
    this.alwaysResolveFromStandings =
      params.alwaysResolveFromStandings || false;
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
    const homeDisplayName = home?.tla ?? getBracketLabel(fifaNumber, "home");
    const awayDisplayName = away?.tla ?? getBracketLabel(fifaNumber, "away");
    this.resolved.set(fifaNumber, {
      home,
      away,
      homeDisplayName,
      awayDisplayName,
    });
  }

  // Check if a team from API is valid (not a bracket-label placeholder like "1A", "TBD")
  // Placeholder teams with negative IDs (EU1, IC2, etc.) ARE valid — they represent
  // real teams in the simulation/tournament that play, score, and advance.
  private isValidApiTeam(team: Team | null): boolean {
    if (!team) return false;
    if (!team.id || team.id === 0) return false;
    if (!team.tla || team.tla.length === 0) return false;
    // Check for bracket-label patterns like "1A", "28A", "TBD" — these are NOT real teams
    if (/^\d+[A-Z]$/.test(team.tla)) return false;
    if (team.tla === "TBD" || team.tla === "TBA") return false;
    return true;
  }

  // Check if a group has all matches finished (can use actual standings)
  // All teams now have IDs (including placeholder teams for TBD qualification slots)
  private isGroupComplete(group: string): boolean {
    const groupMatches = this.matches.filter(
      (m) => m.stage === "GROUP_STAGE" && m.group === group,
    );
    // All matches must be finished with scores
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

  // Determine the winning side of a finished match from score/winner fields
  private getWinningSide(match: Match): "home" | "away" | null {
    if (match.status !== "FINISHED") return null;

    const home = match.score.fullTime.home ?? 0;
    const away = match.score.fullTime.away ?? 0;

    if (home > away) return "home";
    if (away > home) return "away";

    // Tie - check winner field from the API (penalties, extra time)
    if (match.score.winner === "HOME_TEAM") return "home";
    if (match.score.winner === "AWAY_TEAM") return "away";

    // Default to home if can't determine
    return "home";
  }

  // Get actual winner of a finished knockout match
  // Priority: API team data → bracket-resolved team
  private getActualWinnerByFifa(fifaMatchNumber: FifaMatchId): Team | null {
    const match = this.matches.find((m) => m.id === fifaMatchNumber);
    if (!match) return null;

    const side = this.getWinningSide(match);
    if (!side) return null;

    // Prefer API data, fall back to bracket-resolved teams
    const apiTeam = side === "home" ? match.homeTeam : match.awayTeam;
    if (this.isValidApiTeam(apiTeam)) return apiTeam;

    const resolved = this.resolved.get(fifaMatchNumber);
    return resolved
      ? side === "home"
        ? resolved.home
        : resolved.away
      : apiTeam;
  }

  // Get actual loser of a finished knockout match
  // Priority: API team data → bracket-resolved team
  private getActualLoserByFifa(fifaMatchNumber: FifaMatchId): Team | null {
    const match = this.matches.find((m) => m.id === fifaMatchNumber);
    if (!match) return null;

    const winningSide = this.getWinningSide(match);
    if (!winningSide) return null;

    const losingSide = winningSide === "home" ? "away" : "home";

    // Prefer API data, fall back to bracket-resolved teams
    const apiTeam = losingSide === "home" ? match.homeTeam : match.awayTeam;
    if (this.isValidApiTeam(apiTeam)) return apiTeam;

    const resolved = this.resolved.get(fifaMatchNumber);
    return resolved
      ? losingSide === "home"
        ? resolved.home
        : resolved.away
      : apiTeam;
  }

  // match.id IS the FIFA number now, no mapping needed

  // Get team from group standings - only returns a team if group is complete.
  // R32 always uses actual group standings (real matchups), never predicted.
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

  // Get winner of a match
  // In prediction mode: always uses predicted winner (shows user's predicted bracket)
  // In actual mode: only returns team if match is finished
  private getWinnerByFifa(fifaMatchNumber: FifaMatchId): Team | null {
    // In prediction mode, always use predicted winner — don't fall back to actual results
    if (this.useKnockoutPredictions) {
      return this.getPredictedWinnerByFifa(fifaMatchNumber);
    }

    // Actual mode: only use real results for finished matches
    if (this.isKnockoutMatchFinished(fifaMatchNumber)) {
      return this.getActualWinnerByFifa(fifaMatchNumber);
    }

    return null; // UI will show placeholder
  }

  // Get loser of a match
  // In prediction mode: always uses predicted loser (shows user's predicted bracket)
  // In actual mode: only returns team if match is finished
  private getLoserByFifa(fifaMatchNumber: FifaMatchId): Team | null {
    // In prediction mode, always use predicted loser — don't fall back to actual results
    if (this.useKnockoutPredictions) {
      return this.getPredictedLoserByFifa(fifaMatchNumber);
    }

    // Actual mode: only use real results for finished matches
    if (this.isKnockoutMatchFinished(fifaMatchNumber)) {
      return this.getActualLoserByFifa(fifaMatchNumber);
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

    // Tie - use penalty_winner
    if (prediction.penalty_winner === "HOME") return resolved.home;
    if (prediction.penalty_winner === "AWAY") return resolved.away;

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

      // Check if API already has valid teams (skip when resolving from standings)
      const apiHomeValid =
        !this.alwaysResolveFromStandings && this.isValidApiTeam(match.homeTeam);
      const apiAwayValid =
        !this.alwaysResolveFromStandings && this.isValidApiTeam(match.awayTeam);

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

          // For third-place slots (awayPosition is null), resolve dynamically
          if (!awayTeam && bracketSlot.awayPosition === null) {
            const thirdPlaceResult = getThirdPlaceTeamForMatch(
              fifaNumber,
              this.groupStandings,
            );
            if (thirdPlaceResult) {
              awayTeam = thirdPlaceResult.team;
            }
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

      // Check if API already has valid teams (skip when resolving from standings)
      const apiHomeValid =
        !this.alwaysResolveFromStandings && this.isValidApiTeam(match.homeTeam);
      const apiAwayValid =
        !this.alwaysResolveFromStandings && this.isValidApiTeam(match.awayTeam);

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

      // Check if API already has valid teams (skip when resolving from standings)
      const apiHomeValid =
        !this.alwaysResolveFromStandings && this.isValidApiTeam(match.homeTeam);
      const apiAwayValid =
        !this.alwaysResolveFromStandings && this.isValidApiTeam(match.awayTeam);

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

      // Check if API already has valid teams (skip when resolving from standings)
      const apiHomeValid =
        !this.alwaysResolveFromStandings && this.isValidApiTeam(match.homeTeam);
      const apiAwayValid =
        !this.alwaysResolveFromStandings && this.isValidApiTeam(match.awayTeam);

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

    // Check if API already has valid teams (skip when resolving from standings)
    const apiHomeValid =
      !this.alwaysResolveFromStandings &&
      this.isValidApiTeam(thirdPlaceMatch.homeTeam);
    const apiAwayValid =
      !this.alwaysResolveFromStandings &&
      this.isValidApiTeam(thirdPlaceMatch.awayTeam);

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

    // Check if API already has valid teams (skip when resolving from standings)
    const apiHomeValid =
      !this.alwaysResolveFromStandings &&
      this.isValidApiTeam(finalMatch.homeTeam);
    const apiAwayValid =
      !this.alwaysResolveFromStandings &&
      this.isValidApiTeam(finalMatch.awayTeam);

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
