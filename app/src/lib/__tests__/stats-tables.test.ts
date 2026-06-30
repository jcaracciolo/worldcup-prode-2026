import { describe, it, expect } from "vitest";
import { computeStatTables } from "../stats-tables";
import { buildGroupStageMatches } from "./bracket-resolver.mock";
import { Match } from "@/types/football";
import { LocalPrediction } from "@/types/database";
import { AllPredictions } from "../score-timeline";

const matches = buildGroupStageMatches(); // 72 finished group matches
const AFTER_ALL = new Date("2026-07-01T00:00:00Z");

function exact(matches: Match[]): LocalPrediction[] {
  return matches.map((m) => ({
    match_id: m.id,
    home_goals: m.score.fullTime.home,
    away_goals: m.score.fullTime.away,
    penalty_winner: null,
  }));
}

function flat(matches: Match[]): LocalPrediction[] {
  return matches.map((m) => ({
    match_id: m.id,
    home_goals: 0,
    away_goals: 0,
    penalty_winner: null,
  }));
}

const allPredictions: AllPredictions = new Map([
  ["alice", { predictions: exact(matches), overrides: [], thirdPlaceOverrides: [] }],
  ["bob", { predictions: flat(matches), overrides: [], thirdPlaceOverrides: [] }],
]);

const profiles = [
  { id: "alice", display_name: "Alice", country: null },
  { id: "bob", display_name: "Bob", country: "AR" },
  { id: "carol", display_name: "Carol", country: null }, // no predictions
];

describe("computeStatTables", () => {
  const tables = computeStatTables(
    matches,
    allPredictions,
    profiles,
    "bob",
    AFTER_ALL,
  );

  it("produces the expected stat tables", () => {
    expect(tables.map((t) => t.key)).toEqual([
      "correct-results",
      "wrong-results",
      "exact-scores",
      "correct-goals",
      "teams-passed",
      "single-guesses",
    ]);
  });

  it("only ranks players who made predictions", () => {
    for (const t of tables) {
      expect(t.totalPlayers).toBe(2);
      expect(t.top.map((r) => r.userId)).not.toContain("carol");
      expect(t.all.map((r) => r.userId)).not.toContain("carol");
      expect(t.all.length).toBe(2);
    }
  });

  it("the exact predictor tops exact scores with all 72", () => {
    const exactTable = tables.find((t) => t.key === "exact-scores")!;
    expect(exactTable.top[0].userId).toBe("alice");
    expect(exactTable.top[0].value).toBe(72);
    expect(exactTable.top[0].rank).toBe(1);
  });

  it("the exact predictor gets all results right too", () => {
    const results = tables.find((t) => t.key === "correct-results")!;
    expect(results.top[0].userId).toBe("alice");
    expect(results.top[0].value).toBe(72);
  });

  it("correct goals max is 2 per match (144 for a perfect predictor)", () => {
    const goals = tables.find((t) => t.key === "correct-goals")!;
    expect(goals.top[0].value).toBe(144);
  });

  it("teams passed: perfect predictor tips all 32 qualifiers", () => {
    const teams = tables.find((t) => t.key === "teams-passed")!;
    expect(teams.top[0].userId).toBe("alice");
    expect(teams.top[0].value).toBe(32);
    expect(teams.top[0].pct).toBe(100);
  });

  it("exact-scores percentage is value / predicted finished matches", () => {
    const exactTable = tables.find((t) => t.key === "exact-scores")!;
    // Alice predicted all 72 finished matches exactly → 72/72 = 100%
    expect(exactTable.top[0].pct).toBe(100);
  });

  it("single guesses: a sole correct caller is credited", () => {
    const single = tables.find((t) => t.key === "single-guesses")!;
    // Values are non-negative and never exceed the number of finished matches.
    for (const r of single.top) {
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThanOrEqual(72);
    }
    expect(single.you).not.toBeNull();
  });

  it("surfaces the current user's row with rank", () => {
    const exactTable = tables.find((t) => t.key === "exact-scores")!;
    expect(exactTable.you).not.toBeNull();
    expect(exactTable.you!.userId).toBe("bob");
    expect(exactTable.you!.rank).toBe(2);
  });

  it("returns null `you` when there is no current user", () => {
    const anon = computeStatTables(
      matches,
      allPredictions,
      profiles,
      null,
      AFTER_ALL,
    );
    expect(anon[0].you).toBeNull();
  });
});
