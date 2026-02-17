// LiveBracketResolver — Resolves the actual knockout bracket from match data.
//
// Input: just matches. Computes group standings, third-place qualifying, and
// the full knockout bracket internally.
//
// Resolution priority per slot:
//   1. Valid API team (already assigned by football-data.org)
//   2. Calculated team (from completed group standings / finished match results)
//   3. null → display name falls back to bracket label (1A, W73, L101, etc.)

import {
  Match,
  Team,
  FifaMatchId,
  asFifaMatchId,
  CalculatedStanding,
} from "@/types/football";
import { r32Bracket, r16Bracket, qfBracket, sfBracket } from "./r32-bracket";
import { getBracketLabel } from "./team-display";
import {
  getThirdPlaceTeamForMatch,
  getQualifyingThirdPlaceTeams,
} from "./third-place-ranking";
import { calculateAllActualStandings } from "./standings";

// =====================================================================
// TYPES
// =====================================================================

export interface ResolvedTeams {
  home: Team | null;
  away: Team | null;
  /** Ready-to-use display name for home team (e.g., "USA", "1A", "W73", "3rd") */
  homeDisplayName: string;
  /** Ready-to-use display name for away team */
  awayDisplayName: string;
}

export interface LiveBracket {
  readonly kind: "live";
  /** Resolved teams for each knockout match (keyed by FIFA match number) */
  teams: Map<FifaMatchId, ResolvedTeams>;
  /** Actual group standings computed from match results */
  groupStandings: Map<string, CalculatedStanding[]>;
  /** Which 3rd-place teams qualify based on actual standings */
  thirdPlaceQualifying: Map<string, boolean>;
}

// =====================================================================
// RESOLVER
// =====================================================================

export class LiveBracketResolver {
  private matches: Match[];
  private groupStandings: Map<string, CalculatedStanding[]>;
  private thirdPlaceQualifying: Map<string, boolean>;
  private resolved: Map<FifaMatchId, ResolvedTeams>;

  constructor(matches: Match[]) {
    this.matches = matches;
    this.groupStandings = calculateAllActualStandings(matches);
    this.thirdPlaceQualifying = getQualifyingThirdPlaceTeams(
      this.groupStandings,
    );
    this.resolved = new Map();
  }

  resolve(): LiveBracket {
    this.resolveR32();
    this.resolveR16();
    this.resolveQF();
    this.resolveSF();
    this.resolveThirdPlace();
    this.resolveFinal();

    return {
      kind: "live" as const,
      teams: new Map(this.resolved),
      groupStandings: this.groupStandings,
      thirdPlaceQualifying: this.thirdPlaceQualifying,
    };
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

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

  /**
   * Check if a team from the API is a real team (not a bracket-label placeholder).
   * Placeholder teams with negative IDs (EU1, IC2, etc.) ARE valid — they represent
   * real teams in the simulation/tournament.
   */
  private isValidApiTeam(team: Team | null): boolean {
    if (!team) return false;
    if (!team.id || team.id === 0) return false;
    if (!team.tla || team.tla.length === 0) return false;
    // Bracket-label patterns like "1A", "28A", "TBD" are NOT real teams
    if (/^\d+[A-Z]$/.test(team.tla)) return false;
    if (team.tla === "TBD" || team.tla === "TBA") return false;
    return true;
  }

  /** Check if all matches in a group are finished (can trust standings) */
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

  /** Get team from standings if the group is complete */
  private getTeamFromStandings(group: string, position: number): Team | null {
    if (!this.isGroupComplete(group)) return null;
    const standings = this.groupStandings.get(group);
    if (!standings || standings.length < position) return null;
    const standing = standings.find((s) => s.position === position);
    if (position === 3 && !this.thirdPlaceQualifying.get(group)) return null;
    return standing?.team || null;
  }

  /** Determine which side won a finished match */
  private getWinningSide(match: Match): "home" | "away" | null {
    if (match.status !== "FINISHED") return null;
    const home = match.score.fullTime.home ?? 0;
    const away = match.score.fullTime.away ?? 0;
    if (home > away) return "home";
    if (away > home) return "away";
    // Tie — check winner field (penalties/extra time)
    if (match.score.winner === "HOME_TEAM") return "home";
    if (match.score.winner === "AWAY_TEAM") return "away";
    return "home"; // fallback
  }

  /** Get actual winner of a finished knockout match */
  private getWinnerByFifa(fifaNumber: FifaMatchId): Team | null {
    const match = this.matches.find((m) => m.id === fifaNumber);
    if (!match || match.status !== "FINISHED") return null;
    const side = this.getWinningSide(match);
    if (!side) return null;
    // Prefer API team, fall back to bracket-resolved team
    const apiTeam = side === "home" ? match.homeTeam : match.awayTeam;
    if (this.isValidApiTeam(apiTeam)) return apiTeam;
    const resolved = this.resolved.get(fifaNumber);
    return resolved
      ? side === "home"
        ? resolved.home
        : resolved.away
      : apiTeam;
  }

  /** Get actual loser of a finished knockout match */
  private getLoserByFifa(fifaNumber: FifaMatchId): Team | null {
    const match = this.matches.find((m) => m.id === fifaNumber);
    if (!match || match.status !== "FINISHED") return null;
    const winningSide = this.getWinningSide(match);
    if (!winningSide) return null;
    const losingSide = winningSide === "home" ? "away" : "home";
    const apiTeam = losingSide === "home" ? match.homeTeam : match.awayTeam;
    if (this.isValidApiTeam(apiTeam)) return apiTeam;
    const resolved = this.resolved.get(fifaNumber);
    return resolved
      ? losingSide === "home"
        ? resolved.home
        : resolved.away
      : apiTeam;
  }

  // -------------------------------------------------------------------
  // Resolution per round
  // -------------------------------------------------------------------

  /** R32: API team → group standings → null */
  private resolveR32(): void {
    const r32Matches = this.matches.filter((m) => m.stage === "LAST_32");
    for (const match of r32Matches) {
      const fifaNumber = asFifaMatchId(match.id);
      const apiHomeValid = this.isValidApiTeam(match.homeTeam);
      const apiAwayValid = this.isValidApiTeam(match.awayTeam);

      let homeTeam: Team | null = apiHomeValid ? match.homeTeam : null;
      let awayTeam: Team | null = apiAwayValid ? match.awayTeam : null;

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
          // Third-place slots (awayPosition is null) — resolve dynamically
          if (!awayTeam && bracketSlot.awayPosition === null) {
            const thirdPlaceResult = getThirdPlaceTeamForMatch(
              fifaNumber,
              this.groupStandings,
            );
            if (thirdPlaceResult) awayTeam = thirdPlaceResult.team;
          }
        }
      }

      this.setResolved(fifaNumber, homeTeam, awayTeam);
    }
  }

  /** R16: API team → R32 winner → null */
  private resolveR16(): void {
    const r16Matches = this.matches.filter((m) => m.stage === "LAST_16");
    for (const match of r16Matches) {
      const fifaNumber = asFifaMatchId(match.id);
      const apiHomeValid = this.isValidApiTeam(match.homeTeam);
      const apiAwayValid = this.isValidApiTeam(match.awayTeam);

      let homeTeam: Team | null = apiHomeValid ? match.homeTeam : null;
      let awayTeam: Team | null = apiAwayValid ? match.awayTeam : null;

      if (!homeTeam || !awayTeam) {
        const bracketSlot = r16Bracket.find(
          (b) => b.matchNumber === fifaNumber,
        );
        if (bracketSlot) {
          if (!homeTeam)
            homeTeam = this.getWinnerByFifa(bracketSlot.homeFromR32);
          if (!awayTeam)
            awayTeam = this.getWinnerByFifa(bracketSlot.awayFromR32);
        }
      }

      this.setResolved(fifaNumber, homeTeam, awayTeam);
    }
  }

  /** QF: API team → R16 winner → null */
  private resolveQF(): void {
    const qfMatches = this.matches.filter((m) => m.stage === "QUARTER_FINALS");
    for (const match of qfMatches) {
      const fifaNumber = asFifaMatchId(match.id);
      const apiHomeValid = this.isValidApiTeam(match.homeTeam);
      const apiAwayValid = this.isValidApiTeam(match.awayTeam);

      let homeTeam: Team | null = apiHomeValid ? match.homeTeam : null;
      let awayTeam: Team | null = apiAwayValid ? match.awayTeam : null;

      if (!homeTeam || !awayTeam) {
        const bracketSlot = qfBracket.find((b) => b.matchNumber === fifaNumber);
        if (bracketSlot) {
          if (!homeTeam)
            homeTeam = this.getWinnerByFifa(bracketSlot.homeFromR16);
          if (!awayTeam)
            awayTeam = this.getWinnerByFifa(bracketSlot.awayFromR16);
        }
      }

      this.setResolved(fifaNumber, homeTeam, awayTeam);
    }
  }

  /** SF: API team → QF winner → null */
  private resolveSF(): void {
    const sfMatches = this.matches.filter((m) => m.stage === "SEMI_FINALS");
    for (const match of sfMatches) {
      const fifaNumber = asFifaMatchId(match.id);
      const apiHomeValid = this.isValidApiTeam(match.homeTeam);
      const apiAwayValid = this.isValidApiTeam(match.awayTeam);

      let homeTeam: Team | null = apiHomeValid ? match.homeTeam : null;
      let awayTeam: Team | null = apiAwayValid ? match.awayTeam : null;

      if (!homeTeam || !awayTeam) {
        const bracketSlot = sfBracket.find((b) => b.matchNumber === fifaNumber);
        if (bracketSlot) {
          if (!homeTeam)
            homeTeam = this.getWinnerByFifa(bracketSlot.homeFromQF);
          if (!awayTeam)
            awayTeam = this.getWinnerByFifa(bracketSlot.awayFromQF);
        }
      }

      this.setResolved(fifaNumber, homeTeam, awayTeam);
    }
  }

  /** Third Place: API team → SF losers → null */
  private resolveThirdPlace(): void {
    const thirdPlaceMatch = this.matches.find((m) => m.stage === "THIRD_PLACE");
    if (!thirdPlaceMatch) return;
    const fifaNumber = asFifaMatchId(thirdPlaceMatch.id);
    const apiHomeValid = this.isValidApiTeam(thirdPlaceMatch.homeTeam);
    const apiAwayValid = this.isValidApiTeam(thirdPlaceMatch.awayTeam);
    const homeTeam = apiHomeValid
      ? thirdPlaceMatch.homeTeam
      : this.getLoserByFifa(sfBracket[0].matchNumber);
    const awayTeam = apiAwayValid
      ? thirdPlaceMatch.awayTeam
      : this.getLoserByFifa(sfBracket[1].matchNumber);
    this.setResolved(fifaNumber, homeTeam, awayTeam);
  }

  /** Final: API team → SF winners → null */
  private resolveFinal(): void {
    const finalMatch = this.matches.find((m) => m.stage === "FINAL");
    if (!finalMatch) return;
    const fifaNumber = asFifaMatchId(finalMatch.id);
    const apiHomeValid = this.isValidApiTeam(finalMatch.homeTeam);
    const apiAwayValid = this.isValidApiTeam(finalMatch.awayTeam);
    const homeTeam = apiHomeValid
      ? finalMatch.homeTeam
      : this.getWinnerByFifa(sfBracket[0].matchNumber);
    const awayTeam = apiAwayValid
      ? finalMatch.awayTeam
      : this.getWinnerByFifa(sfBracket[1].matchNumber);
    this.setResolved(fifaNumber, homeTeam, awayTeam);
  }
}
