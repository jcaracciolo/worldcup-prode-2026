import { describe, expect, it } from "vitest";
import {
  ThirdPlaceTeam,
  getRankedThirdPlaceTeams,
  getRankedThirdPlaceTeamsWithOverrides,
  getQualifyingThirdPlaceTeamsWithOverrides,
  canSwapThirdPlaceUp,
  canSwapThirdPlaceDown,
} from "../third-place-ranking";
import { CalculatedStanding } from "@/types/football";

// Helper to create a mock 3rd-place standing
function makeStanding(
  tla: string,
  points: number,
  gd: number,
  gf: number,
  won = 0,
): CalculatedStanding {
  return {
    team: { id: tla.charCodeAt(0) * 100, name: tla, shortName: tla, tla, crest: null },
    position: 3,
    points,
    goalsFor: gf,
    goalsAgainst: gf - gd,
    goalDifference: gd,
    played: 3,
    won,
    drawn: 0,
    lost: 0,
  };
}

// Helper to build group standings map with 4 teams per group (only 3rd matters)
function buildStandings(
  entries: Array<{ group: string; pts: number; gd: number; gf: number; won?: number }>,
): Map<string, CalculatedStanding[]> {
  const map = new Map<string, CalculatedStanding[]>();
  for (const e of entries) {
    const filler1 = makeStanding(`${e.group}1`, 9, 5, 8);
    const filler2 = makeStanding(`${e.group}2`, 6, 3, 6);
    const third = makeStanding(`${e.group}3`, e.pts, e.gd, e.gf, e.won ?? 0);
    const filler4 = makeStanding(`${e.group}4`, 0, -5, 1);
    map.set(e.group, [filler1, filler2, third, filler4]);
  }
  return map;
}

describe("getRankedThirdPlaceTeams", () => {
  it("ranks 12 groups with top 8 qualifying", () => {
    const standings = buildStandings([
      { group: "A", pts: 6, gd: 3, gf: 5 },
      { group: "B", pts: 6, gd: 2, gf: 4 },
      { group: "C", pts: 4, gd: 1, gf: 3 },
      { group: "D", pts: 4, gd: 0, gf: 2 },
      { group: "E", pts: 3, gd: 0, gf: 2 },
      { group: "F", pts: 3, gd: 0, gf: 1 },
      { group: "G", pts: 3, gd: -1, gf: 1 },
      { group: "H", pts: 2, gd: -1, gf: 1 },
      { group: "I", pts: 2, gd: -2, gf: 0 },
      { group: "J", pts: 1, gd: -3, gf: 0 },
      { group: "K", pts: 1, gd: -4, gf: 0 },
      { group: "L", pts: 0, gd: -5, gf: 0 },
    ]);

    const ranked = getRankedThirdPlaceTeams(standings);
    expect(ranked).toHaveLength(12);
    // Top 8 qualify
    expect(ranked.filter((t) => t.qualifies)).toHaveLength(8);
    // Bottom 4 don't
    expect(ranked.filter((t) => !t.qualifies)).toHaveLength(4);
    // First should be A (6pts, +3 GD)
    expect(ranked[0].group).toBe("A");
    expect(ranked[0].rank).toBe(1);
    // Last should be L (0pts)
    expect(ranked[11].group).toBe("L");
    expect(ranked[11].rank).toBe(12);
  });

  it("breaks ties by GD then GF then wins then group name", () => {
    const standings = buildStandings([
      { group: "A", pts: 4, gd: 2, gf: 5 },
      { group: "B", pts: 4, gd: 2, gf: 5, won: 1 },
      { group: "C", pts: 4, gd: 2, gf: 5, won: 1 },
    ]);

    const ranked = getRankedThirdPlaceTeams(standings);
    // A and B have same pts, gd, gf but B has more wins
    // B and C have same everything — alphabetical
    expect(ranked[0].group).toBe("B");
    expect(ranked[1].group).toBe("C");
    expect(ranked[2].group).toBe("A");
  });
});

describe("getRankedThirdPlaceTeamsWithOverrides", () => {
  it("returns natural ranking when no overrides", () => {
    const standings = buildStandings([
      { group: "A", pts: 6, gd: 3, gf: 5 },
      { group: "B", pts: 4, gd: 1, gf: 3 },
      { group: "C", pts: 2, gd: -1, gf: 1 },
    ]);

    const withOverrides = getRankedThirdPlaceTeamsWithOverrides(standings, []);
    const natural = getRankedThirdPlaceTeams(standings);

    expect(withOverrides.map((t) => t.group)).toEqual(
      natural.map((t) => t.group),
    );
  });

  it("applies override to reorder teams", () => {
    const standings = buildStandings([
      { group: "A", pts: 4, gd: 1, gf: 3 },
      { group: "B", pts: 4, gd: 1, gf: 3 },
      { group: "C", pts: 4, gd: 1, gf: 3 },
    ]);

    // All three tied — natural order: A, B, C (alphabetical fallback)
    const natural = getRankedThirdPlaceTeams(standings);
    expect(natural.map((t) => t.group)).toEqual(["A", "B", "C"]);

    // Override: move C to rank 1
    const overrides = [{ group_name: "C", rank: 1 }];
    const result = getRankedThirdPlaceTeamsWithOverrides(standings, overrides);
    expect(result[0].group).toBe("C");
    expect(result[0].rank).toBe(1);
  });

  it("updates qualification status after override", () => {
    // 9 groups, 8 tied — so alphabetical puts I at 9th (doesn't qualify)
    const entries = ["A", "B", "C", "D", "E", "F", "G", "H", "I"].map(
      (g) => ({ group: g, pts: 4, gd: 1, gf: 3 }),
    );
    const standings = buildStandings(entries);

    const natural = getRankedThirdPlaceTeams(standings);
    expect(natural[8].group).toBe("I");
    expect(natural[8].qualifies).toBe(false);

    // Override: move I to rank 1
    const overrides = [{ group_name: "I", rank: 1 }];
    const result = getRankedThirdPlaceTeamsWithOverrides(standings, overrides);
    expect(result[0].group).toBe("I");
    expect(result[0].qualifies).toBe(true);
    // Now A should be pushed to 9th
    expect(result[8].qualifies).toBe(false);
  });
});

describe("getQualifyingThirdPlaceTeamsWithOverrides", () => {
  it("returns map matching override-aware ranking", () => {
    const entries = ["A", "B", "C", "D", "E", "F", "G", "H", "I"].map(
      (g) => ({ group: g, pts: 4, gd: 1, gf: 3 }),
    );
    const standings = buildStandings(entries);

    const overrides = [{ group_name: "I", rank: 1 }];
    const result = getQualifyingThirdPlaceTeamsWithOverrides(
      standings,
      overrides,
    );

    expect(result.get("I")).toBe(true);
    // One of A-H should now be false (the one pushed to 9th)
    const nonQualifying = Array.from(result.entries()).filter(
      ([, q]) => !q,
    );
    expect(nonQualifying).toHaveLength(1);
  });
});

describe("canSwapThirdPlaceUp / canSwapThirdPlaceDown", () => {
  function makeTeam(
    group: string,
    pts: number,
    gd: number,
    gf: number,
    rank: number,
  ): ThirdPlaceTeam {
    return {
      ...makeStanding(group, pts, gd, gf),
      group,
      qualifies: rank <= 8,
      rank,
    };
  }

  it("allows swap when tied group straddles the qualification cutoff", () => {
    // 12 teams: ranks 1-12, teams at ranks 7-9 all have 4 pts (straddle cutoff at 8)
    const teams: ThirdPlaceTeam[] = [
      makeTeam("A", 9, 5, 8, 1),
      makeTeam("B", 8, 4, 7, 2),
      makeTeam("C", 7, 3, 6, 3),
      makeTeam("D", 6, 2, 5, 4),
      makeTeam("E", 5, 1, 4, 5),
      makeTeam("F", 5, 0, 3, 6),
      makeTeam("G", 4, 1, 3, 7),  // tied, qualifies
      makeTeam("H", 4, 0, 2, 8),  // tied, qualifies (last)
      makeTeam("I", 4, -1, 1, 9), // tied, does NOT qualify
      makeTeam("J", 2, -2, 1, 10),
      makeTeam("K", 1, -3, 0, 11),
      makeTeam("L", 0, -5, 0, 12),
    ];

    // G(7) ↔ H(8): both in tied group that straddles cutoff → swappable
    expect(canSwapThirdPlaceDown(teams, 6)).toBe(true);
    expect(canSwapThirdPlaceUp(teams, 7)).toBe(true);
    // H(8) ↔ I(9): straddles cutoff → swappable
    expect(canSwapThirdPlaceDown(teams, 7)).toBe(true);
    expect(canSwapThirdPlaceUp(teams, 8)).toBe(true);
    // G(7) can swap up? F has 5 pts, different → no
    expect(canSwapThirdPlaceUp(teams, 6)).toBe(false);
    // I(9) can swap down? J has 2 pts, different → no
    expect(canSwapThirdPlaceDown(teams, 8)).toBe(false);
  });

  it("disallows swap when tied group is entirely qualifying", () => {
    const teams: ThirdPlaceTeam[] = [
      makeTeam("A", 4, 2, 5, 1),
      makeTeam("B", 4, 1, 3, 2), // both qualify, tied group doesn't straddle cutoff
      makeTeam("C", 3, 0, 2, 3),
      makeTeam("D", 2, -1, 1, 4),
      makeTeam("E", 2, -1, 1, 5),
      makeTeam("F", 1, -2, 0, 6),
      makeTeam("G", 1, -2, 0, 7),
      makeTeam("H", 1, -3, 0, 8),
      makeTeam("I", 0, -4, 0, 9),
      makeTeam("J", 0, -4, 0, 10),
      makeTeam("K", 0, -5, 0, 11),
      makeTeam("L", 0, -5, 0, 12),
    ];

    // A and B tied at 4 pts, both qualify → no swap
    expect(canSwapThirdPlaceDown(teams, 0)).toBe(false);
    expect(canSwapThirdPlaceUp(teams, 1)).toBe(false);
  });

  it("disallows swap when tied group is entirely non-qualifying", () => {
    const teams: ThirdPlaceTeam[] = [
      makeTeam("A", 9, 5, 8, 1),
      makeTeam("B", 8, 4, 7, 2),
      makeTeam("C", 7, 3, 6, 3),
      makeTeam("D", 6, 2, 5, 4),
      makeTeam("E", 5, 1, 4, 5),
      makeTeam("F", 4, 0, 3, 6),
      makeTeam("G", 3, -1, 2, 7),
      makeTeam("H", 2, -2, 1, 8),
      makeTeam("I", 1, -3, 1, 9),  // tied at 1
      makeTeam("J", 1, -3, 0, 10), // tied at 1 — both non-qualifying
      makeTeam("K", 0, -4, 0, 11),
      makeTeam("L", 0, -5, 0, 12),
    ];

    expect(canSwapThirdPlaceDown(teams, 8)).toBe(false);
    expect(canSwapThirdPlaceUp(teams, 9)).toBe(false);
  });

  it("disallows swap when points differ", () => {
    const teams: ThirdPlaceTeam[] = [
      makeTeam("A", 6, 1, 3, 1),
      makeTeam("B", 4, 1, 3, 2),
    ];

    expect(canSwapThirdPlaceUp(teams, 1)).toBe(false);
    expect(canSwapThirdPlaceDown(teams, 0)).toBe(false);
  });

  it("handles boundary indices", () => {
    const teams: ThirdPlaceTeam[] = [
      makeTeam("A", 4, 1, 3, 1),
      makeTeam("B", 4, 1, 3, 2),
    ];

    expect(canSwapThirdPlaceUp(teams, 0)).toBe(false); // first element
    expect(canSwapThirdPlaceDown(teams, 1)).toBe(false); // last element
    expect(canSwapThirdPlaceUp(teams, -1)).toBe(false); // out of bounds
    expect(canSwapThirdPlaceDown(teams, 5)).toBe(false); // out of bounds
  });
});
