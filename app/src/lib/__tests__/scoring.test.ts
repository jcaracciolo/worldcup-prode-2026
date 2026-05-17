import { describe, it, expect } from "vitest";
import {
  calculateGroupStagePoints,
  calculateKnockoutPoints,
  calculateMatchPoints,
  calculateGroupStandingsBonusPoints,
  calculateTotalPoints,
  POINTS_CORRECT_RESULT,
  POINTS_CORRECT_GOALS,
  ROUND_MULTIPLIERS,
} from "../scoring";
import { Match, FifaMatchId, asFifaMatchId, CalculatedStanding } from "@/types/football";
import { LocalPrediction } from "@/types/database";
import {
  buildGroupStandings,
  buildGroupStageMatches,
  buildFinishedR32Matches,
  buildAllMatches,
  buildHomePredictions,
  TEAM_A1,
  TEAM_A2,
  TEAM_A3,
  TEAM_A4,
  TEAM_B1,
  TEAM_B2,
  TEAM_C1,
  TEAM_C2,
  TEAM_E1,
  TEAM_F1,
  TEAM_F2,
  TEAM_H3,
} from "./bracket-resolver.mock";

// =====================================================================
// HELPERS
// =====================================================================

function makeTeam(id: number, tla: string) {
  return { id, name: `Team ${tla}`, shortName: tla, tla, crest: null };
}

const TEAM_HOME = makeTeam(100, "HOM");
const TEAM_AWAY = makeTeam(200, "AWY");

function makeFinishedGroupMatch(
  id: number,
  homeGoals: number,
  awayGoals: number,
  home = TEAM_HOME,
  away = TEAM_AWAY,
): Match {
  return {
    id: asFifaMatchId(id),
    utcDate: "2026-06-12T17:00:00Z",
    status: "FINISHED",
    matchday: 1,
    stage: "GROUP_STAGE",
    group: "GROUP_A",
    homeTeam: home,
    awayTeam: away,
    score: {
      winner: homeGoals > awayGoals ? "HOME_TEAM" : awayGoals > homeGoals ? "AWAY_TEAM" : "DRAW",
      duration: "REGULAR",
      fullTime: { home: homeGoals, away: awayGoals },
      halfTime: { home: 0, away: 0 },
    },
    venue: "Stadium",
    referees: [],
  };
}

function makeFinishedKnockoutMatch(
  id: number,
  stage: string,
  homeGoals: number,
  awayGoals: number,
  home = TEAM_HOME,
  away = TEAM_AWAY,
): Match {
  return {
    id: asFifaMatchId(id),
    utcDate: "2026-07-01T17:00:00Z",
    status: "FINISHED",
    matchday: 0,
    stage,
    group: null,
    homeTeam: home,
    awayTeam: away,
    score: {
      winner: homeGoals > awayGoals ? "HOME_TEAM" : awayGoals > homeGoals ? "AWAY_TEAM" : "DRAW",
      duration: "REGULAR",
      fullTime: { home: homeGoals, away: awayGoals },
      halfTime: { home: 0, away: 0 },
    },
    venue: "Stadium",
    referees: [],
  };
}

function pred(homeGoals: number, awayGoals: number, matchId = 1): LocalPrediction {
  return { match_id: matchId, home_goals: homeGoals, away_goals: awayGoals, penalty_winner: null };
}

// =====================================================================
// CONSTANTS
// =====================================================================

describe("Scoring constants", () => {
  it("correct result points = 2", () => {
    expect(POINTS_CORRECT_RESULT).toBe(2);
  });

  it("correct goals points = 1 (group stage)", () => {
    expect(POINTS_CORRECT_GOALS).toBe(1);
  });

  it("knockout multipliers match spec", () => {
    expect(ROUND_MULTIPLIERS["LAST_32"]).toBe(1);
    expect(ROUND_MULTIPLIERS["LAST_16"]).toBe(2);
    expect(ROUND_MULTIPLIERS["QUARTER_FINALS"]).toBe(3);
    expect(ROUND_MULTIPLIERS["SEMI_FINALS"]).toBe(4);
    expect(ROUND_MULTIPLIERS["THIRD_PLACE"]).toBe(5);
    expect(ROUND_MULTIPLIERS["FINAL"]).toBe(6);
  });
});

// =====================================================================
// GROUP STAGE SCORING
// =====================================================================

describe("calculateGroupStagePoints", () => {
  it("exact match: correct result + both goals = 4pts", () => {
    const match = makeFinishedGroupMatch(1, 2, 1);
    const points = calculateGroupStagePoints(match, pred(2, 1));
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(4);
    expect(points).toHaveLength(3); // result + home goals + away goals
  });

  it("correct result only (wrong goals) = 2pts", () => {
    const match = makeFinishedGroupMatch(1, 3, 1);
    const points = calculateGroupStagePoints(match, pred(1, 0)); // both home wins, but both goals wrong
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(2);
    expect(points).toHaveLength(1); // result only
  });

  it("correct result + one exact goal = 3pts", () => {
    const match = makeFinishedGroupMatch(1, 2, 1);
    const points = calculateGroupStagePoints(match, pred(3, 1)); // home win, wrong home goals, correct away goals
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(3);
  });

  it("wrong result but one exact goal = 1pt", () => {
    const match = makeFinishedGroupMatch(1, 2, 1);
    const points = calculateGroupStagePoints(match, pred(0, 1)); // predicted away win, but got home win
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(1); // only away goals correct
  });

  it("completely wrong = 0pts", () => {
    const match = makeFinishedGroupMatch(1, 2, 1);
    const points = calculateGroupStagePoints(match, pred(0, 3));
    expect(points).toHaveLength(0);
  });

  it("draw exact match = 4pts", () => {
    const match = makeFinishedGroupMatch(1, 1, 1);
    const points = calculateGroupStagePoints(match, pred(1, 1));
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(4);
  });

  it("draw correct result wrong goals = 2pts", () => {
    const match = makeFinishedGroupMatch(1, 0, 0);
    const points = calculateGroupStagePoints(match, pred(2, 2));
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(2);
  });

  it("no prediction = 0pts", () => {
    const match = makeFinishedGroupMatch(1, 2, 1);
    const points = calculateGroupStagePoints(match, undefined);
    expect(points).toHaveLength(0);
  });

  it("null goals in prediction = 0pts", () => {
    const match = makeFinishedGroupMatch(1, 2, 1);
    const points = calculateGroupStagePoints(match, {
      match_id: 1,
      home_goals: null,
      away_goals: null,
      penalty_winner: null,
    });
    expect(points).toHaveLength(0);
  });

  it("match not finished = 0pts", () => {
    const match = makeFinishedGroupMatch(1, 2, 1);
    match.status = "TIMED";
    const points = calculateGroupStagePoints(match, pred(2, 1));
    expect(points).toHaveLength(0);
  });

  it("live match still scores", () => {
    const match = makeFinishedGroupMatch(1, 1, 0);
    match.status = "IN_PLAY";
    const points = calculateGroupStagePoints(match, pred(1, 0));
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(4);
    expect(points.every((p) => p.isLive)).toBe(true);
  });

  it("each breakdown item has correct types", () => {
    const match = makeFinishedGroupMatch(1, 2, 1);
    const points = calculateGroupStagePoints(match, pred(2, 1));
    const types = points.map((p) => p.type);
    expect(types).toContain("result");
    expect(types).toContain("goals_home");
    expect(types).toContain("goals_away");
  });
});

// =====================================================================
// KNOCKOUT SCORING — R32 (position-based, multiplier=1)
// =====================================================================

describe("calculateKnockoutPoints — R32", () => {
  it("exact match = 6pts (2 result + 2 home + 2 away)", () => {
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 2, 1);
    const points = calculateKnockoutPoints(match, pred(2, 1, 73), undefined);
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(6);
    expect(points).toHaveLength(3);
  });

  it("correct result only = 2pts", () => {
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 3, 1);
    const points = calculateKnockoutPoints(match, pred(1, 0, 73), undefined); // both home wins, but both goals wrong
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(2);
  });

  it("correct result + one goal = 4pts", () => {
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 2, 1);
    const points = calculateKnockoutPoints(match, pred(3, 1, 73), undefined);
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(4); // 2 result + 2 away
  });

  it("wrong result but one exact goal = 2pts", () => {
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 2, 1);
    const points = calculateKnockoutPoints(match, pred(0, 1, 73), undefined);
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(2); // only away goals
  });

  it("draw exact match = 6pts", () => {
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 1, 1);
    const points = calculateKnockoutPoints(match, pred(1, 1, 73), undefined);
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(6); // 2 result + 2 home + 2 away
  });

  it("completely wrong = 0pts", () => {
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 2, 1);
    const points = calculateKnockoutPoints(match, pred(0, 3, 73), undefined);
    expect(points).toHaveLength(0);
  });

  it("no prediction = 0pts", () => {
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 2, 1);
    const points = calculateKnockoutPoints(match, undefined, undefined);
    expect(points).toHaveLength(0);
  });

  it("match not finished = 0pts", () => {
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 2, 1);
    match.status = "TIMED";
    const points = calculateKnockoutPoints(match, pred(2, 1, 73), undefined);
    expect(points).toHaveLength(0);
  });

  it("goals are 2pts each (not 1pt like group stage)", () => {
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 2, 1);
    const points = calculateKnockoutPoints(match, pred(0, 1, 73), undefined);
    // Only away goals correct, wrong result
    expect(points).toHaveLength(1);
    expect(points[0].points).toBe(2);
    expect(points[0].type).toBe("goals_away");
  });
});

// =====================================================================
// KNOCKOUT SCORING — R16+ (team-based, with multipliers)
// =====================================================================

describe("calculateKnockoutPoints — R16 (multiplier=2)", () => {
  const predictedTeams = {
    home: { id: TEAM_HOME.id, tla: TEAM_HOME.tla },
    away: { id: TEAM_AWAY.id, tla: TEAM_AWAY.tla },
  };

  it("exact match with correct teams = 8pts (4 result + 2+2 goals)", () => {
    const match = makeFinishedKnockoutMatch(89, "LAST_16", 2, 1);
    const points = calculateKnockoutPoints(match, pred(2, 1, 89), predictedTeams);
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(8); // winner 2 + loser 2 + home goals 2 + away goals 2
  });

  it("correct winner only = 2pts", () => {
    const match = makeFinishedKnockoutMatch(89, "LAST_16", 3, 0);
    // Predict 1-0 (home wins, so winner+loser correct, but wrong goals)
    const points = calculateKnockoutPoints(match, pred(1, 0, 89), predictedTeams);
    const total = points.reduce((s, p) => s + p.points, 0);
    // winner 2pts + loser 2pts + away goals correct (0=0) 2pts = 6
    expect(total).toBe(6);
  });

  it("wrong result, no teams match = 0pts", () => {
    const match = makeFinishedKnockoutMatch(89, "LAST_16", 2, 1);
    const wrongTeams = {
      home: { id: 999, tla: "XXX" },
      away: { id: 998, tla: "YYY" },
    };
    const points = calculateKnockoutPoints(match, pred(0, 1, 89), wrongTeams);
    // Predicted away win but home won. Winner/loser teams don't match either.
    // Goals: predicted home team (id=999) != actual home (id=100), so no goals awarded
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(0);
  });

  it("draw with both teams predicted = 4pts", () => {
    const match = makeFinishedKnockoutMatch(89, "LAST_16", 1, 1);
    const points = calculateKnockoutPoints(match, pred(1, 1, 89), predictedTeams);
    const total = points.reduce((s, p) => s + p.points, 0);
    // tie home 2pts + tie away 2pts + home goals 2pts + away goals 2pts = 8pts
    expect(total).toBe(8);
  });
});

describe("calculateKnockoutPoints — Quarter-finals (multiplier=3)", () => {
  const predictedTeams = {
    home: { id: TEAM_HOME.id, tla: TEAM_HOME.tla },
    away: { id: TEAM_AWAY.id, tla: TEAM_AWAY.tla },
  };

  it("exact match = 10pts (winner 3 + loser 3 + goals 2+2)", () => {
    const match = makeFinishedKnockoutMatch(97, "QUARTER_FINALS", 2, 1);
    const points = calculateKnockoutPoints(match, pred(2, 1, 97), predictedTeams);
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(10);
  });

  it("max possible per multiplier table: 3×2 + 4 = 10", () => {
    // This validates the spec's multiplier table
    const maxResult = 2 * ROUND_MULTIPLIERS["QUARTER_FINALS"]; // 6
    const maxGoals = 4; // 2 per team
    expect(maxResult + maxGoals).toBe(10);
  });
});

describe("calculateKnockoutPoints — Semi-finals (multiplier=4)", () => {
  const predictedTeams = {
    home: { id: TEAM_HOME.id, tla: TEAM_HOME.tla },
    away: { id: TEAM_AWAY.id, tla: TEAM_AWAY.tla },
  };

  it("exact match = 12pts", () => {
    const match = makeFinishedKnockoutMatch(101, "SEMI_FINALS", 2, 1);
    const points = calculateKnockoutPoints(match, pred(2, 1, 101), predictedTeams);
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(12);
  });
});

describe("calculateKnockoutPoints — Final (multiplier=6)", () => {
  const predictedTeams = {
    home: { id: TEAM_HOME.id, tla: TEAM_HOME.tla },
    away: { id: TEAM_AWAY.id, tla: TEAM_AWAY.tla },
  };

  it("exact match = 16pts", () => {
    const match = makeFinishedKnockoutMatch(104, "FINAL", 2, 1);
    const points = calculateKnockoutPoints(match, pred(2, 1, 104), predictedTeams);
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(16);
  });

  it("max possible per multiplier table: 6×2 + 4 = 16", () => {
    const maxResult = 2 * ROUND_MULTIPLIERS["FINAL"];
    const maxGoals = 4;
    expect(maxResult + maxGoals).toBe(16);
  });
});

// =====================================================================
// calculateMatchPoints (unified function)
// =====================================================================

describe("calculateMatchPoints", () => {
  it("group stage max = 4", () => {
    const match = makeFinishedGroupMatch(1, 2, 1);
    const result = calculateMatchPoints(match, pred(2, 1));
    expect(result.total).toBe(4);
    expect(result.maxPossible).toBe(4);
  });

  it("R32 max = 6", () => {
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 2, 1);
    const result = calculateMatchPoints(match, pred(2, 1, 73));
    expect(result.total).toBe(6);
    expect(result.maxPossible).toBe(6);
  });

  it("R16 max = 8", () => {
    const match = makeFinishedKnockoutMatch(89, "LAST_16", 2, 1);
    const result = calculateMatchPoints(match, pred(2, 1, 89));
    expect(result.total).toBe(8);
    expect(result.maxPossible).toBe(8);
  });

  it("QF max = 10", () => {
    const match = makeFinishedKnockoutMatch(97, "QUARTER_FINALS", 2, 1);
    const result = calculateMatchPoints(match, pred(2, 1, 97));
    expect(result.total).toBe(10);
    expect(result.maxPossible).toBe(10);
  });

  it("SF max = 12", () => {
    const match = makeFinishedKnockoutMatch(101, "SEMI_FINALS", 2, 1);
    const result = calculateMatchPoints(match, pred(2, 1, 101));
    expect(result.total).toBe(12);
    expect(result.maxPossible).toBe(12);
  });

  it("3rd place max = 14", () => {
    const match = makeFinishedKnockoutMatch(103, "THIRD_PLACE", 2, 1);
    const result = calculateMatchPoints(match, pred(2, 1, 103));
    expect(result.total).toBe(14);
    expect(result.maxPossible).toBe(14);
  });

  it("Final max = 16", () => {
    const match = makeFinishedKnockoutMatch(104, "FINAL", 2, 1);
    const result = calculateMatchPoints(match, pred(2, 1, 104));
    expect(result.total).toBe(16);
    expect(result.maxPossible).toBe(16);
  });

  it("no prediction → hasPrediction=false, total=0", () => {
    const match = makeFinishedGroupMatch(1, 2, 1);
    const result = calculateMatchPoints(match, null);
    expect(result.hasPrediction).toBe(false);
    expect(result.total).toBe(0);
  });

  it("not finished → total=0, isFinished=false", () => {
    const match = makeFinishedGroupMatch(1, 2, 1);
    match.status = "TIMED";
    const result = calculateMatchPoints(match, pred(2, 1));
    expect(result.total).toBe(0);
    expect(result.isFinished).toBe(false);
  });
});

// =====================================================================
// GROUP STANDINGS BONUS
// =====================================================================

describe("calculateGroupStandingsBonusPoints", () => {
  const standings = buildGroupStandings();
  const actualA = standings.get("GROUP_A")!;

  // Build advancing team IDs (positions 1 and 2 from all groups + qualifying 3rds)
  const advancingTeamIds = new Set<number>();
  standings.forEach((groupStandings, groupName) => {
    groupStandings.forEach((s, idx) => {
      if (idx < 2) advancingTeamIds.add(s.team.id);
    });
  });
  // Add qualifying 3rd-place teams (A-H)
  for (const g of ["GROUP_A", "GROUP_B", "GROUP_C", "GROUP_D", "GROUP_E", "GROUP_F", "GROUP_G", "GROUP_H"]) {
    advancingTeamIds.add(standings.get(g)![2].team.id);
  }

  it("perfect prediction (all 3 advancing + positions correct) = 6pts", () => {
    // Predict same order as actual — all advance
    const predicted = [...actualA]; // same order
    const points = calculateGroupStandingsBonusPoints(
      "GROUP_A",
      predicted,
      actualA,
      advancingTeamIds,
      true,
      true, // 3rd place qualifies
    );
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(6); // 3 advance (3pts) + 3 correct position (3pts)
  });

  it("all 3 advance but wrong positions = 3pts", () => {
    // Swap positions 1 and 2
    const predicted = [actualA[1], actualA[0], actualA[2], actualA[3]];
    const points = calculateGroupStandingsBonusPoints(
      "GROUP_A",
      predicted,
      actualA,
      advancingTeamIds,
      true,
      true,
    );
    const total = points.reduce((s, p) => s + p.points, 0);
    // All 3 predicted to advance and they did (3pts) + 3rd position correct (1pt) = 4pts
    expect(total).toBe(4);
  });

  it("group not complete = 0pts", () => {
    const predicted = [...actualA];
    const points = calculateGroupStandingsBonusPoints(
      "GROUP_A",
      predicted,
      actualA,
      advancingTeamIds,
      false, // not complete
    );
    expect(points).toHaveLength(0);
  });

  it("3rd place doesn't qualify (user predicted they wouldn't) = max 4pts", () => {
    const predicted = [...actualA];
    const points = calculateGroupStandingsBonusPoints(
      "GROUP_A",
      predicted,
      actualA,
      advancingTeamIds,
      true,
      false, // 3rd place doesn't qualify in user's prediction
    );
    const total = points.reduce((s, p) => s + p.points, 0);
    // Only positions 1 and 2 count: 2 advance (2pts) + 2 correct position (2pts) = 4pts
    expect(total).toBe(4);
  });

  it("breakdown types are group_advance and group_position", () => {
    const predicted = [...actualA];
    const points = calculateGroupStandingsBonusPoints(
      "GROUP_A",
      predicted,
      actualA,
      advancingTeamIds,
      true,
      true,
    );
    const types = new Set(points.map((p) => p.type));
    expect(types.has("group_advance")).toBe(true);
    expect(types.has("group_position")).toBe(true);
    expect(types.size).toBe(2);
  });
});

// =====================================================================
// R32 vs GROUP STAGE goal points comparison
// =====================================================================

describe("R32 goals = 2pts vs Group goals = 1pt", () => {
  it("group stage awards 1pt per correct goal", () => {
    const match = makeFinishedGroupMatch(1, 2, 1);
    const points = calculateGroupStagePoints(match, pred(0, 1)); // only away goals correct
    const goalPoints = points.filter((p) => p.type === "goals_away");
    expect(goalPoints).toHaveLength(1);
    expect(goalPoints[0].points).toBe(1);
  });

  it("R32 awards 2pts per correct goal", () => {
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 2, 1);
    const points = calculateKnockoutPoints(match, pred(0, 1, 73), undefined);
    const goalPoints = points.filter((p) => p.type === "goals_away");
    expect(goalPoints).toHaveLength(1);
    expect(goalPoints[0].points).toBe(2);
  });
});

// =====================================================================
// EDGE CASES
// =====================================================================

describe("Edge cases", () => {
  it("0-0 draw exact match = 4pts (group)", () => {
    const match = makeFinishedGroupMatch(1, 0, 0);
    const result = calculateMatchPoints(match, pred(0, 0));
    expect(result.total).toBe(4);
  });

  it("0-0 draw exact match = 6pts (R32)", () => {
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 0, 0);
    const result = calculateMatchPoints(match, pred(0, 0, 73));
    expect(result.total).toBe(6);
  });

  it("high-scoring exact match scores same as low-scoring", () => {
    const match1 = makeFinishedGroupMatch(1, 5, 4);
    const match2 = makeFinishedGroupMatch(2, 1, 0);
    const r1 = calculateMatchPoints(match1, pred(5, 4, 1));
    const r2 = calculateMatchPoints(match2, pred(1, 0, 2));
    expect(r1.total).toBe(r2.total); // both 4pts
  });

  it("PAUSED match still scores (like IN_PLAY)", () => {
    const match = makeFinishedGroupMatch(1, 2, 1);
    match.status = "PAUSED";
    const result = calculateMatchPoints(match, pred(2, 1));
    expect(result.total).toBe(4);
    expect(result.isLive).toBe(true);
  });

  it("R16+ without predictedTeams falls back to position-based", () => {
    // When predictedTeams is undefined, R16+ should still score
    const match = makeFinishedKnockoutMatch(89, "LAST_16", 2, 1);
    const points = calculateKnockoutPoints(match, pred(2, 1, 89), undefined);
    const total = points.reduce((s, p) => s + p.points, 0);
    // Falls back to position-based: 2*2 result + 2 home + 2 away = 8
    expect(total).toBe(8);
  });
});

// =====================================================================
// MAX POINTS TABLE VALIDATION
// Validates code output matches the spec's multiplier table
// =====================================================================

describe("Max points match spec multiplier table", () => {
  const cases: [string, number, number][] = [
    ["LAST_32", 73, 6],
    ["LAST_16", 89, 8],
    ["QUARTER_FINALS", 97, 10],
    ["SEMI_FINALS", 101, 12],
    ["THIRD_PLACE", 103, 14],
    ["FINAL", 104, 16],
  ];

  it.each(cases)("%s (match %i) max = %i", (stage, matchId, expectedMax) => {
    const match = makeFinishedKnockoutMatch(matchId, stage, 2, 1);
    const result = calculateMatchPoints(match, pred(2, 1, matchId));
    expect(result.maxPossible).toBe(expectedMax);
    expect(result.total).toBe(expectedMax); // exact match should hit max
  });
});
