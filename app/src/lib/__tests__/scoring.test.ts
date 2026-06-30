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
import { LiveBracketResolver } from "../live-bracket-resolver";
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
  return { match_id: matchId as FifaMatchId, home_goals: homeGoals, away_goals: awayGoals, penalty_winner: null };
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
      match_id: 1 as FifaMatchId,
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
  it("exact match = 5pts (2 result + 1 passes + 1 home + 1 away)", () => {
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 2, 1);
    const points = calculateKnockoutPoints(match, pred(2, 1, 73), undefined);
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(5);
    expect(points).toHaveLength(4); // result + passes + home goals + away goals
  });

  it("correct result only = 3pts (2 result + 1 passes)", () => {
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 3, 1);
    const points = calculateKnockoutPoints(match, pred(1, 0, 73), undefined); // both home wins, but both goals wrong
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(3);
  });

  it("correct result + one goal = 4pts", () => {
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 2, 1);
    const points = calculateKnockoutPoints(match, pred(3, 1, 73), undefined);
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(4); // 2 result + 1 passes + 1 away goal
  });

  it("wrong result but one exact goal = 1pt", () => {
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 2, 1);
    const points = calculateKnockoutPoints(match, pred(0, 1, 73), undefined);
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(1); // only away goals (wrong result + wrong advancer)
  });

  it("predicted tie that becomes a win still earns the passes half = 1pt", () => {
    // Predict 0-0 with home advancing on penalties; home actually wins 2-1.
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 2, 1);
    const prediction = {
      ...pred(0, 0, 73),
      penalty_winner: "HOME" as const,
    };
    const points = calculateKnockoutPoints(match, prediction, undefined);
    const total = points.reduce((s, p) => s + p.points, 0);
    // result wrong (draw vs win), goals wrong, but home advanced as predicted
    expect(total).toBe(1);
    expect(points).toHaveLength(1);
    expect(points[0].type).toBe("knockout_pass");
  });

  it("draw exact match = 4pts (2 result + 1 home + 1 away, no advancer)", () => {
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 1, 1);
    const points = calculateKnockoutPoints(match, pred(1, 1, 73), undefined);
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(4); // no passes: neither side has a recorded advancer
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

  it("goals are 1pt each (same as group stage)", () => {
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 2, 1);
    const points = calculateKnockoutPoints(match, pred(0, 1, 73), undefined);
    // Only away goals correct, wrong result + wrong advancer
    expect(points).toHaveLength(1);
    expect(points[0].points).toBe(1);
    expect(points[0].type).toBe("goals_away");
  });

  it("exact tie + correct shootout advancer = 4pts (2 result + 1 passes + 1 goal-ish)", () => {
    // Actual 1-1, home advances on penalties (score.winner = HOME_TEAM).
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 1, 1);
    match.score.winner = "HOME_TEAM";
    const prediction = { ...pred(1, 1, 73), penalty_winner: "HOME" as const };
    const points = calculateKnockoutPoints(match, prediction, undefined);
    const total = points.reduce((s, p) => s + p.points, 0);
    // result(draw) 2 + passes 1 + goals home 1 + goals away 1 = 5
    expect(total).toBe(5);
    expect(points.some((p) => p.type === "knockout_pass")).toBe(true);
  });

  it("exact tie + wrong shootout advancer = no passes", () => {
    // Actual 1-1, away advances on penalties; user picked home to advance.
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 1, 1);
    match.score.winner = "AWAY_TEAM";
    const prediction = { ...pred(1, 1, 73), penalty_winner: "HOME" as const };
    const points = calculateKnockoutPoints(match, prediction, undefined);
    // result(draw) 2 + goals 1 + 1 = 4, no passes (wrong advancer)
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(4);
    expect(points.some((p) => p.type === "knockout_pass")).toBe(false);
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

  it("exact match with correct teams = 8pts (winner 2 + loser 2 + passes 2 + goals 1+1)", () => {
    const match = makeFinishedKnockoutMatch(89, "LAST_16", 2, 1);
    const points = calculateKnockoutPoints(match, pred(2, 1, 89), predictedTeams);
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(8); // winner 2 + loser 2 + passes 2 + home goal 1 + away goal 1
  });

  it("correct winner only = 7pts", () => {
    const match = makeFinishedKnockoutMatch(89, "LAST_16", 3, 0);
    // Predict 1-0 (home wins, so winner+loser+passes correct, but wrong home goals)
    const points = calculateKnockoutPoints(match, pred(1, 0, 89), predictedTeams);
    const total = points.reduce((s, p) => s + p.points, 0);
    // winner 2 + loser 2 + passes 2 + away goals correct (0=0) 1 = 7
    expect(total).toBe(7);
  });

  it("wrong result, no teams match = 0pts", () => {
    const match = makeFinishedKnockoutMatch(89, "LAST_16", 2, 1);
    const wrongTeams = {
      home: { id: 999, tla: "XXX" },
      away: { id: 998, tla: "YYY" },
    };
    const points = calculateKnockoutPoints(match, pred(0, 1, 89), wrongTeams);
    // Predicted away win but home won. Winner/loser/advancer teams don't match.
    // Goals: predicted home team (id=999) != actual home (id=100), so no goals awarded
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(0);
  });

  it("draw with both teams predicted = 6pts", () => {
    const match = makeFinishedKnockoutMatch(89, "LAST_16", 1, 1);
    const points = calculateKnockoutPoints(match, pred(1, 1, 89), predictedTeams);
    const total = points.reduce((s, p) => s + p.points, 0);
    // tie home 2 + tie away 2 + home goal 1 + away goal 1 = 6 (no advancer recorded)
    expect(total).toBe(6);
  });
});

describe("calculateKnockoutPoints — Quarter-finals (multiplier=3)", () => {
  const predictedTeams = {
    home: { id: TEAM_HOME.id, tla: TEAM_HOME.tla },
    away: { id: TEAM_AWAY.id, tla: TEAM_AWAY.tla },
  };

  it("exact match = 11pts (winner 3 + loser 3 + passes 3 + goals 1+1)", () => {
    const match = makeFinishedKnockoutMatch(97, "QUARTER_FINALS", 2, 1);
    const points = calculateKnockoutPoints(match, pred(2, 1, 97), predictedTeams);
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(11);
  });

  it("max possible per multiplier table: 3×3 + 2 = 11", () => {
    // This validates the spec's multiplier table
    const maxResult = 3 * ROUND_MULTIPLIERS["QUARTER_FINALS"]; // 9 (winner+loser+passes)
    const maxGoals = 2; // 1 per team
    expect(maxResult + maxGoals).toBe(11);
  });
});

describe("calculateKnockoutPoints — Semi-finals (multiplier=4)", () => {
  const predictedTeams = {
    home: { id: TEAM_HOME.id, tla: TEAM_HOME.tla },
    away: { id: TEAM_AWAY.id, tla: TEAM_AWAY.tla },
  };

  it("exact match = 14pts", () => {
    const match = makeFinishedKnockoutMatch(101, "SEMI_FINALS", 2, 1);
    const points = calculateKnockoutPoints(match, pred(2, 1, 101), predictedTeams);
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(14);
  });
});

describe("calculateKnockoutPoints — Final (multiplier=6)", () => {
  const predictedTeams = {
    home: { id: TEAM_HOME.id, tla: TEAM_HOME.tla },
    away: { id: TEAM_AWAY.id, tla: TEAM_AWAY.tla },
  };

  it("exact match = 20pts", () => {
    const match = makeFinishedKnockoutMatch(104, "FINAL", 2, 1);
    const points = calculateKnockoutPoints(match, pred(2, 1, 104), predictedTeams);
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(20);
  });

  it("max possible per multiplier table: 3×6 + 2 = 20", () => {
    const maxResult = 3 * ROUND_MULTIPLIERS["FINAL"];
    const maxGoals = 2;
    expect(maxResult + maxGoals).toBe(20);
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

  it("R32 max = 5", () => {
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 2, 1);
    const result = calculateMatchPoints(match, pred(2, 1, 73));
    expect(result.total).toBe(5);
    expect(result.maxPossible).toBe(5);
  });

  it("R16 max = 8", () => {
    const match = makeFinishedKnockoutMatch(89, "LAST_16", 2, 1);
    const result = calculateMatchPoints(match, pred(2, 1, 89));
    expect(result.total).toBe(8);
    expect(result.maxPossible).toBe(8);
  });

  it("QF max = 11", () => {
    const match = makeFinishedKnockoutMatch(97, "QUARTER_FINALS", 2, 1);
    const result = calculateMatchPoints(match, pred(2, 1, 97));
    expect(result.total).toBe(11);
    expect(result.maxPossible).toBe(11);
  });

  it("SF max = 14", () => {
    const match = makeFinishedKnockoutMatch(101, "SEMI_FINALS", 2, 1);
    const result = calculateMatchPoints(match, pred(2, 1, 101));
    expect(result.total).toBe(14);
    expect(result.maxPossible).toBe(14);
  });

  it("3rd place max = 17", () => {
    const match = makeFinishedKnockoutMatch(103, "THIRD_PLACE", 2, 1);
    const result = calculateMatchPoints(match, pred(2, 1, 103));
    expect(result.total).toBe(17);
    expect(result.maxPossible).toBe(17);
  });

  it("Final max = 20", () => {
    const match = makeFinishedKnockoutMatch(104, "FINAL", 2, 1);
    const result = calculateMatchPoints(match, pred(2, 1, 104));
    expect(result.total).toBe(20);
    expect(result.maxPossible).toBe(20);
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

  it("3rd actually finished 3rd is withheld until it qualifies (best-third not final) = max 4pts", () => {
    // Model the not-yet-final best-third ranking by EXCLUDING Group A's actual
    // 3rd-place team from advancingTeamIds (it hasn't been confirmed as a best
    // third yet). The withholding now lives entirely on the actual side.
    const advancingNoThird = new Set(advancingTeamIds);
    advancingNoThird.delete(actualA[2].team.id);

    const predicted = [...actualA];
    const points = calculateGroupStandingsBonusPoints(
      "GROUP_A",
      predicted,
      actualA,
      advancingNoThird,
      true, // this group complete
      true, // user predicted 3rd to qualify
    );
    const total = points.reduce((s, p) => s + p.points, 0);
    // Only 1st/2nd count: 2 advance (2pts) + 2 correct position (2pts) = 4pts
    expect(total).toBe(4);
    // No 3rd-place team should appear in the breakdown
    expect(points.some((p) => p.predictedPosition === 3)).toBe(false);
  });

  it("3rd-place bonus awarded once the 3rd actually qualifies = 6pts", () => {
    const predicted = [...actualA];
    const points = calculateGroupStandingsBonusPoints(
      "GROUP_A",
      predicted,
      actualA,
      advancingTeamIds, // includes Group A's qualifying 3rd
      true,
      true,
    );
    const total = points.reduce((s, p) => s + p.points, 0);
    expect(total).toBe(6);
  });

  it("team predicted 3rd that actually advanced as 2nd still gets its advance bonus", () => {
    // Regression: putting a team 3rd in your bracket must not block its advance
    // bonus when it actually passes as 1st/2nd — that's already certain, so it
    // must not wait for the cross-group best-third ranking.
    const actualSecond = actualA[1].team; // really finished 2nd
    // User's predicted order places that team 3rd instead of 2nd.
    const predicted = [actualA[0], actualA[2], actualA[1], actualA[3]];

    // Only confirmed advancers (1st + 2nd). The real 3rd has NOT qualified yet.
    const advancing = new Set<number>([actualA[0].team.id, actualA[1].team.id]);

    const points = calculateGroupStandingsBonusPoints(
      "GROUP_A",
      predicted,
      actualA,
      advancing,
      true, // group complete
      true, // user's predicted 3rd qualifies
    );

    // The team predicted 3rd / actual 2nd earns a group_advance point.
    const advanceForSecond = points.find(
      (p) =>
        p.type === "group_advance" &&
        p.predictedPosition === 3 &&
        p.team?.tla === actualSecond.tla,
    );
    expect(advanceForSecond).toBeDefined();
    expect(advanceForSecond!.points).toBe(1);
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

  it("R32 awards 1pt per correct goal", () => {
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 2, 1);
    const points = calculateKnockoutPoints(match, pred(0, 1, 73), undefined);
    const goalPoints = points.filter((p) => p.type === "goals_away");
    expect(goalPoints).toHaveLength(1);
    expect(goalPoints[0].points).toBe(1);
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

  it("0-0 draw exact match = 4pts (R32, no advancer)", () => {
    const match = makeFinishedKnockoutMatch(73, "LAST_32", 0, 0);
    const result = calculateMatchPoints(match, pred(0, 0, 73));
    expect(result.total).toBe(4); // result 2 + goals 1+1 (no recorded advancer)
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
    ["LAST_32", 73, 5],
    ["LAST_16", 89, 8],
    ["QUARTER_FINALS", 97, 11],
    ["SEMI_FINALS", 101, 14],
    ["THIRD_PLACE", 103, 17],
    ["FINAL", 104, 20],
  ];

  it.each(cases)("%s (match %i) max = %i", (stage, matchId, expectedMax) => {
    const match = makeFinishedKnockoutMatch(matchId, stage, 2, 1);
    const result = calculateMatchPoints(match, pred(2, 1, matchId));
    expect(result.maxPossible).toBe(expectedMax);
    expect(result.total).toBe(expectedMax); // exact match should hit max
  });
});

// =====================================================================
// 3RD-PLACE BONUS TIMING (integration via calculateTotalPoints)
// Best-third qualification is a cross-group ranking, so the 3rd-place
// advance/position bonus must wait until EVERY group is finished.
// =====================================================================

describe("3rd-place bonus waits for all groups (integration)", () => {
  // Predict exactly the real scores so predicted standings == actual standings.
  function predictionsFromMatches(matches: Match[]): LocalPrediction[] {
    return matches
      .filter(
        (m) =>
          m.stage === "GROUP_STAGE" &&
          m.status === "FINISHED" &&
          m.score.fullTime.home !== null &&
          m.score.fullTime.away !== null,
      )
      .map((m) => ({
        match_id: m.id as FifaMatchId,
        home_goals: m.score.fullTime.home as number,
        away_goals: m.score.fullTime.away as number,
        penalty_winner: null,
      }));
  }

  it("awards a 3rd-place advance bonus once every group is finished", () => {
    const matches = buildGroupStageMatches(); // all 72 FINISHED
    const live = new LiveBracketResolver(matches).resolve();
    const predictions = predictionsFromMatches(matches);
    const { breakdown } = calculateTotalPoints(matches, predictions, [], live, []);
    const thirdAdvances = breakdown.filter(
      (p) => p.type === "group_advance" && p.predictedPosition === 3,
    );
    expect(thirdAdvances.length).toBeGreaterThan(0);
  });

  it("withholds ALL 3rd-place bonuses while any group is unfinished", () => {
    const matches = buildGroupStageMatches();
    // Leave Group L unfinished — best-third ranking is not yet final.
    for (const m of matches) {
      if (m.group === "GROUP_L") {
        m.status = "IN_PLAY";
        m.score = {
          ...m.score,
          winner: null,
          fullTime: { home: null, away: null },
        };
      }
    }
    const live = new LiveBracketResolver(matches).resolve();
    const predictions = predictionsFromMatches(matches);
    const { breakdown } = calculateTotalPoints(matches, predictions, [], live, []);

    const thirdAdvances = breakdown.filter(
      (p) => p.type === "group_advance" && p.predictedPosition === 3,
    );
    expect(thirdAdvances).toHaveLength(0);

    // 1st/2nd advance bonuses for the finished groups are still awarded.
    const topTwoAdvances = breakdown.filter(
      (p) => p.type === "group_advance" && p.predictedPosition !== 3,
    );
    expect(topTwoAdvances.length).toBeGreaterThan(0);
  });
});
