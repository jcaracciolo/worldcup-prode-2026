/**
 * Mock data for bracket-resolver tests.
 *
 * Scenario: All 72 group-stage matches FINISHED. Knockout matches are TIMED (not started).
 * API returns null teams for knockout matches (resolver must compute them from standings).
 *
 * Group standings are carefully crafted so that:
 *   - Each group has 4 teams with distinct points to make positions unambiguous
 *   - Third-place ranking (best 8 of 12) has clear ordering by points/GD/GF
 *   - The 8 qualifying 3rd-place groups are: A, B, C, D, E, F, G, H
 *     (groups I, J, K, L have weaker 3rd-place teams that don't qualify)
 *   - This maps to FIFA lookup key "ABCDEFGH"
 *     → assignments [M74, M77, M79, M80, M81, M82, M85, M87] = ["H","G","B","C","A","F","D","E"]
 */

import {
  Match,
  Team,
  FifaMatchId,
  asFifaMatchId,
  CalculatedStanding,
} from "@/types/football";
import { LocalPrediction } from "@/types/database";

// =====================================================================
// TEAM FACTORY
// =====================================================================

let _nextTeamId = 1000;

function makeTeam(tla: string, name?: string): Team {
  const id = _nextTeamId++;
  return {
    id,
    name: name ?? `Team ${tla}`,
    shortName: name ?? `Team ${tla}`,
    tla,
    crest: `https://crests.example.com/${tla.toLowerCase()}.png`,
  };
}

function nullTeam(): Team {
  return {
    id: 0,
    name: "",
    shortName: "",
    tla: "",
    crest: null,
  } as unknown as Team;
}

// =====================================================================
// ALL TEAMS (48 = 12 groups × 4)
// =====================================================================

// Group A
export const TEAM_A1 = makeTeam("USA", "United States");
export const TEAM_A2 = makeTeam("MEX", "Mexico");
export const TEAM_A3 = makeTeam("CAN", "Canada");
export const TEAM_A4 = makeTeam("JAM", "Jamaica");

// Group B
export const TEAM_B1 = makeTeam("BRA", "Brazil");
export const TEAM_B2 = makeTeam("ARG", "Argentina");
export const TEAM_B3 = makeTeam("URU", "Uruguay");
export const TEAM_B4 = makeTeam("CHI", "Chile");

// Group C
export const TEAM_C1 = makeTeam("FRA", "France");
export const TEAM_C2 = makeTeam("GER", "Germany");
export const TEAM_C3 = makeTeam("POR", "Portugal");
export const TEAM_C4 = makeTeam("AUT", "Austria");

// Group D
export const TEAM_D1 = makeTeam("ESP", "Spain");
export const TEAM_D2 = makeTeam("NED", "Netherlands");
export const TEAM_D3 = makeTeam("BEL", "Belgium");
export const TEAM_D4 = makeTeam("DEN", "Denmark");

// Group E
export const TEAM_E1 = makeTeam("ENG", "England");
export const TEAM_E2 = makeTeam("ITA", "Italy");
export const TEAM_E3 = makeTeam("CRO", "Croatia");
export const TEAM_E4 = makeTeam("SRB", "Serbia");

// Group F
export const TEAM_F1 = makeTeam("JPN", "Japan");
export const TEAM_F2 = makeTeam("KOR", "Korea Republic");
export const TEAM_F3 = makeTeam("AUS", "Australia");
export const TEAM_F4 = makeTeam("IRN", "Iran");

// Group G
export const TEAM_G1 = makeTeam("MAR", "Morocco");
export const TEAM_G2 = makeTeam("SEN", "Senegal");
export const TEAM_G3 = makeTeam("NGA", "Nigeria");
export const TEAM_G4 = makeTeam("GHA", "Ghana");

// Group H
export const TEAM_H1 = makeTeam("QAT", "Qatar");
export const TEAM_H2 = makeTeam("KSA", "Saudi Arabia");
export const TEAM_H3 = makeTeam("TUN", "Tunisia");
export const TEAM_H4 = makeTeam("IRQ", "Iraq");

// Group I (weaker 3rd place - won't qualify)
export const TEAM_I1 = makeTeam("COL", "Colombia");
export const TEAM_I2 = makeTeam("ECU", "Ecuador");
export const TEAM_I3 = makeTeam("PER", "Peru");
export const TEAM_I4 = makeTeam("BOL", "Bolivia");

// Group J (weaker 3rd place)
export const TEAM_J1 = makeTeam("POL", "Poland");
export const TEAM_J2 = makeTeam("CZE", "Czech Republic");
export const TEAM_J3 = makeTeam("SWE", "Sweden");
export const TEAM_J4 = makeTeam("NOR", "Norway");

// Group K (weaker 3rd place)
export const TEAM_K1 = makeTeam("UKR", "Ukraine");
export const TEAM_K2 = makeTeam("TUR", "Turkey");
export const TEAM_K3 = makeTeam("ROU", "Romania");
export const TEAM_K4 = makeTeam("HUN", "Hungary");

// Group L (weaker 3rd place)
export const TEAM_L1 = makeTeam("CMR", "Cameroon");
export const TEAM_L2 = makeTeam("CIV", "Côte d'Ivoire");
export const TEAM_L3 = makeTeam("ALG", "Algeria");
export const TEAM_L4 = makeTeam("EGY", "Egypt");

// =====================================================================
// STANDINGS - Position 1 = best, position 4 = worst
// Third-place qualifying order (by points, then GD, then GF):
//   A3(CAN)=5pts/+2/6, B3(URU)=5pts/+2/5, C3(POR)=5pts/+1/5,
//   D3(BEL)=4pts/+2/5, E3(CRO)=4pts/+1/4, F3(AUS)=4pts/+1/3,
//   G3(NGA)=4pts/+0/4, H3(TUN)=4pts/+0/3
//   --- cutoff (above 8 qualify) ---
//   I3(PER)=3pts/+0/3, J3(SWE)=3pts/-1/2, K3(ROU)=2pts/-1/2, L3(ALG)=2pts/-2/1
// =====================================================================

function makeStanding(
  team: Team,
  position: number,
  points: number,
  gf: number,
  ga: number,
  explicitWon?: number,
): CalculatedStanding {
  const gd = gf - ga;
  const played = 3;
  const won = explicitWon ?? Math.floor(points / 3);
  const drawn = points - won * 3;
  const lost = played - won - drawn;
  return {
    team,
    position,
    points,
    goalsFor: gf,
    goalsAgainst: ga,
    goalDifference: gd,
    played,
    won,
    drawn,
    lost,
  };
}

export function buildGroupStandings(): Map<string, CalculatedStanding[]> {
  const m = new Map<string, CalculatedStanding[]>();

  // Qualifying 3rd-place teams (pts, GD, GF clearly differentiated)
  m.set("GROUP_A", [
    makeStanding(TEAM_A1, 1, 9, 8, 1), // USA 1st
    makeStanding(TEAM_A2, 2, 6, 5, 3), // MEX 2nd
    makeStanding(TEAM_A3, 3, 5, 6, 4), // CAN 3rd — 5pts +2 GF6  (rank 1 among 3rds)
    makeStanding(TEAM_A4, 4, 0, 1, 8), // JAM 4th
  ]);
  m.set("GROUP_B", [
    makeStanding(TEAM_B1, 1, 9, 9, 2),
    makeStanding(TEAM_B2, 2, 6, 6, 3),
    makeStanding(TEAM_B3, 3, 5, 5, 3), // URU 3rd — 5pts +2 GF5  (rank 2)
    makeStanding(TEAM_B4, 4, 0, 0, 9),
  ]);
  m.set("GROUP_C", [
    makeStanding(TEAM_C1, 1, 7, 6, 2),
    makeStanding(TEAM_C2, 2, 6, 5, 3),
    makeStanding(TEAM_C3, 3, 5, 5, 4), // POR 3rd — 5pts +1 GF5  (rank 3)
    makeStanding(TEAM_C4, 4, 1, 2, 7),
  ]);
  m.set("GROUP_D", [
    makeStanding(TEAM_D1, 1, 7, 5, 1),
    makeStanding(TEAM_D2, 2, 6, 4, 2),
    makeStanding(TEAM_D3, 3, 4, 5, 3), // BEL 3rd — 4pts +2 GF5  (rank 4)
    makeStanding(TEAM_D4, 4, 1, 1, 6),
  ]);
  m.set("GROUP_E", [
    makeStanding(TEAM_E1, 1, 9, 7, 1),
    makeStanding(TEAM_E2, 2, 4, 3, 2),
    makeStanding(TEAM_E3, 3, 4, 4, 3), // CRO 3rd — 4pts +1 GF4  (rank 5)
    makeStanding(TEAM_E4, 4, 0, 1, 8),
  ]);
  m.set("GROUP_F", [
    makeStanding(TEAM_F1, 1, 9, 8, 2),
    makeStanding(TEAM_F2, 2, 5, 4, 3),
    makeStanding(TEAM_F3, 3, 4, 3, 2), // AUS 3rd — 4pts +1 GF3  (rank 6)
    makeStanding(TEAM_F4, 4, 0, 0, 7),
  ]);
  m.set("GROUP_G", [
    makeStanding(TEAM_G1, 1, 7, 5, 2),
    makeStanding(TEAM_G2, 2, 5, 4, 3),
    makeStanding(TEAM_G3, 3, 4, 4, 4), // NGA 3rd — 4pts +0 GF4  (rank 7)
    makeStanding(TEAM_G4, 4, 1, 2, 6),
  ]);
  m.set("GROUP_H", [
    makeStanding(TEAM_H1, 1, 7, 6, 3),
    makeStanding(TEAM_H2, 2, 5, 3, 2),
    makeStanding(TEAM_H3, 3, 4, 3, 3), // TUN 3rd — 4pts +0 GF3  (rank 8, last qualifier)
    makeStanding(TEAM_H4, 4, 1, 1, 5),
  ]);

  // NON-qualifying 3rd-place teams
  m.set("GROUP_I", [
    makeStanding(TEAM_I1, 1, 7, 5, 1),
    makeStanding(TEAM_I2, 2, 5, 4, 3),
    makeStanding(TEAM_I3, 3, 3, 3, 3), // PER 3rd — 3pts +0 (rank 9, doesn't qualify)
    makeStanding(TEAM_I4, 4, 1, 1, 5),
  ]);
  m.set("GROUP_J", [
    makeStanding(TEAM_J1, 1, 7, 5, 2),
    makeStanding(TEAM_J2, 2, 5, 3, 2),
    makeStanding(TEAM_J3, 3, 3, 2, 3), // SWE 3rd — 3pts -1 (rank 10)
    makeStanding(TEAM_J4, 4, 1, 1, 4),
  ]);
  m.set("GROUP_K", [
    makeStanding(TEAM_K1, 1, 9, 7, 1),
    makeStanding(TEAM_K2, 2, 4, 3, 2),
    makeStanding(TEAM_K3, 3, 2, 2, 3), // ROU 3rd — 2pts -1 (rank 11)
    makeStanding(TEAM_K4, 4, 1, 1, 6),
  ]);
  m.set("GROUP_L", [
    makeStanding(TEAM_L1, 1, 7, 6, 2),
    makeStanding(TEAM_L2, 2, 5, 4, 3),
    makeStanding(TEAM_L3, 3, 2, 1, 3), // ALG 3rd — 2pts -2 (rank 12)
    makeStanding(TEAM_L4, 4, 1, 1, 5),
  ]);

  return m;
}

/**
 * Third-place qualifying map derived from the standings above.
 * Groups A-H qualify; Groups I-L do not.
 */
export function buildThirdPlaceQualifying(): Map<string, boolean> {
  const m = new Map<string, boolean>();
  const qualifiers = [
    "GROUP_A",
    "GROUP_B",
    "GROUP_C",
    "GROUP_D",
    "GROUP_E",
    "GROUP_F",
    "GROUP_G",
    "GROUP_H",
  ];
  const nonQualifiers = ["GROUP_I", "GROUP_J", "GROUP_K", "GROUP_L"];
  for (const g of qualifiers) m.set(g, true);
  for (const g of nonQualifiers) m.set(g, false);
  return m;
}

/**
 * Expected third-place assignments for key "ABCDEFGH":
 *   [M74, M77, M79, M80, M81, M82, M85, M87] = ["H", "G", "B", "C", "A", "F", "D", "E"]
 *
 *   Match 74 (vs 1E=ENG) ← 3rd H = TUN
 *   Match 77 (vs 1I=COL) ← 3rd G = NGA
 *   Match 79 (vs 1A=USA) ← 3rd B = URU
 *   Match 80 (vs 1L=CMR) ← 3rd C = POR
 *   Match 81 (vs 1D=ESP) ← 3rd A = CAN
 *   Match 82 (vs 1G=MAR) ← 3rd F = AUS
 *   Match 85 (vs 1B=BRA) ← 3rd D = BEL
 *   Match 87 (vs 1K=UKR) ← 3rd E = CRO
 */
export const EXPECTED_THIRD_PLACE_ASSIGNMENTS: Record<
  number,
  { group: string; team: Team }
> = {
  74: { group: "GROUP_H", team: TEAM_H3 }, // TUN
  77: { group: "GROUP_G", team: TEAM_G3 }, // NGA
  79: { group: "GROUP_B", team: TEAM_B3 }, // URU
  80: { group: "GROUP_C", team: TEAM_C3 }, // POR
  81: { group: "GROUP_A", team: TEAM_A3 }, // CAN
  82: { group: "GROUP_F", team: TEAM_F3 }, // AUS
  85: { group: "GROUP_D", team: TEAM_D3 }, // BEL
  87: { group: "GROUP_E", team: TEAM_E3 }, // CRO
};

// =====================================================================
// MATCH HELPERS
// =====================================================================

const BASE_DATE = "2026-06-28T17:00:00Z";
let _matchDateOffset = 0;

function nextMatchDate(): string {
  const d = new Date(BASE_DATE);
  d.setHours(d.getHours() + _matchDateOffset * 3);
  _matchDateOffset++;
  return d.toISOString();
}

function makeGroupMatch(
  id: number,
  group: string,
  home: Team,
  away: Team,
  homeGoals: number,
  awayGoals: number,
): Match {
  const winner =
    homeGoals > awayGoals
      ? "HOME_TEAM"
      : awayGoals > homeGoals
        ? "AWAY_TEAM"
        : "DRAW";
  return {
    id: asFifaMatchId(id),
    utcDate: `2026-06-${11 + Math.floor(id / 6)}T17:00:00Z`,
    status: "FINISHED",
    matchday: 1,
    stage: "GROUP_STAGE",
    group,
    homeTeam: home,
    awayTeam: away,
    score: {
      winner,
      duration: "REGULAR",
      fullTime: { home: homeGoals, away: awayGoals },
      halfTime: { home: 0, away: 0 },
    },
    venue: "Stadium",
    referees: [],
  };
}

function makeKnockoutMatch(
  id: number,
  stage: string,
  options?: {
    homeTeam?: Team;
    awayTeam?: Team;
    status?: Match["status"];
    homeGoals?: number;
    awayGoals?: number;
    winner?: Match["score"]["winner"];
  },
): Match {
  const status = options?.status ?? "TIMED";
  const isFinished = status === "FINISHED";
  const homeGoals = options?.homeGoals ?? null;
  const awayGoals = options?.awayGoals ?? null;
  const winner: Match["score"]["winner"] = isFinished
    ? (options?.winner ??
      (homeGoals !== null && awayGoals !== null
        ? homeGoals > awayGoals
          ? "HOME_TEAM"
          : awayGoals > homeGoals
            ? "AWAY_TEAM"
            : "DRAW"
        : null))
    : null;

  return {
    id: asFifaMatchId(id),
    utcDate: nextMatchDate(),
    status,
    matchday: 0,
    stage,
    group: null,
    homeTeam: options?.homeTeam ?? nullTeam(),
    awayTeam: options?.awayTeam ?? nullTeam(),
    score: {
      winner,
      duration: "REGULAR",
      fullTime: { home: homeGoals, away: awayGoals },
      halfTime: { home: 0, away: 0 },
    },
    venue: "Stadium",
    referees: [],
  };
}

// =====================================================================
// GROUP STAGE MATCHES (6 per group × 12 = 72)
// We need them so the resolver can verify groups are "FINISHED".
// Only the status and score matter; exact pairings are less important.
// =====================================================================

function makeGroupMatches(
  startId: number,
  group: string,
  teams: Team[],
): Match[] {
  // 6 matches: round robin of 4 teams (AB, CD, AC, BD, AD, BC)
  const pairs: [number, number][] = [
    [0, 1],
    [2, 3],
    [0, 2],
    [1, 3],
    [0, 3],
    [1, 2],
  ];
  return pairs.map(([h, a], i) =>
    makeGroupMatch(
      startId + i,
      group,
      teams[h],
      teams[a],
      3 - i > 0 ? 2 : 1,
      i < 3 ? 0 : 1,
    ),
  );
}

export function buildGroupStageMatches(): Match[] {
  // Team arrays are ordered so that computed standings match the expected
  // group positions: team[0]=1st, team[2]=2nd, team[1]=3rd, team[3]=4th.
  // (With the generic scores from makeGroupMatches, positions 2 and 3
  //  are at array indices 2 and 1 respectively.)
  const groups: [string, Team[]][] = [
    ["GROUP_A", [TEAM_A1, TEAM_A3, TEAM_A2, TEAM_A4]],
    ["GROUP_B", [TEAM_B1, TEAM_B3, TEAM_B2, TEAM_B4]],
    ["GROUP_C", [TEAM_C1, TEAM_C3, TEAM_C2, TEAM_C4]],
    ["GROUP_D", [TEAM_D1, TEAM_D3, TEAM_D2, TEAM_D4]],
    ["GROUP_E", [TEAM_E1, TEAM_E3, TEAM_E2, TEAM_E4]],
    ["GROUP_F", [TEAM_F1, TEAM_F3, TEAM_F2, TEAM_F4]],
    ["GROUP_G", [TEAM_G1, TEAM_G3, TEAM_G2, TEAM_G4]],
    ["GROUP_H", [TEAM_H1, TEAM_H3, TEAM_H2, TEAM_H4]],
    ["GROUP_I", [TEAM_I1, TEAM_I3, TEAM_I2, TEAM_I4]],
    ["GROUP_J", [TEAM_J1, TEAM_J3, TEAM_J2, TEAM_J4]],
    ["GROUP_K", [TEAM_K1, TEAM_K3, TEAM_K2, TEAM_K4]],
    ["GROUP_L", [TEAM_L1, TEAM_L3, TEAM_L2, TEAM_L4]],
  ];

  const matches: Match[] = [];
  let id = 1;
  for (const [group, teams] of groups) {
    matches.push(...makeGroupMatches(id, group, teams));
    id += 6;
  }
  return matches;
}

// =====================================================================
// KNOCKOUT MATCHES — API returns null teams (resolver calculates them)
// =====================================================================

export function buildKnockoutMatches(): Match[] {
  _matchDateOffset = 0; // reset

  return [
    // R32 (73-88) – all TIMED, null teams
    ...Array.from({ length: 16 }, (_, i) =>
      makeKnockoutMatch(73 + i, "LAST_32"),
    ),
    // R16 (89-96)
    ...Array.from({ length: 8 }, (_, i) =>
      makeKnockoutMatch(89 + i, "LAST_16"),
    ),
    // QF (97-100)
    ...Array.from({ length: 4 }, (_, i) =>
      makeKnockoutMatch(97 + i, "QUARTER_FINALS"),
    ),
    // SF (101-102)
    makeKnockoutMatch(101, "SEMI_FINALS"),
    makeKnockoutMatch(102, "SEMI_FINALS"),
    // Third Place (103)
    makeKnockoutMatch(103, "THIRD_PLACE"),
    // Final (104)
    makeKnockoutMatch(104, "FINAL"),
  ];
}

/**
 * Build all matches (group + knockout) for a full tournament scenario.
 */
export function buildAllMatches(): Match[] {
  return [...buildGroupStageMatches(), ...buildKnockoutMatches()];
}

// =====================================================================
// FINISHED R32 — For testing R16+ resolution from actual results
// =====================================================================

/**
 * Build R32 matches that are FINISHED with explicit winners.
 * Uses the resolved R32 teams based on the standings above so the data is consistent.
 *
 * Returns: matches 73-88 as FINISHED.
 * Home wins all (simplifies testing).
 */
export function buildFinishedR32Matches(): Match[] {
  // Expected R32 pairings from the bracket + standings:
  //   73: 2A(MEX) vs 2B(ARG)
  //   74: 1E(ENG) vs 3rd_H(TUN)
  //   75: 1F(JPN) vs 2C(GER)
  //   76: 1C(FRA) vs 2F(KOR)
  //   77: 1I(COL) vs 3rd_G(NGA)
  //   78: 2E(ITA) vs 2I(ECU)
  //   79: 1A(USA) vs 3rd_B(URU)
  //   80: 1L(CMR) vs 3rd_C(POR)
  //   81: 1D(ESP) vs 3rd_A(CAN)
  //   82: 1G(MAR) vs 3rd_F(AUS)
  //   83: 2K(TUR) vs 2L(CIV)
  //   84: 1H(QAT) vs 2J(CZE)
  //   85: 1B(BRA) vs 3rd_D(BEL)
  //   86: 1J(POL) vs 2H(KSA)
  //   87: 1K(UKR) vs 3rd_E(CRO)
  //   88: 2D(NED) vs 2G(SEN)

  const pairings: [number, Team, Team][] = [
    [73, TEAM_A2, TEAM_B2], // MEX vs ARG
    [74, TEAM_E1, TEAM_H3], // ENG vs TUN
    [75, TEAM_F1, TEAM_C2], // JPN vs GER
    [76, TEAM_C1, TEAM_F2], // FRA vs KOR
    [77, TEAM_I1, TEAM_G3], // COL vs NGA
    [78, TEAM_E2, TEAM_I2], // ITA vs ECU
    [79, TEAM_A1, TEAM_B3], // USA vs URU
    [80, TEAM_L1, TEAM_C3], // CMR vs POR
    [81, TEAM_D1, TEAM_A3], // ESP vs CAN
    [82, TEAM_G1, TEAM_F3], // MAR vs AUS
    [83, TEAM_K2, TEAM_L2], // TUR vs CIV
    [84, TEAM_H1, TEAM_J2], // QAT vs CZE
    [85, TEAM_B1, TEAM_D3], // BRA vs BEL
    [86, TEAM_J1, TEAM_H2], // POL vs KSA
    [87, TEAM_K1, TEAM_E3], // UKR vs CRO
    [88, TEAM_D2, TEAM_G2], // NED vs SEN
  ];

  return pairings.map(([id, home, away]) =>
    makeKnockoutMatch(id, "LAST_32", {
      homeTeam: home,
      awayTeam: away,
      status: "FINISHED",
      homeGoals: 2,
      awayGoals: 1,
      winner: "HOME_TEAM",
    }),
  );
}

/**
 * Build FINISHED R16 matches (all home wins). Uses expected R32 home winners as teams.
 */
export function buildFinishedR16Matches(): Match[] {
  // R16 bracket: 89(W74 vs W77), 90(W73 vs W75), 91(W76 vs W78), 92(W79 vs W80),
  //              93(W83 vs W84), 94(W81 vs W82), 95(W86 vs W88), 96(W85 vs W87)
  // With home-wins from R32: W73=MEX, W74=ENG, W75=JPN, W76=FRA, W77=COL, W78=ITA,
  //   W79=USA, W80=CMR, W81=ESP, W82=MAR, W83=TUR, W84=QAT, W85=BRA, W86=POL, W87=UKR, W88=NED
  const pairings: [number, Team, Team][] = [
    [89, TEAM_E1, TEAM_I1], // ENG vs COL
    [90, TEAM_A2, TEAM_F1], // MEX vs JPN
    [91, TEAM_C1, TEAM_E2], // FRA vs ITA
    [92, TEAM_A1, TEAM_L1], // USA vs CMR
    [93, TEAM_K2, TEAM_H1], // TUR vs QAT
    [94, TEAM_D1, TEAM_G1], // ESP vs MAR
    [95, TEAM_J1, TEAM_D2], // POL vs NED
    [96, TEAM_B1, TEAM_K1], // BRA vs UKR
  ];

  return pairings.map(([id, home, away]) =>
    makeKnockoutMatch(id, "LAST_16", {
      homeTeam: home,
      awayTeam: away,
      status: "FINISHED",
      homeGoals: 1,
      awayGoals: 0,
      winner: "HOME_TEAM",
    }),
  );
}

// =====================================================================
// PREDICTIONS — for testing knockout prediction propagation
// =====================================================================

/**
 * Build predictions where the user always predicts the home team wins 2-1.
 * Keyed by FifaMatchId.
 */
export function buildHomePredictions(): Map<FifaMatchId, LocalPrediction> {
  const m = new Map<FifaMatchId, LocalPrediction>();
  for (let i = 73; i <= 104; i++) {
    m.set(i as FifaMatchId, {
      match_id: i as FifaMatchId,
      home_goals: 2,
      away_goals: 1,
      penalty_winner: null, // Not needed when home_goals > away_goals
    });
  }
  return m;
}

// =====================================================================
// SCENARIO BUILDERS
// =====================================================================

/**
 * Scenario: All groups finished, knockout not started.
 * Tests R32 resolution from standings + third-place resolution.
 */
export function scenarioGroupsFinished() {
  return {
    matches: buildAllMatches(),
    groupStandings: buildGroupStandings(),
    thirdPlaceQualifying: buildThirdPlaceQualifying(),
    predictions: new Map<FifaMatchId, LocalPrediction>(),
  };
}

/**
 * Scenario: Groups A-H finished, Groups I-L still in progress.
 * Tests partial resolution — groups without all finished matches return null.
 */
export function scenarioPartialGroups() {
  const matches = buildAllMatches();
  // Mark Group I matches as IN_PLAY instead of FINISHED
  for (const m of matches) {
    if (m.stage === "GROUP_STAGE" && m.group === "GROUP_I") {
      m.status = "IN_PLAY";
      m.score.fullTime = { home: null, away: null };
    }
  }
  return {
    matches,
    groupStandings: buildGroupStandings(),
    thirdPlaceQualifying: buildThirdPlaceQualifying(),
    predictions: new Map<FifaMatchId, LocalPrediction>(),
  };
}

/**
 * Scenario: No groups have started — all group matches are TIMED.
 * Tests that R32 teams (including third-place slots) are NOT resolved.
 */
export function scenarioNoGroupsStarted() {
  const matches = buildAllMatches();
  for (const m of matches) {
    if (m.stage === "GROUP_STAGE") {
      m.status = "TIMED";
      m.score.winner = null;
      m.score.fullTime = { home: null, away: null };
      m.score.halfTime = { home: null, away: null };
    }
  }
  return { matches };
}

/**
 * Scenario: All R32 matches finished (home wins), R16+ not started.
 * Tests R16 resolution from actual R32 results.
 */
export function scenarioR32Finished() {
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

  return {
    matches: [...groupMatches, ...finishedR32, ...timedR16Plus],
    groupStandings: buildGroupStandings(),
    thirdPlaceQualifying: buildThirdPlaceQualifying(),
    predictions: new Map<FifaMatchId, LocalPrediction>(),
  };
}

/**
 * Scenario: R32 TIMED but user has predictions. useKnockoutPredictions = true.
 * Tests prediction-based propagation through all rounds.
 */
export function scenarioWithPredictions() {
  return {
    matches: buildAllMatches(),
    groupStandings: buildGroupStandings(),
    thirdPlaceQualifying: buildThirdPlaceQualifying(),
    predictions: buildHomePredictions(),
  };
}

/**
 * Build a scenario with a specific set of third-place qualifying groups.
 * This lets us test different FIFA lookup table entries.
 *
 * @param qualifyingGroups 8 group letters (e.g., ["A","B","C","D","E","F","G","H"])
 */
export function scenarioWithCustomThirdPlace(qualifyingGroups: string[]) {
  const standings = buildGroupStandings();

  // Adjust standings so specified groups have strong 3rd-place teams
  // and others have weak ones. We'll set qualifying groups' 3rd-place to 6pts
  // and non-qualifying to 1pt.
  for (const [group, groupStandings] of standings) {
    const letter = group.replace("GROUP_", "");
    const thirdPlace = groupStandings[2]; // index 2 = 3rd
    if (qualifyingGroups.includes(letter)) {
      thirdPlace.points = 6;
      thirdPlace.goalsFor = 8;
      thirdPlace.goalsAgainst = 4;
      thirdPlace.goalDifference = 4;
    } else {
      thirdPlace.points = 1;
      thirdPlace.goalsFor = 1;
      thirdPlace.goalsAgainst = 5;
      thirdPlace.goalDifference = -4;
    }
  }

  const qualifying = new Map<string, boolean>();
  for (let c = 65; c <= 76; c++) {
    // A-L
    const letter = String.fromCharCode(c);
    qualifying.set(`GROUP_${letter}`, qualifyingGroups.includes(letter));
  }

  return {
    matches: buildAllMatches(),
    groupStandings: standings,
    thirdPlaceQualifying: qualifying,
    predictions: new Map<FifaMatchId, LocalPrediction>(),
  };
}

// Re-export for convenience in tests
export { makeKnockoutMatch, nullTeam, makeGroupMatch };
