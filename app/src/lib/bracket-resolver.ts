// Bracket Resolver - resolves knockout teams based on predictions
// Simple approach: R32 uses API teams, later rounds use winners from previous rounds
import { Match, Team } from "@/types/football";
import { CalculatedStanding } from "@/types/football";
import { Prediction } from "@/types/database";

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

// Main resolver class - uses simple positional bracket pairing
export class BracketResolver {
  private matches: Match[];
  private predictions: Map<number, Prediction>;
  private resolved: Map<number, ResolvedTeams>;

  constructor(params: BracketResolverParams) {
    this.matches = params.matches;
    this.predictions = params.predictions;
    this.resolved = new Map();
  }

  // Get predicted winner of a match by API match ID
  private getPredictedWinner(apiMatchId: number): Team | null {
    const pred = this.predictions.get(apiMatchId);
    const teams = this.resolved.get(apiMatchId);
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
      // Default to home team for ties without winner selection
      return teams.home;
    }
  }

  // Get predicted loser of a match by API match ID
  private getPredictedLoser(apiMatchId: number): Team | null {
    const pred = this.predictions.get(apiMatchId);
    const teams = this.resolved.get(apiMatchId);
    if (!teams) return null;
    if (!pred || pred.home_goals === null || pred.away_goals === null) {
      // No prediction - default to away team as loser
      return teams.away;
    }

    if (pred.home_goals < pred.away_goals) {
      return teams.home;
    } else if (pred.away_goals < pred.home_goals) {
      return teams.away;
    } else {
      // Tie - loser is the one NOT selected as winner, default to away
      if (pred.winner_id) {
        if (teams.home?.id === pred.winner_id) return teams.away;
        if (teams.away?.id === pred.winner_id) return teams.home;
      }
      // Default to away team for ties without winner selection
      return teams.away;
    }
  }

  // Resolve all knockout teams
  resolve(): Map<number, ResolvedTeams> {
    // Step 1: R32 - use actual API teams
    this.resolveR32();

    // Step 2: R16 - winners from R32
    this.resolveR16();

    // Step 3: QF - winners from R16
    this.resolveQF();

    // Step 4: SF - winners from QF
    this.resolveSF();

    // Step 5: Third Place - SF losers
    this.resolveThirdPlace();

    // Step 6: Final - SF winners
    this.resolveFinal();

    return this.resolved;
  }

  // R32: Use actual teams from the API match - these are the real fixtures
  private resolveR32(): void {
    const r32Matches = this.matches.filter((m) => m.stage === "LAST_32");

    for (const match of r32Matches) {
      // Use the actual teams from the API - these ARE the R32 fixtures
      this.resolved.set(match.id, {
        home: match.homeTeam,
        away: match.awayTeam,
      });
    }
  }

  // R16: Each match gets winners from two R32 matches
  // Bracket pairing: R16[0] gets R32[0] vs R32[1], R16[1] gets R32[2] vs R32[3], etc.
  private resolveR16(): void {
    const r32Matches = sortByDate(
      this.matches.filter((m) => m.stage === "LAST_32"),
    );
    const r16Matches = sortByDate(
      this.matches.filter((m) => m.stage === "LAST_16"),
    );

    for (let i = 0; i < r16Matches.length; i++) {
      const match = r16Matches[i];
      const r32HomeIdx = i * 2;
      const r32AwayIdx = i * 2 + 1;

      const homeTeam =
        r32HomeIdx < r32Matches.length
          ? this.getPredictedWinner(r32Matches[r32HomeIdx].id)
          : null;
      const awayTeam =
        r32AwayIdx < r32Matches.length
          ? this.getPredictedWinner(r32Matches[r32AwayIdx].id)
          : null;

      this.resolved.set(match.id, { home: homeTeam, away: awayTeam });
    }
  }

  // QF: Each match gets winners from two R16 matches
  private resolveQF(): void {
    const r16Matches = sortByDate(
      this.matches.filter((m) => m.stage === "LAST_16"),
    );
    const qfMatches = sortByDate(
      this.matches.filter((m) => m.stage === "QUARTER_FINALS"),
    );

    for (let i = 0; i < qfMatches.length; i++) {
      const match = qfMatches[i];
      const r16HomeIdx = i * 2;
      const r16AwayIdx = i * 2 + 1;

      const homeTeam =
        r16HomeIdx < r16Matches.length
          ? this.getPredictedWinner(r16Matches[r16HomeIdx].id)
          : null;
      const awayTeam =
        r16AwayIdx < r16Matches.length
          ? this.getPredictedWinner(r16Matches[r16AwayIdx].id)
          : null;

      this.resolved.set(match.id, { home: homeTeam, away: awayTeam });
    }
  }

  // SF: Each match gets winners from two QF matches
  private resolveSF(): void {
    const qfMatches = sortByDate(
      this.matches.filter((m) => m.stage === "QUARTER_FINALS"),
    );
    const sfMatches = sortByDate(
      this.matches.filter((m) => m.stage === "SEMI_FINALS"),
    );

    for (let i = 0; i < sfMatches.length; i++) {
      const match = sfMatches[i];
      const qfHomeIdx = i * 2;
      const qfAwayIdx = i * 2 + 1;

      const homeTeam =
        qfHomeIdx < qfMatches.length
          ? this.getPredictedWinner(qfMatches[qfHomeIdx].id)
          : null;
      const awayTeam =
        qfAwayIdx < qfMatches.length
          ? this.getPredictedWinner(qfMatches[qfAwayIdx].id)
          : null;

      this.resolved.set(match.id, { home: homeTeam, away: awayTeam });
    }
  }

  // Third Place: Losers of the two SF matches
  private resolveThirdPlace(): void {
    const sfMatches = sortByDate(
      this.matches.filter((m) => m.stage === "SEMI_FINALS"),
    );
    const thirdPlaceMatch = this.matches.find((m) => m.stage === "THIRD_PLACE");

    if (!thirdPlaceMatch || sfMatches.length < 2) return;

    const homeTeam = this.getPredictedLoser(sfMatches[0].id);
    const awayTeam = this.getPredictedLoser(sfMatches[1].id);

    this.resolved.set(thirdPlaceMatch.id, { home: homeTeam, away: awayTeam });
  }

  // Final: Winners of the two SF matches
  private resolveFinal(): void {
    const sfMatches = sortByDate(
      this.matches.filter((m) => m.stage === "SEMI_FINALS"),
    );
    const finalMatch = this.matches.find((m) => m.stage === "FINAL");

    if (!finalMatch || sfMatches.length < 2) return;

    const homeTeam = this.getPredictedWinner(sfMatches[0].id);
    const awayTeam = this.getPredictedWinner(sfMatches[1].id);

    this.resolved.set(finalMatch.id, { home: homeTeam, away: awayTeam });
  }
}

// Export helper for R32Preview (still needs match number mapping for display labels)
export function buildMatchNumberMapping(matches: Match[]): Map<number, number> {
  const mapping = new Map<number, number>();

  const r32Matches = sortByDate(matches.filter((m) => m.stage === "LAST_32"));
  r32Matches.forEach((m, index) => {
    mapping.set(m.id, 73 + index);
  });

  return mapping;
}
