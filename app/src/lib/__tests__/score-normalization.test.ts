import { describe, it, expect } from "vitest";
import {
  normalizePenaltyShootoutScore,
  type RawFootballDataMatch,
} from "../providers/score-normalization";
import { asFifaMatchId } from "@/types/football";

function rawMatch(
  score: RawFootballDataMatch["score"],
): RawFootballDataMatch {
  return {
    id: asFifaMatchId(73),
    utcDate: "2026-06-29T20:30:00Z",
    status: "FINISHED",
    matchday: 0,
    stage: "LAST_32",
    group: null,
    homeTeam: { id: 759, name: "Germany", shortName: "Germany", tla: "GER", crest: null },
    awayTeam: { id: 761, name: "Paraguay", shortName: "Paraguay", tla: "PAR", crest: null },
    score,
    venue: null,
    referees: [],
  };
}

describe("normalizePenaltyShootoutScore", () => {
  it("uses regularTime as the real score for a penalty shootout (GER 1-1 PAR)", () => {
    // The real-world bug: feed reports penalty-inclusive fullTime + null winner.
    const m = normalizePenaltyShootoutScore(
      rawMatch({
        winner: null,
        duration: "PENALTY_SHOOTOUT",
        fullTime: { home: 4, away: 5 },
        halfTime: { home: 0, away: 1 },
        regularTime: { home: 1, away: 1 },
        extraTime: { home: 0, away: 0 },
        penalties: { home: 4, away: 4 },
      }),
    );
    expect(m.score.fullTime).toEqual({ home: 1, away: 1 });
    // Advancer falls back to the penalty-inclusive fullTime (5 > 4 => away).
    expect(m.score.winner).toBe("AWAY_TEAM");
    expect(m.score.duration).toBe("PENALTY_SHOOTOUT");
  });

  it("derives the advancer from a decisive penalties line", () => {
    const m = normalizePenaltyShootoutScore(
      rawMatch({
        winner: null,
        duration: "PENALTY_SHOOTOUT",
        fullTime: { home: 0, away: 0 },
        halfTime: { home: 0, away: 0 },
        regularTime: { home: 1, away: 1 },
        extraTime: { home: 0, away: 0 },
        penalties: { home: 5, away: 3 },
      }),
    );
    expect(m.score.fullTime).toEqual({ home: 1, away: 1 });
    expect(m.score.winner).toBe("HOME_TEAM");
  });

  it("trusts an explicit HOME/AWAY winner from the feed", () => {
    const m = normalizePenaltyShootoutScore(
      rawMatch({
        winner: "HOME_TEAM",
        duration: "PENALTY_SHOOTOUT",
        fullTime: { home: 5, away: 4 },
        halfTime: { home: 0, away: 0 },
        regularTime: { home: 2, away: 2 },
        extraTime: { home: 0, away: 0 },
        penalties: { home: 5, away: 4 },
      }),
    );
    expect(m.score.fullTime).toEqual({ home: 2, away: 2 });
    expect(m.score.winner).toBe("HOME_TEAM");
  });

  it("adds extra time into the real score (2-2 after ET, then pens)", () => {
    const m = normalizePenaltyShootoutScore(
      rawMatch({
        winner: "AWAY_TEAM",
        duration: "PENALTY_SHOOTOUT",
        fullTime: { home: 5, away: 6 },
        halfTime: { home: 1, away: 0 },
        regularTime: { home: 1, away: 1 },
        extraTime: { home: 1, away: 1 },
        penalties: { home: 3, away: 4 },
      }),
    );
    expect(m.score.fullTime).toEqual({ home: 2, away: 2 });
    expect(m.score.winner).toBe("AWAY_TEAM");
  });

  it("leaves an extra-time (non-shootout) match unchanged", () => {
    const m = normalizePenaltyShootoutScore(
      rawMatch({
        winner: "HOME_TEAM",
        duration: "EXTRA_TIME",
        fullTime: { home: 2, away: 1 },
        halfTime: { home: 0, away: 1 },
        regularTime: { home: 1, away: 1 },
        extraTime: { home: 1, away: 0 },
        penalties: null,
      }),
    );
    expect(m.score.fullTime).toEqual({ home: 2, away: 1 });
    expect(m.score.winner).toBe("HOME_TEAM");
  });

  it("leaves a regular finished match unchanged and strips extras", () => {
    const m = normalizePenaltyShootoutScore(
      rawMatch({
        winner: "AWAY_TEAM",
        duration: "REGULAR",
        fullTime: { home: 0, away: 2 },
        halfTime: { home: 0, away: 1 },
      }),
    );
    expect(m.score.fullTime).toEqual({ home: 0, away: 2 });
    expect(m.score.winner).toBe("AWAY_TEAM");
    expect(m.score).not.toHaveProperty("penalties");
    expect(m.score).not.toHaveProperty("regularTime");
  });

  it("guards against a shootout with missing regularTime (left as-is)", () => {
    const m = normalizePenaltyShootoutScore(
      rawMatch({
        winner: "HOME_TEAM",
        duration: "PENALTY_SHOOTOUT",
        fullTime: { home: 3, away: 2 },
        halfTime: { home: 0, away: 0 },
        regularTime: null,
      }),
    );
    expect(m.score.fullTime).toEqual({ home: 3, away: 2 });
  });
});
