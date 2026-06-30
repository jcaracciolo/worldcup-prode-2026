import type { Match } from "@/types/football";

/**
 * football-data.org exposes extra score components that our internal `Match`
 * type does not carry. For penalty-decided knockout matches the feed puts the
 * penalty-inclusive aggregate into `fullTime` (e.g. 4-5) while the real
 * on-field score lives in `regularTime` (+ `extraTime`). We normalise that at
 * the ingestion boundary so the rest of the app sees the real score.
 */
interface RawScoreLine {
  home: number | null;
  away: number | null;
}

export interface RawFootballDataScore {
  winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
  duration: string;
  fullTime: RawScoreLine;
  halfTime: RawScoreLine;
  regularTime?: RawScoreLine | null;
  extraTime?: RawScoreLine | null;
  penalties?: RawScoreLine | null;
}

/** A raw football-data match: our `Match` shape but with the richer score. */
export type RawFootballDataMatch = Omit<Match, "score"> & {
  score: RawFootballDataScore;
};

function add(a: number | null | undefined, b: number | null | undefined): number {
  return (a ?? 0) + (b ?? 0);
}

/**
 * Normalise a raw football-data match into our internal `Match`.
 *
 * For penalty-shootout matches, `fullTime` is replaced with the real
 * pre-shootout score (`regularTime + extraTime`) and `winner` is set to the
 * side that ADVANCED (so a 1-1 draw decided on penalties scores as a draw with
 * the correct advancer for the "passes" award). All other matches pass through
 * with their extra score fields stripped to the internal shape.
 */
export function normalizePenaltyShootoutScore(
  match: RawFootballDataMatch,
): Match {
  const s = match.score;

  // Non-shootout (or missing regularTime): strip extras, keep fullTime as-is.
  if (s.duration !== "PENALTY_SHOOTOUT" || !s.regularTime) {
    return {
      ...match,
      score: {
        winner: s.winner,
        duration: s.duration,
        fullTime: s.fullTime,
        halfTime: s.halfTime,
      },
    };
  }

  // Real on-field score = score at the end of play before the shootout.
  const realHome = add(s.regularTime.home, s.extraTime?.home);
  const realAway = add(s.regularTime.away, s.extraTime?.away);

  // Determine the advancer (kept in `winner` even though fullTime is a draw):
  //   1. trust an explicit HOME/AWAY winner from the feed,
  //   2. else a decisive penalties line,
  //   3. else fall back to the penalty-inclusive fullTime comparison
  //      (covers feeds that leave winner null / penalties tied but encode the
  //      shootout result in fullTime).
  let winner: "HOME_TEAM" | "AWAY_TEAM" | null = null;
  if (s.winner === "HOME_TEAM" || s.winner === "AWAY_TEAM") {
    winner = s.winner;
  } else if (
    s.penalties &&
    s.penalties.home != null &&
    s.penalties.away != null &&
    s.penalties.home !== s.penalties.away
  ) {
    winner = s.penalties.home > s.penalties.away ? "HOME_TEAM" : "AWAY_TEAM";
  } else if (
    s.fullTime.home != null &&
    s.fullTime.away != null &&
    s.fullTime.home !== s.fullTime.away
  ) {
    winner = s.fullTime.home > s.fullTime.away ? "HOME_TEAM" : "AWAY_TEAM";
  }

  return {
    ...match,
    score: {
      winner,
      duration: s.duration,
      fullTime: { home: realHome, away: realAway },
      halfTime: s.halfTime,
    },
  };
}
