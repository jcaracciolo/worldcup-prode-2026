// LiveBracketResolver — Resolves the actual knockout bracket from match data.
//
// Input: just matches. Computes group standings, third-place qualifying, and
// the full knockout bracket internally.
//
// Single source of truth: the CALCULATED bracket. Team identity in every
// knockout slot is derived purely from results + the static bracket structure:
//   - R32: completed/clinched group standings (and qualifying third places)
//   - R16+: the winner/loser of the relevant prior knockout match (by score)
//
// API-provided team identities are intentionally NOT consulted here. The
// football-data.org feed seeds knockout teams partially and inconsistently
// during the live window (e.g. one slot filled, its opponent blank), and the
// app deliberately distrusts that feed for scores — so trusting it for team
// identity caused calculated teams to flap and disagree between tabs. The API's
// only job is supplying match scores upstream (already frozen once finished).
//
// Resolution priority per slot:
//   1. Calculated team (from completed group standings / finished match results)
//   2. null → display name falls back to bracket label (1A, W73, L101, etc.)

import { Match, Team, FifaMatchId, CalculatedStanding } from "@/types/football";
import { r32Bracket, r16Bracket, qfBracket, sfBracket } from "./r32-bracket";
import {
  getThirdPlaceTeamForMatch,
  getQualifyingThirdPlaceTeams,
  getRankedThirdPlaceTeams,
  ThirdPlaceTeam,
} from "./third-place-ranking";
import { calculateAllActualStandings } from "./standings";
import { getClinchedPositions } from "./clinching";
import { buildResolvedTeams, getWinningSide } from "./bracket-utils";
import type { ResolvedTeams } from "./bracket-utils";

export type { ResolvedTeams } from "./bracket-utils";

export interface LiveBracket {
  readonly kind: "live";
  /** Resolved teams for each knockout match (keyed by FIFA match number) */
  teams: Map<FifaMatchId, ResolvedTeams>;
  /** Actual group standings computed from match results */
  groupStandings: Map<string, CalculatedStanding[]>;
  /** Which 3rd-place teams qualify based on actual standings */
  thirdPlaceQualifying: Map<string, boolean>;
  /** Full ranked list of third-place teams based on actual standings */
  rankedThirdPlaceTeams: ThirdPlaceTeam[];
}

// =====================================================================
// RESOLVER
// =====================================================================

export class LiveBracketResolver {
  private matches: Match[];
  private groupStandings: Map<string, CalculatedStanding[]>;
  private thirdPlaceQualifying: Map<string, boolean>;
  private resolved: Map<FifaMatchId, ResolvedTeams>;
  /** Per-group positions (1/2) that are mathematically clinched, for groups
   *  that are not yet complete — lets us fill R32 slots early. */
  private clinchedByGroup: Map<string, Map<number, Team>>;

  constructor(matches: Match[]) {
    this.matches = matches;
    this.groupStandings = calculateAllActualStandings(matches);
    this.thirdPlaceQualifying = getQualifyingThirdPlaceTeams(
      this.groupStandings,
    );
    this.resolved = new Map();
    this.clinchedByGroup = this.computeClinched();
  }

  /** Compute clinched positions for each in-progress group. */
  private computeClinched(): Map<string, Map<number, Team>> {
    const result = new Map<string, Map<number, Team>>();
    const groupNames = [
      ...new Set(
        this.matches
          .filter((m) => m.stage === "GROUP_STAGE" && m.group)
          .map((m) => m.group!),
      ),
    ];
    for (const group of groupNames) {
      // Complete groups use the standings path directly; skip the work.
      if (this.isGroupComplete(group)) continue;
      const groupMatches = this.matches.filter(
        (m) => m.stage === "GROUP_STAGE" && m.group === group,
      );
      result.set(group, getClinchedPositions(groupMatches));
    }
    return result;
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
      rankedThirdPlaceTeams: getRankedThirdPlaceTeams(this.groupStandings),
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
    this.resolved.set(fifaNumber, buildResolvedTeams(fifaNumber, home, away));
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

  /** Check if ALL groups are complete (needed for third-place resolution) */
  private areAllGroupsComplete(): boolean {
    const groupNames = [...new Set(
      this.matches
        .filter((m) => m.stage === "GROUP_STAGE" && m.group)
        .map((m) => m.group!),
    )];
    return groupNames.every((g) => this.isGroupComplete(g));
  }

  /** Get team from standings if the group is complete, else from a clinched
   *  position (1st/2nd) if one is mathematically locked. */
  private getTeamFromStandings(group: string, position: number): Team | null {
    if (!this.isGroupComplete(group)) {
      // Group not finished — only fill the slot if this exact position is
      // mathematically clinched (1st/2nd only; 3rd is handled elsewhere).
      if (position === 1 || position === 2) {
        return this.clinchedByGroup.get(group)?.get(position) ?? null;
      }
      return null;
    }
    const standings = this.groupStandings.get(group);
    if (!standings || standings.length < position) return null;
    const standing = standings.find((s) => s.position === position);
    if (position === 3 && !this.thirdPlaceQualifying.get(group)) return null;
    return standing?.team || null;
  }

  /** Get actual winner of a finished knockout match (by score), using the
   *  team our bracket calculated for the winning side. */
  private getWinnerByFifa(fifaNumber: FifaMatchId): Team | null {
    const match = this.matches.find((m) => m.id === fifaNumber);
    if (!match || match.status !== "FINISHED") return null;
    const side = getWinningSide(match);
    if (!side) return null;
    const resolved = this.resolved.get(fifaNumber);
    if (!resolved) return null;
    return side === "home" ? resolved.home : resolved.away;
  }

  /** Get actual loser of a finished knockout match (by score), using the
   *  team our bracket calculated for the losing side. */
  private getLoserByFifa(fifaNumber: FifaMatchId): Team | null {
    const match = this.matches.find((m) => m.id === fifaNumber);
    if (!match || match.status !== "FINISHED") return null;
    const winningSide = getWinningSide(match);
    if (!winningSide) return null;
    const losingSide = winningSide === "home" ? "away" : "home";
    const resolved = this.resolved.get(fifaNumber);
    if (!resolved) return null;
    return losingSide === "home" ? resolved.home : resolved.away;
  }

  // -------------------------------------------------------------------
  // Resolution per round
  // -------------------------------------------------------------------

  /** R32: group standings (+ qualifying third places) → null */
  private resolveR32(): void {
    const r32Matches = this.matches.filter((m) => m.stage === "LAST_32");

    for (const match of r32Matches) {
      const fifaNumber = match.id;
      const bracketSlot = r32Bracket.find((b) => b.matchNumber === fifaNumber);

      let homeTeam: Team | null = null;
      let awayTeam: Team | null = null;

      if (bracketSlot) {
        if (bracketSlot.homePosition) {
          homeTeam = this.getTeamFromStandings(
            bracketSlot.homePosition.group,
            bracketSlot.homePosition.position,
          );
        }
        if (bracketSlot.awayPosition) {
          awayTeam = this.getTeamFromStandings(
            bracketSlot.awayPosition.group,
            bracketSlot.awayPosition.position,
          );
        }
        // Third-place slots (awayPosition is null) — resolve only when all groups are done
        if (
          !awayTeam &&
          bracketSlot.awayPosition === null &&
          this.areAllGroupsComplete()
        ) {
          const thirdPlaceResult = getThirdPlaceTeamForMatch(
            fifaNumber,
            this.groupStandings,
          );
          if (thirdPlaceResult) awayTeam = thirdPlaceResult.team;
        }
      }

      this.setResolved(fifaNumber, homeTeam, awayTeam);
    }
  }

  /** R16: R32 winner → null */
  private resolveR16(): void {
    const r16Matches = this.matches.filter((m) => m.stage === "LAST_16");
    for (const match of r16Matches) {
      const fifaNumber = match.id;
      const bracketSlot = r16Bracket.find((b) => b.matchNumber === fifaNumber);
      const homeTeam = bracketSlot
        ? this.getWinnerByFifa(bracketSlot.homeFromR32)
        : null;
      const awayTeam = bracketSlot
        ? this.getWinnerByFifa(bracketSlot.awayFromR32)
        : null;
      this.setResolved(fifaNumber, homeTeam, awayTeam);
    }
  }

  /** QF: R16 winner → null */
  private resolveQF(): void {
    const qfMatches = this.matches.filter((m) => m.stage === "QUARTER_FINALS");
    for (const match of qfMatches) {
      const fifaNumber = match.id;
      const bracketSlot = qfBracket.find((b) => b.matchNumber === fifaNumber);
      const homeTeam = bracketSlot
        ? this.getWinnerByFifa(bracketSlot.homeFromR16)
        : null;
      const awayTeam = bracketSlot
        ? this.getWinnerByFifa(bracketSlot.awayFromR16)
        : null;
      this.setResolved(fifaNumber, homeTeam, awayTeam);
    }
  }

  /** SF: QF winner → null */
  private resolveSF(): void {
    const sfMatches = this.matches.filter((m) => m.stage === "SEMI_FINALS");
    for (const match of sfMatches) {
      const fifaNumber = match.id;
      const bracketSlot = sfBracket.find((b) => b.matchNumber === fifaNumber);
      const homeTeam = bracketSlot
        ? this.getWinnerByFifa(bracketSlot.homeFromQF)
        : null;
      const awayTeam = bracketSlot
        ? this.getWinnerByFifa(bracketSlot.awayFromQF)
        : null;
      this.setResolved(fifaNumber, homeTeam, awayTeam);
    }
  }

  /** Third Place: SF losers → null */
  private resolveThirdPlace(): void {
    const thirdPlaceMatch = this.matches.find((m) => m.stage === "THIRD_PLACE");
    if (!thirdPlaceMatch) return;
    const fifaNumber = thirdPlaceMatch.id;
    const homeTeam = this.getLoserByFifa(sfBracket[0].matchNumber);
    const awayTeam = this.getLoserByFifa(sfBracket[1].matchNumber);
    this.setResolved(fifaNumber, homeTeam, awayTeam);
  }

  /** Final: SF winners → null */
  private resolveFinal(): void {
    const finalMatch = this.matches.find((m) => m.stage === "FINAL");
    if (!finalMatch) return;
    const fifaNumber = finalMatch.id;
    const homeTeam = this.getWinnerByFifa(sfBracket[0].matchNumber);
    const awayTeam = this.getWinnerByFifa(sfBracket[1].matchNumber);
    this.setResolved(fifaNumber, homeTeam, awayTeam);
  }
}
