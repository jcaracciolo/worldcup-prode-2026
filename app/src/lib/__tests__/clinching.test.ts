import { describe, it, expect } from "vitest";
import { getClinchedPositions } from "../clinching";
import { Match, Team, asFifaMatchId } from "@/types/football";

function team(id: number, tla: string): Team {
  return { id, name: tla, shortName: tla, tla, crest: null };
}

const A = team(1, "AAA");
const B = team(2, "BBB");
const C = team(3, "CCC");
const D = team(4, "DDD");

let nextId = 100;

/** A finished group match with a score. */
function played(home: Team, away: Team, hg: number, ag: number): Match {
  return {
    id: asFifaMatchId(nextId++),
    utcDate: "2026-06-11T19:00:00Z",
    status: "FINISHED",
    matchday: 1,
    stage: "GROUP_STAGE",
    group: "GROUP_A",
    homeTeam: home,
    awayTeam: away,
    score: {
      winner: hg > ag ? "HOME_TEAM" : ag > hg ? "AWAY_TEAM" : "DRAW",
      duration: "REGULAR",
      fullTime: { home: hg, away: ag },
      halfTime: { home: 0, away: 0 },
    },
    venue: null,
    referees: [],
  } as Match;
}

/** An unplayed (scheduled) group match. */
function pending(home: Team, away: Team): Match {
  return {
    id: asFifaMatchId(nextId++),
    utcDate: "2026-06-20T19:00:00Z",
    status: "TIMED",
    matchday: 3,
    stage: "GROUP_STAGE",
    group: "GROUP_A",
    homeTeam: home,
    awayTeam: away,
    score: {
      winner: null,
      duration: "REGULAR",
      fullTime: { home: null, away: null },
      halfTime: { home: null, away: null },
    },
    venue: null,
    referees: [],
  } as Match;
}

describe("getClinchedPositions — mathematical group clinching", () => {
  it("clinches 1st on points alone with a match still to play", () => {
    // A wins its first two; everyone else is capped below A's guaranteed 6.
    const matches: Match[] = [
      played(A, B, 1, 0), // A beats B
      played(C, D, 0, 0), // C/D draw
      played(A, C, 1, 0), // A beats C → A = 6
      played(B, D, 0, 0), // B/D draw
      pending(A, D), // A's last game
      pending(B, C), // B vs C
    ];
    // A.min = 6; B.max = 4, C.max = 4, D.max = 5 → A is strictly 1st always.
    const clinched = getClinchedPositions(matches);
    expect(clinched.get(1)?.id).toBe(A.id);
  });

  it("clinches 1st via already-played head-to-head when teams can finish level (2026)", () => {
    // A beat B and C; A=6 with a game vs D (weak) left. B and C can each still
    // reach 6 — so this is NOT a pure points clinch — but A beat both head-to-head
    // (already played), so any tie at the top is broken in A's favour → A is 1st.
    const matches: Match[] = [
      played(A, B, 1, 0), // A beats B (H2H settled)
      played(C, D, 1, 0), // C beats D
      played(A, C, 1, 0), // A beats C (H2H settled) → A = 6
      played(B, D, 1, 0), // B beats D → B = 3
      pending(A, D), // A vs weak D
      pending(B, C), // B vs C (winner can reach 6)
    ];
    // A.min = 6; B.max = 6; C.max = 6; D.max = 3. Ties at 6 resolve via H2H (A won).
    const clinched = getClinchedPositions(matches);
    expect(clinched.get(1)?.id).toBe(A.id);
  });

  it("does NOT clinch when a top tie is identical head-to-head and overall GD is still open", () => {
    // A and B drew their head-to-head 0-0 (identical H2H) and both still have a
    // game to play, so the order between them depends on overall GD that isn't
    // settled yet → neither 1st nor 2nd is clinched.
    const matches: Match[] = [
      played(A, B, 0, 0), // identical, goalless head-to-head
      played(C, D, 0, 0),
      played(A, C, 1, 0), // A = 4
      played(B, D, 1, 0), // B = 4
      pending(A, D),
      pending(B, C),
    ];
    const clinched = getClinchedPositions(matches);
    expect(clinched.has(1)).toBe(false);
    expect(clinched.has(2)).toBe(false);
  });

  it("clinches nothing when only the first round has been played", () => {
    const matches: Match[] = [
      played(A, B, 1, 0),
      played(C, D, 1, 0),
      pending(A, C),
      pending(B, D),
      pending(A, D),
      pending(B, C),
    ];
    expect(getClinchedPositions(matches).size).toBe(0);
  });

  it("resolves all positions once the group is complete", () => {
    // A=9, B=6, C=3, D=0 — strictly separated.
    const matches: Match[] = [
      played(A, B, 1, 0),
      played(A, C, 1, 0),
      played(A, D, 1, 0),
      played(B, C, 1, 0),
      played(B, D, 1, 0),
      played(C, D, 1, 0),
    ];
    const clinched = getClinchedPositions(matches);
    expect(clinched.size).toBe(4);
    expect(clinched.get(1)?.id).toBe(A.id);
    expect(clinched.get(2)?.id).toBe(B.id);
    expect(clinched.get(3)?.id).toBe(C.id);
    expect(clinched.get(4)?.id).toBe(D.id);
  });

  it("returns empty before any match is played", () => {
    const matches: Match[] = [
      pending(A, B),
      pending(C, D),
      pending(A, C),
      pending(B, D),
      pending(A, D),
      pending(B, C),
    ];
    expect(getClinchedPositions(matches).size).toBe(0);
  });
});
