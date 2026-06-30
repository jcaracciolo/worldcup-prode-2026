// PredictionBracketResolver — Resolves a user's predicted knockout bracket.
//
// R32 teams come from the LiveBracket (users predict on actual R32 matchups).
// R32 winners and all subsequent rounds come from the user's predictions.
// Also computes predicted group standings from the user's group predictions.
//
// Resolution priority per slot:
//   1. Predicted winner/loser from user's score predictions
//   2. null → display name falls back to bracket label (W73, L101, etc.)

import { Match, Team, FifaMatchId, CalculatedStanding } from "@/types/football";
import { LocalPrediction, LocalGroupStandingsOverride, LocalThirdPlaceOverride } from "@/types/database";
import { ResolvedTeams, LiveBracket } from "./live-bracket-resolver";
import { r16Bracket, qfBracket, sfBracket } from "./r32-bracket";
import { getBracketLabel } from "./team-display";
import {
  ThirdPlaceTeam,
  getQualifyingThirdPlaceTeamsWithOverrides,
  getRankedThirdPlaceTeamsWithOverrides,
} from "./third-place-ranking";
import {
  calculateAllGroupStandings,
  calculateStandingsFromPredictions,
  groupMatchesByGroup,
} from "./standings";

// =====================================================================
// TYPES
// =====================================================================

export interface PredictedBracket {
  readonly kind: "predicted";
  /** Resolved teams for each knockout match (keyed by FIFA match number) */
  teams: Map<FifaMatchId, ResolvedTeams>;
  /** Group standings computed from user's predicted group match scores */
  groupStandings: Map<string, CalculatedStanding[]>;
  /** Which 3rd-place teams qualify based on predicted standings */
  thirdPlaceQualifying: Map<string, boolean>;
  /** Full ranked list of third-place teams (for the selection table UI) */
  rankedThirdPlaceTeams: ThirdPlaceTeam[];
}

export interface PredictionBracketParams {
  /** Live bracket — R32 teams come from here (actual matchups) */
  liveBracket: LiveBracket;
  /** All matches — used to compute predicted group standings */
  matches: Match[];
  /** User's score predictions keyed by FIFA match number */
  predictions: Map<FifaMatchId, LocalPrediction>;
  /** Optional group standings overrides for tiebreaker resolution */
  groupOverrides?: LocalGroupStandingsOverride[];
  /** Optional third-place overrides for manual ranking */
  thirdPlaceOverrides?: LocalThirdPlaceOverride[];
}

// =====================================================================
// RESOLVER
// =====================================================================

export class PredictionBracketResolver {
  private liveBracket: LiveBracket;
  private matches: Match[];
  private predictions: Map<FifaMatchId, LocalPrediction>;
  private groupOverrides: LocalGroupStandingsOverride[];
  private thirdPlaceOverrides: LocalThirdPlaceOverride[];
  private resolved: Map<FifaMatchId, ResolvedTeams>;

  constructor(params: PredictionBracketParams) {
    this.liveBracket = params.liveBracket;
    this.matches = params.matches;
    this.predictions = params.predictions;
    this.groupOverrides = params.groupOverrides || [];
    this.thirdPlaceOverrides = params.thirdPlaceOverrides || [];
    this.resolved = new Map();
  }

  resolve(): PredictedBracket {
    // Compute predicted group standings from user's group predictions
    const groupStandings = this.computePredictedStandings();
    const thirdPlaceQualifying = getQualifyingThirdPlaceTeamsWithOverrides(
      groupStandings,
      this.thirdPlaceOverrides,
    );
    const rankedThirdPlaceTeams = getRankedThirdPlaceTeamsWithOverrides(
      groupStandings,
      this.thirdPlaceOverrides,
    );

    // R32 teams come from the live bracket (actual matchups)
    this.resolveR32();

    // R16+ teams come from chaining predicted winners
    this.resolveR16();
    this.resolveQF();
    this.resolveSF();
    this.resolveThirdPlace();
    this.resolveFinal();

    return {
      kind: "predicted" as const,
      teams: new Map(this.resolved),
      groupStandings,
      thirdPlaceQualifying,
      rankedThirdPlaceTeams,
    };
  }

  // -------------------------------------------------------------------
  // Predicted group standings
  // -------------------------------------------------------------------

  private computePredictedStandings(): Map<string, CalculatedStanding[]> {
    // Convert FifaMatchId map to number map for standings utility
    const predictionMapByNumber = new Map<number, LocalPrediction>();
    this.predictions.forEach((pred, fifaId) => {
      predictionMapByNumber.set(fifaId as number, pred);
    });

    if (this.groupOverrides.length === 0) {
      // Fast path: no overrides, use the batch function
      return calculateAllGroupStandings(this.matches, predictionMapByNumber);
    }

    // With overrides: compute per-group so we can apply overrides
    const groups = groupMatchesByGroup(this.matches);
    const allStandings = new Map<string, CalculatedStanding[]>();

    groups.forEach((groupMatches, groupName) => {
      const standings = calculateStandingsFromPredictions(
        groupMatches,
        predictionMapByNumber,
      );

      // Apply manual position overrides for this group
      // Only apply if the swapped teams still have equal points
      const overridesForGroup = this.groupOverrides.filter(
        (o) => o.group_name === groupName,
      );
      if (overridesForGroup.length > 0) {
        overridesForGroup.forEach((override) => {
          const teamIndex = standings.findIndex(
            (s) => s.team.id === override.team_id,
          );
          const targetIndex = override.position - 1;
          if (
            teamIndex !== -1 &&
            targetIndex >= 0 &&
            targetIndex < standings.length &&
            teamIndex !== targetIndex &&
            standings[teamIndex].points === standings[targetIndex].points
          ) {
            const [team] = standings.splice(teamIndex, 1);
            standings.splice(override.position - 1, 0, team);
          }
        });
        // Re-assign positions after override
        standings.forEach((s, i) => {
          s.position = i + 1;
        });
      }

      allStandings.set(groupName, standings);
    });

    return allStandings;
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

  /** Get predicted winner from user's prediction for a resolved match.
   *  Only the WINNING side needs to be resolved — a team can advance on the
   *  user's prediction even if its opponent isn't known yet (e.g. a clinched
   *  team whose 3rd-place opponent is still undetermined). */
  private getPredictedWinnerByFifa(fifaNumber: FifaMatchId): Team | null {
    const resolved = this.resolved.get(fifaNumber);
    if (!resolved) return null;

    const prediction = this.predictions.get(fifaNumber);
    if (
      !prediction ||
      prediction.home_goals === null ||
      prediction.away_goals === null
    ) {
      return null;
    }

    if (prediction.home_goals > prediction.away_goals) return resolved.home;
    if (prediction.away_goals > prediction.home_goals) return resolved.away;

    // Tie — use penalty_winner
    if (prediction.penalty_winner === "HOME") return resolved.home;
    if (prediction.penalty_winner === "AWAY") return resolved.away;

    return null; // Tie with no winner selected
  }

  /** Get predicted loser from user's prediction */
  private getPredictedLoserByFifa(fifaNumber: FifaMatchId): Team | null {
    const winner = this.getPredictedWinnerByFifa(fifaNumber);
    if (!winner) return null;

    const resolved = this.resolved.get(fifaNumber);
    if (!resolved?.home || !resolved?.away) return null;

    return resolved.home.id === winner.id ? resolved.away : resolved.home;
  }

  // -------------------------------------------------------------------
  // Resolution per round
  // -------------------------------------------------------------------

  /** R32: copy teams from the live bracket (users predict on actual matchups) */
  private resolveR32(): void {
    const r32Matches = this.matches.filter((m) => m.stage === "LAST_32");
    for (const match of r32Matches) {
      const fifaNumber = match.id;
      const liveTeams = this.liveBracket.teams.get(fifaNumber);
      this.setResolved(
        fifaNumber,
        liveTeams?.home ?? null,
        liveTeams?.away ?? null,
      );
    }
  }

  /** R16: predicted winners from R32 */
  private resolveR16(): void {
    const r16Matches = this.matches.filter((m) => m.stage === "LAST_16");
    for (const match of r16Matches) {
      const fifaNumber = match.id;
      const bracketSlot = r16Bracket.find((b) => b.matchNumber === fifaNumber);
      if (!bracketSlot) {
        this.setResolved(fifaNumber, null, null);
        continue;
      }
      const homeTeam = this.getPredictedWinnerByFifa(bracketSlot.homeFromR32);
      const awayTeam = this.getPredictedWinnerByFifa(bracketSlot.awayFromR32);
      this.setResolved(fifaNumber, homeTeam, awayTeam);
    }
  }

  /** QF: predicted winners from R16 */
  private resolveQF(): void {
    const qfMatches = this.matches.filter((m) => m.stage === "QUARTER_FINALS");
    for (const match of qfMatches) {
      const fifaNumber = match.id;
      const bracketSlot = qfBracket.find((b) => b.matchNumber === fifaNumber);
      if (!bracketSlot) {
        this.setResolved(fifaNumber, null, null);
        continue;
      }
      const homeTeam = this.getPredictedWinnerByFifa(bracketSlot.homeFromR16);
      const awayTeam = this.getPredictedWinnerByFifa(bracketSlot.awayFromR16);
      this.setResolved(fifaNumber, homeTeam, awayTeam);
    }
  }

  /** SF: predicted winners from QF */
  private resolveSF(): void {
    const sfMatches = this.matches.filter((m) => m.stage === "SEMI_FINALS");
    for (const match of sfMatches) {
      const fifaNumber = match.id;
      const bracketSlot = sfBracket.find((b) => b.matchNumber === fifaNumber);
      if (!bracketSlot) {
        this.setResolved(fifaNumber, null, null);
        continue;
      }
      const homeTeam = this.getPredictedWinnerByFifa(bracketSlot.homeFromQF);
      const awayTeam = this.getPredictedWinnerByFifa(bracketSlot.awayFromQF);
      this.setResolved(fifaNumber, homeTeam, awayTeam);
    }
  }

  /** Third Place: predicted SF losers */
  private resolveThirdPlace(): void {
    const thirdPlaceMatch = this.matches.find((m) => m.stage === "THIRD_PLACE");
    if (!thirdPlaceMatch) return;
    const fifaNumber = thirdPlaceMatch.id;
    const homeTeam = this.getPredictedLoserByFifa(sfBracket[0].matchNumber);
    const awayTeam = this.getPredictedLoserByFifa(sfBracket[1].matchNumber);
    this.setResolved(fifaNumber, homeTeam, awayTeam);
  }

  /** Final: predicted SF winners */
  private resolveFinal(): void {
    const finalMatch = this.matches.find((m) => m.stage === "FINAL");
    if (!finalMatch) return;
    const fifaNumber = finalMatch.id;
    const homeTeam = this.getPredictedWinnerByFifa(sfBracket[0].matchNumber);
    const awayTeam = this.getPredictedWinnerByFifa(sfBracket[1].matchNumber);
    this.setResolved(fifaNumber, homeTeam, awayTeam);
  }
}
