import { describe, it, expect } from "vitest";
import { calculateActualStandings } from "../standings";
import { Match, Team, asFifaMatchId } from "@/types/football";

/** Minimal team factory. */
function team(id: number, tla: string): Team {
  return { id, name: tla, shortName: tla, tla, crest: null };
}

/** Build a FINISHED group-stage match between two teams with a given score. */
function finishedMatch(
  id: number,
  home: Team,
  away: Team,
  homeGoals: number,
  awayGoals: number,
): Match {
  return {
    id: asFifaMatchId(id),
    utcDate: "2026-06-11T19:00:00Z",
    status: "FINISHED",
    matchday: 1,
    stage: "GROUP_STAGE",
    group: "GROUP_A",
    homeTeam: home,
    awayTeam: away,
    score: {
      winner:
        homeGoals > awayGoals
          ? "HOME_TEAM"
          : awayGoals > homeGoals
            ? "AWAY_TEAM"
            : "DRAW",
      duration: "REGULAR",
      fullTime: { home: homeGoals, away: awayGoals },
      halfTime: { home: 0, away: 0 },
    },
    venue: null,
    referees: [],
  } as Match;
}

const A = team(1, "AAA");
const B = team(2, "BBB");
const C = team(3, "CCC");
const D = team(4, "DDD");

describe("group standings — FIFA head-to-head tiebreakers", () => {
  it("orders two teams level on points/GD/GF by their head-to-head result", () => {
    // A and B both: 1 win, 1 draw, 1 loss profiles engineered to be equal on
    // overall points (4), goal difference (0) and goals for (3), but A beat B.
    const matches: Match[] = [
      // Head-to-head: A beats B 2-1
      finishedMatch(1, A, B, 2, 1),
      // A draws C 1-1, A loses to D 0-1  -> A: pts 4, GF 3, GA 3, GD 0
      finishedMatch(2, A, C, 1, 1),
      finishedMatch(3, A, D, 0, 1),
      // B draws C 1-1? engineer B to match A's overall: B pts 4, GF 3, GA 3, GD 0
      // B already has loss to A (GF1,GA2). Give B a win vs D 2-1 and draw vs C 0-0.
      finishedMatch(4, B, D, 2, 1),
      finishedMatch(5, B, C, 0, 0),
    ];

    const standings = calculateActualStandings(matches);
    const byTla = (tla: string) =>
      standings.find((s) => s.team.tla === tla)!;

    // Sanity: A and B truly level on the overall three criteria.
    expect(byTla("AAA").points).toBe(byTla("BBB").points);
    expect(byTla("AAA").goalDifference).toBe(byTla("BBB").goalDifference);
    expect(byTla("AAA").goalsFor).toBe(byTla("BBB").goalsFor);

    // Head-to-head: A beat B, so A must be ranked above B.
    expect(byTla("AAA").position).toBeLessThan(byTla("BBB").position);
  });

  it("uses head-to-head goal difference among three level teams", () => {
    // Construct a 3-way tie on overall points where the mini-table separates them.
    // A, B, C each play one another; D is a punching bag they all beat 1-0,
    // keeping overall points equal (each beats D, splits the mini-league).
    const matches: Match[] = [
      // Mini-league (cyclic so points are equal, GD differs):
      finishedMatch(1, A, B, 3, 0), // A +3 vs B
      finishedMatch(2, B, C, 2, 0), // B +2 vs C
      finishedMatch(3, C, A, 1, 0), // C +1 vs A
      // Each beats D 1-0 to stay equal on overall points.
      finishedMatch(4, A, D, 1, 0),
      finishedMatch(5, B, D, 1, 0),
      finishedMatch(6, C, D, 1, 0),
    ];

    const standings = calculateActualStandings(matches);
    const order = standings
      .filter((s) => s.team.tla !== "DDD")
      .sort((a, b) => a.position - b.position)
      .map((s) => s.team.tla);

    // Overall: A, B, C each have 6 pts (two wins, one loss).
    const pts = standings
      .filter((s) => s.team.tla !== "DDD")
      .map((s) => s.points);
    expect(new Set(pts)).toEqual(new Set([6]));

    // Head-to-head mini-table among A,B,C: each has 3 pts (one win, one loss),
    // separated by H2H goal difference: A +3-1=+2, B +2-3=-1, C +1-2=-1...
    // A has best H2H GD (+2) so ranks first.
    expect(order[0]).toBe("AAA");
  });

  it("falls back deterministically when head-to-head cannot separate", () => {
    // A and B level on everything including head-to-head (they drew 1-1) and
    // identical other results. Order must be stable/deterministic (by team id).
    const matches: Match[] = [
      finishedMatch(1, A, B, 1, 1),
      finishedMatch(2, A, C, 2, 0),
      finishedMatch(3, B, C, 2, 0),
    ];

    const standings = calculateActualStandings(matches);
    const a = standings.find((s) => s.team.tla === "AAA")!;
    const b = standings.find((s) => s.team.tla === "BBB")!;

    // Equal on overall and head-to-head → deterministic: lower id (A) first.
    expect(a.points).toBe(b.points);
    expect(a.goalDifference).toBe(b.goalDifference);
    expect(a.goalsFor).toBe(b.goalsFor);
    expect(a.position).toBeLessThan(b.position);
  });

  it("does not apply head-to-head when teams differ on overall criteria", () => {
    // A clearly better on points; head-to-head must not override that.
    const matches: Match[] = [
      finishedMatch(1, A, B, 0, 1), // B beat A head-to-head
      finishedMatch(2, A, C, 5, 0), // but A racks up points elsewhere
      finishedMatch(3, A, D, 5, 0),
      finishedMatch(4, B, C, 0, 1),
      finishedMatch(5, B, D, 0, 1),
    ];

    const standings = calculateActualStandings(matches);
    const a = standings.find((s) => s.team.tla === "AAA")!;
    const b = standings.find((s) => s.team.tla === "BBB")!;

    // A has more points overall, so finishes above B despite losing the H2H.
    expect(a.points).toBeGreaterThan(b.points);
    expect(a.position).toBeLessThan(b.position);
  });
});
