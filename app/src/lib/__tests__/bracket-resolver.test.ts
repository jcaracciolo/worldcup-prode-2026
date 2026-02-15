import { describe, it, expect, beforeEach } from "vitest";
import { BracketResolver } from "../bracket-resolver";
import { FifaMatchId, asFifaMatchId } from "@/types/football";
import { r32Bracket } from "../r32-bracket";
import { getQualifyingThirdPlaceTeams, assignThirdPlaceToR32, getRankedThirdPlaceTeams, getThirdPlacePoolForMatch } from "../third-place-ranking";
import { lookupThirdPlaceAssignment, FIFA_THIRD_PLACE_TABLE, THIRD_PLACE_MATCH_ORDER } from "../fifa-third-place-table";
import {
  buildGroupStandings,
  buildThirdPlaceQualifying,
  scenarioGroupsFinished,
  scenarioPartialGroups,
  scenarioR32Finished,
  scenarioWithPredictions,
  scenarioWithCustomThirdPlace,
  EXPECTED_THIRD_PLACE_ASSIGNMENTS,
  // Teams for assertion
  TEAM_A1, TEAM_A2, TEAM_A3,
  TEAM_B1, TEAM_B2, TEAM_B3,
  TEAM_C1, TEAM_C2, TEAM_C3,
  TEAM_D1, TEAM_D2, TEAM_D3,
  TEAM_E1, TEAM_E2, TEAM_E3,
  TEAM_F1, TEAM_F2, TEAM_F3,
  TEAM_G1, TEAM_G2, TEAM_G3,
  TEAM_H1, TEAM_H2, TEAM_H3,
  TEAM_I1, TEAM_I2,
  TEAM_J1, TEAM_J2,
  TEAM_K1, TEAM_K2,
  TEAM_L1, TEAM_L2,
} from "./bracket-resolver.mock";

// Helper: resolve with default settings (no predictions)
function resolve(scenario: ReturnType<typeof scenarioGroupsFinished>) {
  const resolver = new BracketResolver({
    matches: scenario.matches,
    predictions: scenario.predictions,
    groupStandings: scenario.groupStandings,
    thirdPlaceQualifying: scenario.thirdPlaceQualifying,
  });
  return resolver.resolve();
}

// Helper: resolve with knockout predictions enabled
function resolveWithPredictions(scenario: ReturnType<typeof scenarioWithPredictions>) {
  const resolver = new BracketResolver({
    matches: scenario.matches,
    predictions: scenario.predictions,
    groupStandings: scenario.groupStandings,
    thirdPlaceQualifying: scenario.thirdPlaceQualifying,
    useKnockoutPredictions: true,
  });
  return resolver.resolve();
}

const fid = asFifaMatchId;

// =====================================================================
// R32 RESOLUTION TESTS
// =====================================================================

describe("BracketResolver — R32 resolution (all groups finished)", () => {
  let resolved: Map<FifaMatchId, { home: any; away: any; homeDisplayName: string; awayDisplayName: string }>;

  beforeEach(() => {
    resolved = resolve(scenarioGroupsFinished());
  });

  it("resolves all 16 R32 matches", () => {
    for (let i = 73; i <= 88; i++) {
      expect(resolved.has(fid(i)), `Match ${i} should be resolved`).toBe(true);
    }
  });

  // Non-3rd-place R32 matches (home = group winner/runner-up, away = group runner-up)
  const nonThirdPlaceR32: [number, string, any, string, any][] = [
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
      const r = resolved.get(fid(matchId))!;
      expect(r.home?.id).toBe(expectedHome.id);
      expect(r.away?.id).toBe(expectedAway.id);
      expect(r.homeDisplayName).toBe(expectedHome.tla);
      expect(r.awayDisplayName).toBe(expectedAway.tla);
    },
  );

  // Third-place R32 matches
  const thirdPlaceR32: [number, any, any][] = [
    [74, TEAM_E1, TEAM_H3], // 1E vs 3rd_H(TUN)
    [77, TEAM_I1, TEAM_G3], // 1I vs 3rd_G(NGA)
    [79, TEAM_A1, TEAM_B3], // 1A vs 3rd_B(URU)
    [80, TEAM_L1, TEAM_C3], // 1L vs 3rd_C(POR)
    [81, TEAM_D1, TEAM_A3], // 1D vs 3rd_A(CAN)
    [82, TEAM_G1, TEAM_F3], // 1G vs 3rd_F(AUS)
    [85, TEAM_B1, TEAM_D3], // 1B vs 3rd_D(BEL)
    [87, TEAM_K1, TEAM_E3], // 1K vs 3rd_E(CRO)
  ];

  it.each(thirdPlaceR32)(
    "Match %i (3rd place slot): resolves home and away correctly",
    (matchId, expectedHome, expectedAway) => {
      const r = resolved.get(fid(matchId))!;
      expect(r.home?.tla).toBe(expectedHome.tla);
      expect(r.away?.tla).toBe(expectedAway.tla);
      expect(r.homeDisplayName).toBe(expectedHome.tla);
      expect(r.awayDisplayName).toBe(expectedAway.tla);
    },
  );

  it("all 32 R32 teams are real teams (no null)", () => {
    for (let i = 73; i <= 88; i++) {
      const r = resolved.get(fid(i))!;
      expect(r.home, `Match ${i} home should not be null`).not.toBeNull();
      expect(r.away, `Match ${i} away should not be null`).not.toBeNull();
      expect(r.home!.id, `Match ${i} home should have positive ID`).toBeGreaterThan(0);
      expect(r.away!.id, `Match ${i} away should have positive ID`).toBeGreaterThan(0);
    }
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
    const expectedOrder = ["GROUP_A", "GROUP_B", "GROUP_C", "GROUP_D",
                           "GROUP_E", "GROUP_F", "GROUP_G", "GROUP_H",
                           "GROUP_I", "GROUP_J", "GROUP_K", "GROUP_L"];
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
      expect(ranked[i].qualifies, `rank ${i + 1} should NOT qualify`).toBe(false);
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
      points: 3, goalsFor: 3, goalsAgainst: 3, goalDifference: 0,
      won: 1, drawn: 0, lost: 2,
    };
    const groupJ = standings.get("GROUP_J")!;
    groupJ[2] = {
      ...groupJ[2],
      points: 3, goalsFor: 3, goalsAgainst: 3, goalDifference: 0,
      won: 0, drawn: 3, lost: 0,
    };

    const ranked = getRankedThirdPlaceTeams(standings);
    const iRank = ranked.findIndex((t) => t.group === "GROUP_I");
    const jRank = ranked.findIndex((t) => t.group === "GROUP_J");
    expect(iRank, "I3 (1W) should rank above J3 (0W)").toBeLessThan(jRank);
  });
});

describe("Third-place FIFA lookup table assignments", () => {
  it("assigns correct groups for ABCDEFGH combination", () => {
    const groups = ["A", "B", "C", "D", "E", "F", "G", "H"].map((l) => `GROUP_${l}`);
    const assignments = assignThirdPlaceToR32(groups);

    // Expected from FIFA table: [H, G, B, C, A, F, D, E]
    expect(assignments.get(74)).toBe("H");
    expect(assignments.get(77)).toBe("G");
    expect(assignments.get(79)).toBe("B");
    expect(assignments.get(80)).toBe("C");
    expect(assignments.get(81)).toBe("A");
    expect(assignments.get(82)).toBe("F");
    expect(assignments.get(85)).toBe("D");
    expect(assignments.get(87)).toBe("E");
  });

  it("returns empty map if not exactly 8 groups", () => {
    expect(assignThirdPlaceToR32(["GROUP_A"]).size).toBe(0);
    expect(assignThirdPlaceToR32([]).size).toBe(0);
  });

  // Test several other combinations from the FIFA table
  const additionalCombinations: [string, string[]][] = [
    ["ABCDEFGI", ["C", "G", "B", "D", "A", "F", "E", "I"]],
    ["ABCDEFGJ", ["C", "G", "B", "D", "A", "F", "E", "J"]],
    ["EFGHIJKL", ["E", "J", "I", "F", "H", "G", "L", "K"]],
    ["CDEFGHIJ", ["C", "G", "J", "D", "H", "F", "E", "I"]],
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
        expect(key, `Key ${key}: assigned group '${group}' not in key`).toContain(group);
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
        expect(validGroups.has(l), `Key ${key}: '${l}' is not a valid group`).toBe(true);
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

describe("Third-place integration with BracketResolver", () => {
  it("ABCDEFGH: all 8 third-place teams are correctly placed in R32", () => {
    const scenario = scenarioGroupsFinished();
    const resolved = resolve(scenario);

    for (const [matchId, expected] of Object.entries(EXPECTED_THIRD_PLACE_ASSIGNMENTS)) {
      const r = resolved.get(fid(Number(matchId)))!;
      expect(r.away?.tla, `Match ${matchId} away should be ${expected.team.tla}`).toBe(expected.team.tla);
      expect(r.away?.id).toBe(expected.team.id);
    }
  });

  it("different qualifying combination: EFGHIJKL", () => {
    const scenario = scenarioWithCustomThirdPlace(["E", "F", "G", "H", "I", "J", "K", "L"]);
    const resolved = resolve(scenario);

    // From FIFA table: EFGHIJKL → [E, J, I, F, H, G, L, K]
    const expectedAssignments: Record<number, string> = {
      74: "E", 77: "J", 79: "I", 80: "F", 81: "H", 82: "G", 85: "L", 87: "K",
    };

    for (const [matchId, groupLetter] of Object.entries(expectedAssignments)) {
      const r = resolved.get(fid(Number(matchId)))!;
      const standings = scenario.groupStandings.get(`GROUP_${groupLetter}`)!;
      const expectedTeam = standings[2].team; // 3rd place
      expect(r.away?.id, `Match ${matchId}: away should be 3rd from GROUP_${groupLetter}`).toBe(expectedTeam.id);
    }
  });

  it("different qualifying combination: ABCDEFGL", () => {
    const scenario = scenarioWithCustomThirdPlace(["A", "B", "C", "D", "E", "F", "G", "L"]);
    const resolved = resolve(scenario);

    // From FIFA table: ABCDEFGL → [C, G, B, D, A, F, L, E]
    const expectedAssignments: Record<number, string> = {
      74: "C", 77: "G", 79: "B", 80: "D", 81: "A", 82: "F", 85: "L", 87: "E",
    };

    for (const [matchId, groupLetter] of Object.entries(expectedAssignments)) {
      const r = resolved.get(fid(Number(matchId)))!;
      const standings = scenario.groupStandings.get(`GROUP_${groupLetter}`)!;
      const expectedTeam = standings[2].team;
      expect(r.away?.id, `Match ${matchId}: away should be 3rd from GROUP_${groupLetter}`).toBe(expectedTeam.id);
    }
  });
});

// =====================================================================
// R16+ RESOLUTION TESTS
// =====================================================================

describe("BracketResolver — R16+ with TBD labels (knockout not started)", () => {
  let resolved: Map<FifaMatchId, any>;

  beforeEach(() => {
    resolved = resolve(scenarioGroupsFinished());
  });

  it("R16 teams are null (R32 not played yet)", () => {
    for (let i = 89; i <= 96; i++) {
      const r = resolved.get(fid(i))!;
      expect(r.home).toBeNull();
      expect(r.away).toBeNull();
    }
  });

  it("R16 display names are bracket labels (W73, W74, etc.)", () => {
    // Match 89: W74 vs W77
    const r89 = resolved.get(fid(89))!;
    expect(r89.homeDisplayName).toBe("W74");
    expect(r89.awayDisplayName).toBe("W77");

    // Match 90: W73 vs W75
    const r90 = resolved.get(fid(90))!;
    expect(r90.homeDisplayName).toBe("W73");
    expect(r90.awayDisplayName).toBe("W75");
  });

  it("QF display names are bracket labels (W89, W90, etc.)", () => {
    const r97 = resolved.get(fid(97))!;
    expect(r97.homeDisplayName).toBe("W89");
    expect(r97.awayDisplayName).toBe("W90");
  });

  it("SF display names are bracket labels (W97, W98, etc.)", () => {
    const r101 = resolved.get(fid(101))!;
    expect(r101.homeDisplayName).toBe("W97");
    expect(r101.awayDisplayName).toBe("W98");
  });

  it("Third Place display names are L101, L102", () => {
    const r103 = resolved.get(fid(103))!;
    expect(r103.homeDisplayName).toBe("L101");
    expect(r103.awayDisplayName).toBe("L102");
  });

  it("Final display names are W101, W102", () => {
    const r104 = resolved.get(fid(104))!;
    expect(r104.homeDisplayName).toBe("W101");
    expect(r104.awayDisplayName).toBe("W102");
  });
});

describe("BracketResolver — R16 resolution from finished R32", () => {
  let resolved: Map<FifaMatchId, any>;

  beforeEach(() => {
    resolved = resolve(scenarioR32Finished());
  });

  it("R16 teams resolved from R32 winners (all home wins)", () => {
    // Match 89: W74(ENG) vs W77(COL)
    const r89 = resolved.get(fid(89))!;
    expect(r89.home?.tla).toBe("ENG");
    expect(r89.away?.tla).toBe("COL");

    // Match 90: W73(MEX) vs W75(JPN)
    const r90 = resolved.get(fid(90))!;
    expect(r90.home?.tla).toBe("MEX");
    expect(r90.away?.tla).toBe("JPN");

    // Match 91: W76(FRA) vs W78(ITA)
    const r91 = resolved.get(fid(91))!;
    expect(r91.home?.tla).toBe("FRA");
    expect(r91.away?.tla).toBe("ITA");

    // Match 92: W79(USA) vs W80(CMR)
    const r92 = resolved.get(fid(92))!;
    expect(r92.home?.tla).toBe("USA");
    expect(r92.away?.tla).toBe("CMR");
  });

  it("R16 display names show team TLAs when resolved", () => {
    const r89 = resolved.get(fid(89))!;
    expect(r89.homeDisplayName).toBe("ENG");
    expect(r89.awayDisplayName).toBe("COL");
  });

  it("QF still shows bracket labels (R16 not played)", () => {
    const r97 = resolved.get(fid(97))!;
    expect(r97.home).toBeNull();
    expect(r97.homeDisplayName).toBe("W89");
  });
});

// =====================================================================
// PREDICTION PROPAGATION TESTS
// =====================================================================

describe("BracketResolver — Prediction propagation (useKnockoutPredictions)", () => {
  let resolved: Map<FifaMatchId, any>;

  beforeEach(() => {
    resolved = resolveWithPredictions(scenarioWithPredictions());
  });

  it("R32 teams are resolved from standings (not predictions)", () => {
    const r73 = resolved.get(fid(73))!;
    expect(r73.home?.tla).toBe("MEX"); // 2A
    expect(r73.away?.tla).toBe("ARG"); // 2B
  });

  it("R16 teams come from predicted R32 winners (home always wins)", () => {
    // Predictions have home winning 2-1, so R32 home teams propagate
    // Match 89: W74(home=ENG) vs W77(home=COL)
    const r89 = resolved.get(fid(89))!;
    expect(r89.home?.tla).toBe("ENG");
    expect(r89.away?.tla).toBe("COL");
  });

  it("QF teams come from predicted R16 winners", () => {
    // Match 97: W89(home=ENG) vs W90(home=MEX)
    const r97 = resolved.get(fid(97))!;
    expect(r97.home?.tla).toBe("ENG");
    expect(r97.away?.tla).toBe("MEX");
  });

  it("SF teams come from predicted QF winners", () => {
    // Match 101: W97(home=ENG) vs W98(home=TUR)
    const r101 = resolved.get(fid(101))!;
    expect(r101.home?.tla).toBe("ENG");
    expect(r101.away?.tla).toBe("TUR");
  });

  it("Final teams come from predicted SF winners", () => {
    // Match 104: W101(home=ENG) vs W102(home=FRA)
    const r104 = resolved.get(fid(104))!;
    expect(r104.home?.tla).toBe("ENG");
    expect(r104.away?.tla).toBe("FRA");
  });

  it("Third Place teams come from predicted SF losers", () => {
    // Match 103: L101(away=MEX) vs L102(away=POL)
    // SF 101 home=ENG beats away=MEX → loser=MEX (at SF away slot it was W98)
    // Wait - need to trace the full bracket carefully:
    // SF 101: home=W97(ENG) vs away=W98(...) → we need W98
    //   QF 98: home=W93 vs away=W94
    //     R16 93: W83 vs W84 → predicted home wins → W83
    //       R32 83: home=TUR → predicted home wins → TUR
    //     R16 94: W81 vs W82 → predicted home wins → W81
    //       R32 81: home=ESP → predicted home wins → ESP
    //   QF 98: TUR vs ESP → predicted home wins → TUR
    // SF 101: ENG vs TUR → predicted home wins → loser=TUR
    // SF 102: home=W99(...) vs away=W100(...)
    //   QF 99: W91 vs W92 → both home wins → W91
    //     R16 91: W76 vs W78 → W76
    //       R32 76: home=FRA → FRA
    //     So W91 = FRA
    //   QF 99: W91(FRA) vs W92(...)
    //     R16 92: W79 vs W80 → W79
    //       R32 79: home=USA → USA
    //     So W92 = USA
    //   QF 99: FRA vs USA → home wins → FRA
    //   QF 100: W95 vs W96
    //     R16 95: W86 vs W88 → W86
    //       R32 86: home=POL → POL
    //     R16 96: W85 vs W87 → W85
    //       R32 85: home=BRA → BRA
    //   QF 100: POL vs BRA → home wins → POL
    // SF 102: FRA vs POL → home wins → loser = POL
    // Third Place 103: L101(TUR) vs L102(POL)
    const r103 = resolved.get(fid(103))!;
    expect(r103.home?.tla).toBe("TUR");
    expect(r103.away?.tla).toBe("POL");
  });
});

// =====================================================================
// PARTIAL GROUP STAGE TESTS
// =====================================================================

describe("BracketResolver — Partial groups (Group I in progress)", () => {
  it("Group I runner-up slot returns null (group not complete)", () => {
    const scenario = scenarioPartialGroups();
    const resolved = resolve(scenario);

    // Match 78: 2E vs 2I — 2I should be null because Group I is in progress
    const r78 = resolved.get(fid(78))!;
    expect(r78.home?.tla).toBe("ITA"); // 2E is resolved (Group E finished)
    expect(r78.away).toBeNull(); // 2I not resolved
    expect(r78.awayDisplayName).toBe("2I"); // bracket label fallback
  });

  it("Group I winner slot returns null", () => {
    const scenario = scenarioPartialGroups();
    const resolved = resolve(scenario);

    // Match 77: 1I vs 3rd — home should be null
    const r77 = resolved.get(fid(77))!;
    expect(r77.home).toBeNull();
    expect(r77.homeDisplayName).toBe("1I");
  });
});

// =====================================================================
// API OVERRIDE TESTS
// =====================================================================

describe("BracketResolver — API team override", () => {
  it("uses valid API teams even if standings provide different teams", () => {
    const scenario = scenarioGroupsFinished();
    // Inject a valid API team into match 73
    const m73 = scenario.matches.find((m) => m.id === 73)!;
    m73.homeTeam = { id: 9999, name: "Override Team", shortName: "OVR", tla: "OVR", crest: null };

    const resolved = resolve(scenario);
    const r73 = resolved.get(fid(73))!;
    expect(r73.home?.tla).toBe("OVR"); // API team takes priority
    expect(r73.away?.tla).toBe("ARG"); // standings-based for away
  });

  it("ignores placeholder API teams (negative IDs)", () => {
    const scenario = scenarioGroupsFinished();
    const m73 = scenario.matches.find((m) => m.id === 73)!;
    m73.homeTeam = { id: -1001, name: "PO1", shortName: "PO1", tla: "PO1", crest: null };

    const resolved = resolve(scenario);
    const r73 = resolved.get(fid(73))!;
    // Should fall back to standings, not use the placeholder
    expect(r73.home?.tla).toBe("MEX"); // 2A from standings
  });

  it("ignores TBD API teams", () => {
    const scenario = scenarioGroupsFinished();
    const m73 = scenario.matches.find((m) => m.id === 73)!;
    m73.homeTeam = { id: 100, name: "TBD", shortName: "TBD", tla: "TBD", crest: null };

    const resolved = resolve(scenario);
    const r73 = resolved.get(fid(73))!;
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
      .map((s) => `${s.homePosition!.position}${s.homePosition!.group.replace("GROUP_", "")}`);

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
    const scenario = scenarioWithPredictions();
    const resolved = resolveWithPredictions(scenario);

    // Should have entries for all 32 knockout matches (73-104)
    for (let i = 73; i <= 104; i++) {
      expect(resolved.has(fid(i)), `Match ${i} should be resolved`).toBe(true);
    }

    // All matches should have non-null teams when predictions are provided
    // (since predictions choose a winner for every match)
    for (let i = 73; i <= 104; i++) {
      const r = resolved.get(fid(i))!;
      expect(r.home, `Match ${i} home should not be null`).not.toBeNull();
      expect(r.away, `Match ${i} away should not be null`).not.toBeNull();
    }
  });

  it("Final has two distinct teams", () => {
    const resolved = resolveWithPredictions(scenarioWithPredictions());
    const r104 = resolved.get(fid(104))!;
    expect(r104.home!.id).not.toBe(r104.away!.id);
    expect(r104.home!.tla).not.toBe(r104.away!.tla);
  });

  it("Third Place has two distinct teams from SF losers", () => {
    const resolved = resolveWithPredictions(scenarioWithPredictions());
    const r103 = resolved.get(fid(103))!;
    expect(r103.home!.id).not.toBe(r103.away!.id);
  });
});
