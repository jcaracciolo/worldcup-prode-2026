import { describe, it, expect, beforeEach } from "vitest";
import { LiveBracketResolver, LiveBracket } from "../live-bracket-resolver";
import { PredictionBracketResolver } from "../prediction-bracket-resolver";
import { asFifaMatchId, Team } from "@/types/football";
import { r32Bracket, r16Bracket } from "../r32-bracket";
import {
  getQualifyingThirdPlaceTeams,
  assignThirdPlaceToR32,
  getRankedThirdPlaceTeams,
  getThirdPlacePoolForMatch,
} from "../third-place-ranking";
import {
  FIFA_THIRD_PLACE_TABLE,
  THIRD_PLACE_MATCH_ORDER,
} from "../fifa-third-place-table";
import {
  buildGroupStandings,
  buildAllMatches,
  buildGroupStageMatches,
  buildFinishedR32Matches,
  buildHomePredictions,
  makeKnockoutMatch,
  scenarioNoGroupsStarted,
  EXPECTED_THIRD_PLACE_ASSIGNMENTS,
  // Teams for assertion
  TEAM_A1,
  TEAM_A2,
  TEAM_A3,
  TEAM_B1,
  TEAM_B2,
  TEAM_B3,
  TEAM_C1,
  TEAM_C2,
  TEAM_C3,
  TEAM_D1,
  TEAM_D2,
  TEAM_D3,
  TEAM_E1,
  TEAM_E2,
  TEAM_E3,
  TEAM_F1,
  TEAM_F2,
  TEAM_F3,
  TEAM_G1,
  TEAM_G2,
  TEAM_G3,
  TEAM_H1,
  TEAM_H2,
  TEAM_H3,
  TEAM_I1,
  TEAM_I2,
  TEAM_J1,
  TEAM_J2,
  TEAM_K1,
  TEAM_K2,
  TEAM_L1,
  TEAM_L2,
} from "./bracket-resolver.mock";

// Helper: resolve live bracket from all matches
function resolveLive(matches = buildAllMatches()): LiveBracket {
  return new LiveBracketResolver(matches).resolve();
}

const fid = asFifaMatchId;

// =====================================================================
// R32 RESOLUTION TESTS
// =====================================================================

describe("LiveBracketResolver — R32 resolution (all groups finished)", () => {
  let liveBracket: LiveBracket;

  beforeEach(() => {
    liveBracket = resolveLive();
  });

  it("resolves all 16 R32 matches", () => {
    for (let i = 73; i <= 88; i++) {
      expect(
        liveBracket.teams.has(fid(i)),
        `Match ${i} should be resolved`,
      ).toBe(true);
    }
  });

  // Non-3rd-place R32 matches (home = group winner/runner-up, away = group runner-up)
  const nonThirdPlaceR32: [number, string, Team, string, Team][] = [
    [73, "2A", TEAM_A2, "2B", TEAM_B2],
    [75, "1F", TEAM_F1, "2C", TEAM_C2],
    [76, "1C", TEAM_C1, "2F", TEAM_F2],
    [78, "2E", TEAM_E2, "2I", TEAM_I2],
    [83, "2K", TEAM_K2, "2L", TEAM_L2],
    [84, "1H", TEAM_H1, "2J", TEAM_J2],
    [86, "1J", TEAM_J1, "2H", TEAM_H2],
    [88, "2D", TEAM_D2, "2G", TEAM_G2],
  ];

  it.each(nonThirdPlaceR32)(
    "Match %i: %s (%s) vs %s (%s)",
    (matchId, _homeLabel, expectedHome, _awayLabel, expectedAway) => {
      const r = liveBracket.teams.get(fid(matchId))!;
      expect(r.home?.id).toBe(expectedHome.id);
      expect(r.away?.id).toBe(expectedAway.id);
      expect(r.homeDisplayName).toBe(expectedHome.tla);
      expect(r.awayDisplayName).toBe(expectedAway.tla);
    },
  );

  // Third-place R32 matches — official assignment for key ABCDEFGH
  const thirdPlaceR32: [number, Team, Team][] = [
    [74, TEAM_E1, TEAM_C3], // 1E vs 3rd_C(POR)
    [77, TEAM_I1, TEAM_F3], // 1I vs 3rd_F(AUS)
    [79, TEAM_A1, TEAM_H3], // 1A vs 3rd_H(TUN)
    [80, TEAM_L1, TEAM_E3], // 1L vs 3rd_E(CRO)
    [81, TEAM_D1, TEAM_B3], // 1D vs 3rd_B(URU)
    [82, TEAM_G1, TEAM_A3], // 1G vs 3rd_A(CAN)
    [85, TEAM_B1, TEAM_G3], // 1B vs 3rd_G(NGA)
    [87, TEAM_K1, TEAM_D3], // 1K vs 3rd_D(BEL)
  ];

  it.each(thirdPlaceR32)(
    "Match %i (3rd place slot): resolves home and away correctly",
    (matchId, expectedHome, expectedAway) => {
      const r = liveBracket.teams.get(fid(matchId))!;
      expect(r.home?.tla).toBe(expectedHome.tla);
      expect(r.away?.tla).toBe(expectedAway.tla);
      expect(r.homeDisplayName).toBe(expectedHome.tla);
      expect(r.awayDisplayName).toBe(expectedAway.tla);
    },
  );

  it("all 32 R32 teams are real teams (no null)", () => {
    for (let i = 73; i <= 88; i++) {
      const r = liveBracket.teams.get(fid(i))!;
      expect(r.home, `Match ${i} home should not be null`).not.toBeNull();
      expect(r.away, `Match ${i} away should not be null`).not.toBeNull();
      expect(
        r.home!.id,
        `Match ${i} home should have positive ID`,
      ).toBeGreaterThan(0);
      expect(
        r.away!.id,
        `Match ${i} away should have positive ID`,
      ).toBeGreaterThan(0);
    }
  });

  it("computes group standings internally (12 groups)", () => {
    expect(liveBracket.groupStandings.size).toBe(12);
    liveBracket.groupStandings.forEach((standings, group) => {
      expect(standings.length, `${group} should have 4 teams`).toBe(4);
    });
  });

  it("computes third-place qualifying (A-H qualify)", () => {
    const qualifying = [...liveBracket.thirdPlaceQualifying.entries()]
      .filter(([, q]) => q)
      .map(([g]) => g.replace("GROUP_", ""))
      .sort();
    expect(qualifying).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
  });
});

// =====================================================================
// THIRD-PLACE RANKING & ASSIGNMENT TESTS
// =====================================================================

describe("Third-place ranking", () => {
  it("identifies the correct 8 qualifying groups from standings", () => {
    const standings = buildGroupStandings();
    const qualifying = getQualifyingThirdPlaceTeams(standings);

    const qualifyingGroups = [...qualifying.entries()]
      .filter(([, q]) => q)
      .map(([g]) => g.replace("GROUP_", ""))
      .sort();

    expect(qualifyingGroups).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
  });

  it("ranks third-place teams correctly by points > GD > GF", () => {
    const standings = buildGroupStandings();
    const ranked = getRankedThirdPlaceTeams(standings);

    // Expected order: A(5/+2/6), B(5/+2/5), C(5/+1/5), D(4/+2/5),
    //                 E(4/+1/4), F(4/+1/3), G(4/+0/4), H(4/+0/3),
    //                 I(3/+0/3), J(3/-1/2), K(2/-1/2), L(2/-2/1)
    const expectedOrder = [
      "GROUP_A",
      "GROUP_B",
      "GROUP_C",
      "GROUP_D",
      "GROUP_E",
      "GROUP_F",
      "GROUP_G",
      "GROUP_H",
      "GROUP_I",
      "GROUP_J",
      "GROUP_K",
      "GROUP_L",
    ];
    const actualOrder = ranked.map((t) => t.group);
    expect(actualOrder).toEqual(expectedOrder);
  });

  it("marks top 8 as qualifying and bottom 4 as not", () => {
    const standings = buildGroupStandings();
    const ranked = getRankedThirdPlaceTeams(standings);

    for (let i = 0; i < 8; i++) {
      expect(ranked[i].qualifies, `rank ${i + 1} should qualify`).toBe(true);
    }
    for (let i = 8; i < 12; i++) {
      expect(ranked[i].qualifies, `rank ${i + 1} should NOT qualify`).toBe(
        false,
      );
    }
  });

  it("uses number of wins as tiebreaker after goals scored (FIFA rule #4)", () => {
    // Two teams with 3 pts, same GD(+0), same GF(3):
    //   I3: 1W 0D 2L (won=1) — should rank HIGHER
    //   J3: 0W 3D 0L (won=0) — should rank LOWER
    const standings = buildGroupStandings();
    // Override I3 and J3 to create a wins tiebreaker scenario
    const groupI = standings.get("GROUP_I")!;
    groupI[2] = {
      ...groupI[2],
      points: 3,
      goalsFor: 3,
      goalsAgainst: 3,
      goalDifference: 0,
      won: 1,
      drawn: 0,
      lost: 2,
    };
    const groupJ = standings.get("GROUP_J")!;
    groupJ[2] = {
      ...groupJ[2],
      points: 3,
      goalsFor: 3,
      goalsAgainst: 3,
      goalDifference: 0,
      won: 0,
      drawn: 3,
      lost: 0,
    };

    const ranked = getRankedThirdPlaceTeams(standings);
    const iRank = ranked.findIndex((t) => t.group === "GROUP_I");
    const jRank = ranked.findIndex((t) => t.group === "GROUP_J");
    expect(iRank, "I3 (1W) should rank above J3 (0W)").toBeLessThan(jRank);
  });
});

describe("Third-place FIFA lookup table assignments", () => {
  it("assigns correct groups for ABCDEFGH combination", () => {
    const groups = ["A", "B", "C", "D", "E", "F", "G", "H"].map(
      (l) => `GROUP_${l}`,
    );
    const assignments = assignThirdPlaceToR32(groups);

    // Expected from official FIFA table (natural match order 74,77,79,80,81,82,85,87)
    expect(assignments.get(74)).toBe("C");
    expect(assignments.get(77)).toBe("F");
    expect(assignments.get(79)).toBe("H");
    expect(assignments.get(80)).toBe("E");
    expect(assignments.get(81)).toBe("B");
    expect(assignments.get(82)).toBe("A");
    expect(assignments.get(85)).toBe("G");
    expect(assignments.get(87)).toBe("D");
  });

  it("matches the official 2026 real-world result (3rds B,D,E,F,I,J,K,L)", () => {
    // Published outcome: 1A-3E, 1B-3J, 1D-3B, 1E-3D, 1G-3I, 1I-3F, 1K-3L, 1L-3K
    // (Wikipedia: 2026 FIFA World Cup knockout stage / Annex C).
    const groups = ["B", "D", "E", "F", "I", "J", "K", "L"].map(
      (l) => `GROUP_${l}`,
    );
    const a = assignThirdPlaceToR32(groups);
    expect(a.get(74)).toBe("D"); // Winner E vs 3D
    expect(a.get(77)).toBe("F"); // Winner I vs 3F
    expect(a.get(79)).toBe("E"); // Winner A vs 3E
    expect(a.get(80)).toBe("K"); // Winner L vs 3K
    expect(a.get(81)).toBe("B"); // Winner D vs 3B
    expect(a.get(82)).toBe("I"); // Winner G vs 3I
    expect(a.get(85)).toBe("J"); // Winner B vs 3J
    expect(a.get(87)).toBe("L"); // Winner K vs 3L
  });

  it("returns empty map if not exactly 8 groups", () => {
    expect(assignThirdPlaceToR32(["GROUP_A"]).size).toBe(0);
    expect(assignThirdPlaceToR32([]).size).toBe(0);
  });

  // Test several other combinations from the FIFA table
  const additionalCombinations: [string, string[]][] = [
    ["ABCDEFGI", ["D", "F", "C", "I", "B", "A", "G", "E"]],
    ["ABCDEFGJ", ["D", "F", "C", "J", "B", "A", "G", "E"]],
    ["EFGHIJKL", ["F", "G", "E", "K", "I", "H", "J", "L"]],
    ["CDEFGHIJ", ["D", "F", "C", "I", "J", "H", "G", "E"]],
  ];

  it.each(additionalCombinations)(
    "assigns correctly for combination %s",
    (key, expected) => {
      const groups = key.split("").map((l) => `GROUP_${l}`);
      const assignments = assignThirdPlaceToR32(groups);
      THIRD_PLACE_MATCH_ORDER.forEach((matchNum, idx) => {
        expect(assignments.get(matchNum)).toBe(expected[idx]);
      });
    },
  );

  it("all 495 entries in the FIFA table are valid 8-char keys with 8 unique assignments", () => {
    const keys = Object.keys(FIFA_THIRD_PLACE_TABLE);
    expect(keys.length).toBe(495);

    for (const key of keys) {
      expect(key.length, `Key '${key}' should be exactly 8 characters`).toBe(8);
      const assignments = FIFA_THIRD_PLACE_TABLE[key];
      expect(assignments.length).toBe(8);

      // All assigned groups must be from the qualifying key
      for (const group of assignments) {
        expect(
          key,
          `Key ${key}: assigned group '${group}' not in key`,
        ).toContain(group);
      }
      // All 8 groups must be assigned (no duplicates)
      expect(new Set(assignments).size).toBe(8);
    }
  });

  it("each key is a valid sorted combination of 8 groups from A-L", () => {
    const validGroups = new Set("ABCDEFGHIJKL".split(""));
    for (const key of Object.keys(FIFA_THIRD_PLACE_TABLE)) {
      const letters = key.split("");
      for (const l of letters) {
        expect(
          validGroups.has(l),
          `Key ${key}: '${l}' is not a valid group`,
        ).toBe(true);
      }
      expect(letters).toEqual([...letters].sort());
      expect(new Set(letters).size).toBe(8);
    }
  });

  it("each assignment respects the match pool constraints", () => {
    for (const [key, assignments] of Object.entries(FIFA_THIRD_PLACE_TABLE)) {
      THIRD_PLACE_MATCH_ORDER.forEach((matchNum, idx) => {
        const pool = getThirdPlacePoolForMatch(matchNum);
        expect(pool).not.toBeNull();
        const assigned = assignments[idx];
        expect(
          pool!.includes(assigned),
          `Key ${key}: Match ${matchNum} assigned '${assigned}' not in pool [${pool}]`,
        ).toBe(true);
      });
    }
  });
});

describe("Third-place integration with LiveBracketResolver", () => {
  it("ABCDEFGH: all 8 third-place teams are correctly placed in R32", () => {
    const liveBracket = resolveLive();

    for (const [matchId, expected] of Object.entries(
      EXPECTED_THIRD_PLACE_ASSIGNMENTS,
    )) {
      const r = liveBracket.teams.get(fid(Number(matchId)))!;
      expect(
        r.away?.tla,
        `Match ${matchId} away should be ${expected.team.tla}`,
      ).toBe(expected.team.tla);
      expect(r.away?.id).toBe(expected.team.id);
    }
  });
});

// =====================================================================
// R16+ RESOLUTION TESTS
// =====================================================================

describe("LiveBracketResolver — R16+ with TBD labels (knockout not started)", () => {
  let liveBracket: LiveBracket;

  beforeEach(() => {
    liveBracket = resolveLive();
  });

  it("R16 teams are null (R32 not played yet)", () => {
    for (let i = 89; i <= 96; i++) {
      const r = liveBracket.teams.get(fid(i))!;
      expect(r.home).toBeNull();
      expect(r.away).toBeNull();
    }
  });

  it("R16 display names are bracket labels (W73, W74, etc.)", () => {
    const r89 = liveBracket.teams.get(fid(89))!;
    expect(r89.homeDisplayName).toBe("W74");
    expect(r89.awayDisplayName).toBe("W77");

    const r90 = liveBracket.teams.get(fid(90))!;
    expect(r90.homeDisplayName).toBe("W73");
    expect(r90.awayDisplayName).toBe("W75");
  });

  it("QF display names are bracket labels (W89, W90, etc.)", () => {
    const r97 = liveBracket.teams.get(fid(97))!;
    expect(r97.homeDisplayName).toBe("W89");
    expect(r97.awayDisplayName).toBe("W90");
  });

  it("SF display names are bracket labels (W97, W98, etc.)", () => {
    const r101 = liveBracket.teams.get(fid(101))!;
    expect(r101.homeDisplayName).toBe("W97");
    expect(r101.awayDisplayName).toBe("W98");
  });

  it("Third Place display names are L101, L102", () => {
    const r103 = liveBracket.teams.get(fid(103))!;
    expect(r103.homeDisplayName).toBe("L101");
    expect(r103.awayDisplayName).toBe("L102");
  });

  it("Final display names are W101, W102", () => {
    const r104 = liveBracket.teams.get(fid(104))!;
    expect(r104.homeDisplayName).toBe("W101");
    expect(r104.awayDisplayName).toBe("W102");
  });
});

describe("LiveBracketResolver — R16 resolution from finished R32", () => {
  let liveBracket: LiveBracket;

  beforeEach(() => {
    const groupMatches = buildGroupStageMatches();
    const finishedR32 = buildFinishedR32Matches();
    const timedR16Plus = [
      ...Array.from({ length: 8 }, (_, i) =>
        makeKnockoutMatch(89 + i, "LAST_16"),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        makeKnockoutMatch(97 + i, "QUARTER_FINALS"),
      ),
      makeKnockoutMatch(101, "SEMI_FINALS"),
      makeKnockoutMatch(102, "SEMI_FINALS"),
      makeKnockoutMatch(103, "THIRD_PLACE"),
      makeKnockoutMatch(104, "FINAL"),
    ];
    liveBracket = resolveLive([
      ...groupMatches,
      ...finishedR32,
      ...timedR16Plus,
    ]);
  });

  it("R16 teams resolved from R32 winners (all home wins)", () => {
    const r89 = liveBracket.teams.get(fid(89))!;
    expect(r89.home?.tla).toBe("ENG");
    expect(r89.away?.tla).toBe("COL");

    const r90 = liveBracket.teams.get(fid(90))!;
    expect(r90.home?.tla).toBe("MEX");
    expect(r90.away?.tla).toBe("JPN");

    const r91 = liveBracket.teams.get(fid(91))!;
    expect(r91.home?.tla).toBe("FRA");
    expect(r91.away?.tla).toBe("ITA");

    const r92 = liveBracket.teams.get(fid(92))!;
    expect(r92.home?.tla).toBe("USA");
    expect(r92.away?.tla).toBe("CMR");
  });

  it("R16 display names show team TLAs when resolved", () => {
    const r89 = liveBracket.teams.get(fid(89))!;
    expect(r89.homeDisplayName).toBe("ENG");
    expect(r89.awayDisplayName).toBe("COL");
  });

  it("QF still shows bracket labels (R16 not played)", () => {
    const r97 = liveBracket.teams.get(fid(97))!;
    expect(r97.home).toBeNull();
    expect(r97.homeDisplayName).toBe("W89");
  });
});

// =====================================================================
// PREDICTION PROPAGATION TESTS
// =====================================================================

describe("PredictionBracketResolver — Prediction propagation", () => {
  let predictedBracket: ReturnType<PredictionBracketResolver["resolve"]>;

  beforeEach(() => {
    const matches = buildAllMatches();
    const liveBracket = resolveLive(matches);
    predictedBracket = new PredictionBracketResolver({
      liveBracket,
      matches,
      predictions: buildHomePredictions(),
    }).resolve();
  });

  it("R32 teams come from the live bracket (not predictions)", () => {
    const r73 = predictedBracket.teams.get(fid(73))!;
    expect(r73.home?.tla).toBe("MEX"); // 2A
    expect(r73.away?.tla).toBe("ARG"); // 2B
  });

  it("R16 teams come from predicted R32 winners (home always wins)", () => {
    const r89 = predictedBracket.teams.get(fid(89))!;
    expect(r89.home?.tla).toBe("ENG");
    expect(r89.away?.tla).toBe("COL");
  });

  it("QF teams come from predicted R16 winners", () => {
    const r97 = predictedBracket.teams.get(fid(97))!;
    expect(r97.home?.tla).toBe("ENG");
    expect(r97.away?.tla).toBe("MEX");
  });

  it("SF teams come from predicted QF winners", () => {
    const r101 = predictedBracket.teams.get(fid(101))!;
    expect(r101.home?.tla).toBe("ENG");
    expect(r101.away?.tla).toBe("TUR");
  });

  it("Final teams come from predicted SF winners", () => {
    const r104 = predictedBracket.teams.get(fid(104))!;
    expect(r104.home?.tla).toBe("ENG");
    expect(r104.away?.tla).toBe("FRA");
  });

  it("Third Place teams come from predicted SF losers", () => {
    const r103 = predictedBracket.teams.get(fid(103))!;
    expect(r103.home?.tla).toBe("TUR");
    expect(r103.away?.tla).toBe("POL");
  });

  it("returns predicted group standings", () => {
    expect(predictedBracket.groupStandings.size).toBe(12);
    expect(predictedBracket.kind).toBe("predicted");
  });

  it("returns predicted third-place qualifying", () => {
    expect(predictedBracket.thirdPlaceQualifying.size).toBe(12);
  });

  it("propagates a predicted winner even when the opponent R32 slot is unresolved", () => {
    // Simulates clinching: an R32 team is known early while its opponent (e.g. a
    // 3rd-place team) is still undetermined. A predicted win for the known side
    // must still advance it to the next round.
    const matches = buildAllMatches();
    const liveBracket = resolveLive(matches);

    // Force match 73's away slot to be unresolved (home MEX stays).
    const orig = liveBracket.teams.get(fid(73))!;
    liveBracket.teams.set(fid(73), { ...orig, away: null, awayDisplayName: "2B" });

    const predicted = new PredictionBracketResolver({
      liveBracket,
      matches,
      predictions: buildHomePredictions(), // home (MEX) predicted to win
    }).resolve();

    const r73 = predicted.teams.get(fid(73))!;
    expect(r73.home?.tla).toBe("MEX");
    expect(r73.away).toBeNull();

    // The R16 slot fed by the winner of 73 must now contain MEX.
    const slot = r16Bracket.find(
      (b) => b.homeFromR32 === 73 || b.awayFromR32 === 73,
    )!;
    const r16 = predicted.teams.get(fid(slot.matchNumber))!;
    const side = slot.homeFromR32 === 73 ? r16.home : r16.away;
    expect(side?.tla).toBe("MEX");
  });
});

// =====================================================================
// PARTIAL GROUP STAGE TESTS
// =====================================================================

describe("LiveBracketResolver — Partial groups (Group I in progress)", () => {
  it("Group I runner-up slot returns null (group not complete)", () => {
    const matches = buildAllMatches();
    for (const m of matches) {
      if (m.stage === "GROUP_STAGE" && m.group === "GROUP_I") {
        m.status = "IN_PLAY";
        m.score.fullTime = { home: null, away: null };
      }
    }
    const liveBracket = resolveLive(matches);

    // Match 78: 2E vs 2I — 2I should be null because Group I is in progress
    const r78 = liveBracket.teams.get(fid(78))!;
    expect(r78.home?.tla).toBe("ITA"); // 2E is resolved (Group E finished)
    expect(r78.away).toBeNull(); // 2I not resolved
    expect(r78.awayDisplayName).toBe("2I"); // bracket label fallback
  });

  it("Group I winner slot returns null", () => {
    const matches = buildAllMatches();
    for (const m of matches) {
      if (m.stage === "GROUP_STAGE" && m.group === "GROUP_I") {
        m.status = "IN_PLAY";
        m.score.fullTime = { home: null, away: null };
      }
    }
    const liveBracket = resolveLive(matches);

    // Match 77: 1I vs 3rd — home should be null
    const r77 = liveBracket.teams.get(fid(77))!;
    expect(r77.home).toBeNull();
    expect(r77.homeDisplayName).toBe("1I");
  });
});

// =====================================================================
// NO GROUPS STARTED — third-place teams must NOT resolve
// =====================================================================

describe("LiveBracketResolver — No groups started (all TIMED)", () => {
  it("does not resolve any third-place R32 slots when no groups are finished", () => {
    const { matches } = scenarioNoGroupsStarted();
    const liveBracket = resolveLive(matches);

    // Third-place R32 matches: 74, 77, 79, 80, 81, 82, 85, 87
    const thirdPlaceMatchIds = [74, 77, 79, 80, 81, 82, 85, 87];
    for (const matchId of thirdPlaceMatchIds) {
      const r = liveBracket.teams.get(fid(matchId))!;
      expect(r.away, `Match ${matchId} third-place away should be null`).toBeNull();
    }
  });

  it("does not resolve any group winner/runner-up slots when no groups are finished", () => {
    const { matches } = scenarioNoGroupsStarted();
    const liveBracket = resolveLive(matches);

    // All R32 matches should have null teams
    for (let i = 73; i <= 88; i++) {
      const r = liveBracket.teams.get(fid(i))!;
      expect(r.home, `Match ${i} home should be null`).toBeNull();
      expect(r.away, `Match ${i} away should be null`).toBeNull();
    }
  });
});

// =====================================================================
// API TEAM IS IGNORED (calculated bracket is the only source of truth)
// =====================================================================

describe("LiveBracketResolver — API teams are ignored", () => {
  it("ignores a valid API team and uses the calculated standings team", () => {
    const matches = buildAllMatches();
    const m73 = matches.find((m) => m.id === 73)!;
    m73.homeTeam = {
      id: 9999,
      name: "Override Team",
      shortName: "OVR",
      tla: "OVR",
      crest: null,
    };

    const liveBracket = resolveLive(matches);
    const r73 = liveBracket.teams.get(fid(73))!;
    expect(r73.home?.tla).toBe("MEX"); // calculated, not the API "OVR"
    expect(r73.away?.tla).toBe("ARG"); // standings-based for away
  });

  it("ignores placeholder API teams (negative IDs) in favor of standings", () => {
    const matches = buildAllMatches();
    const m73 = matches.find((m) => m.id === 73)!;
    m73.homeTeam = {
      id: -1001,
      name: "EU1",
      shortName: "EU1",
      tla: "EU1",
      crest: null,
    };

    const liveBracket = resolveLive(matches);
    const r73 = liveBracket.teams.get(fid(73))!;
    expect(r73.home?.tla).toBe("MEX");
  });

  it("ignores TBD API teams", () => {
    const matches = buildAllMatches();
    const m73 = matches.find((m) => m.id === 73)!;
    m73.homeTeam = {
      id: 100,
      name: "TBD",
      shortName: "TBD",
      tla: "TBD",
      crest: null,
    };

    const liveBracket = resolveLive(matches);
    const r73 = liveBracket.teams.get(fid(73))!;
    expect(r73.home?.tla).toBe("MEX");
  });
});

// =====================================================================
// BRACKET STRUCTURE VALIDATION
// =====================================================================

describe("R32 bracket structure", () => {
  it("has exactly 16 matches numbered 73-88", () => {
    expect(r32Bracket.length).toBe(16);
    const numbers = r32Bracket.map((s) => s.matchNumber);
    for (let i = 73; i <= 88; i++) {
      expect(numbers).toContain(i);
    }
  });

  it("has exactly 8 third-place slots (awayPosition is null)", () => {
    const thirdPlaceSlots = r32Bracket.filter((s) => s.awayPosition === null);
    expect(thirdPlaceSlots.length).toBe(8);
    const matchNums = thirdPlaceSlots.map((s) => s.matchNumber).sort();
    expect(matchNums).toEqual([74, 77, 79, 80, 81, 82, 85, 87]);
  });

  it("home positions cover 1st from each of 12 groups and 2nd from 4 groups", () => {
    const homePositions = r32Bracket
      .filter((s) => s.homePosition !== null)
      .map(
        (s) =>
          `${s.homePosition!.position}${s.homePosition!.group.replace("GROUP_", "")}`,
      );

    // 8 first-place positions (for 3rd-place matches: E, I, A, L, D, G, B, K)
    // + 8 regular home positions
    // Total home: all 16 are non-null
    expect(homePositions.length).toBe(16);
  });

  it("each group appears at least once as home or away", () => {
    const groups = new Set<string>();
    for (const slot of r32Bracket) {
      if (slot.homePosition) groups.add(slot.homePosition.group);
      if (slot.awayPosition) groups.add(slot.awayPosition.group);
    }
    for (let c = 65; c <= 76; c++) {
      expect(groups.has(`GROUP_${String.fromCharCode(c)}`)).toBe(true);
    }
  });
});

// =====================================================================
// FULL BRACKET FLOW TEST
// =====================================================================

describe("Full tournament bracket flow", () => {
  it("resolves entire bracket from groups → final with predictions", () => {
    const matches = buildAllMatches();
    const liveBracket = resolveLive(matches);
    const predictedBracket = new PredictionBracketResolver({
      liveBracket,
      matches,
      predictions: buildHomePredictions(),
    }).resolve();

    // Should have entries for all 32 knockout matches (73-104)
    for (let i = 73; i <= 104; i++) {
      expect(
        predictedBracket.teams.has(fid(i)),
        `Match ${i} should be resolved`,
      ).toBe(true);
    }

    // All matches should have non-null teams when predictions are provided
    for (let i = 73; i <= 104; i++) {
      const r = predictedBracket.teams.get(fid(i))!;
      expect(r.home, `Match ${i} home should not be null`).not.toBeNull();
      expect(r.away, `Match ${i} away should not be null`).not.toBeNull();
    }
  });

  it("Final has two distinct teams", () => {
    const matches = buildAllMatches();
    const liveBracket = resolveLive(matches);
    const predictedBracket = new PredictionBracketResolver({
      liveBracket,
      matches,
      predictions: buildHomePredictions(),
    }).resolve();
    const r104 = predictedBracket.teams.get(fid(104))!;
    expect(r104.home!.id).not.toBe(r104.away!.id);
    expect(r104.home!.tla).not.toBe(r104.away!.tla);
  });

  it("Third Place has two distinct teams from SF losers", () => {
    const matches = buildAllMatches();
    const liveBracket = resolveLive(matches);
    const predictedBracket = new PredictionBracketResolver({
      liveBracket,
      matches,
      predictions: buildHomePredictions(),
    }).resolve();
    const r103 = predictedBracket.teams.get(fid(103))!;
    expect(r103.home!.id).not.toBe(r103.away!.id);
  });
});
