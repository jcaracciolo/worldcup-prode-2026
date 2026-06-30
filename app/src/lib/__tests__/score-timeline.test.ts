import { describe, it, expect } from "vitest";
import {
  snapshotMatchesAsOf,
  calculateScoresAsOf,
  buildScoreTimeline,
  AllPredictions,
} from "../score-timeline";
import { buildGroupStageMatches } from "./bracket-resolver.mock";
import { Match } from "@/types/football";
import { LocalPrediction } from "@/types/database";

// Build exact-score predictions for a set of matches (guarantees points).
function exactPredictions(matches: Match[]): LocalPrediction[] {
  return matches.map((m) => ({
    match_id: m.id,
    home_goals: m.score.fullTime.home,
    away_goals: m.score.fullTime.away,
    penalty_winner: null,
  }));
}

// All 0-0 predictions (low score).
function flatPredictions(matches: Match[]): LocalPrediction[] {
  return matches.map((m) => ({
    match_id: m.id,
    home_goals: 0,
    away_goals: 0,
    penalty_winner: null,
  }));
}

const matches = buildGroupStageMatches(); // 72 finished group matches, Jun 11–23
const FIRST_DAY = new Date("2026-06-11T23:59:59Z");
const AFTER_ALL = new Date("2026-07-01T00:00:00Z");

const allPredictions: AllPredictions = new Map([
  [
    "alice",
    {
      predictions: exactPredictions(matches),
      overrides: [],
      thirdPlaceOverrides: [],
    },
  ],
  [
    "bob",
    {
      predictions: flatPredictions(matches),
      overrides: [],
      thirdPlaceOverrides: [],
    },
  ],
]);

const profiles = [
  { id: "alice", display_name: "Alice", country: null },
  { id: "bob", display_name: "Bob", country: "AR" },
  { id: "carol", display_name: "Carol", country: null }, // no predictions
];

describe("snapshotMatchesAsOf", () => {
  it("keeps matches finished by the date and resets later ones", () => {
    const snap = snapshotMatchesAsOf(matches, FIRST_DAY);
    const finished = snap.filter((m) => m.status === "FINISHED");
    // Only Jun-11 matches remain finished
    const jun11 = matches.filter(
      (m) => new Date(m.utcDate).getTime() <= FIRST_DAY.getTime(),
    );
    expect(finished.length).toBe(jun11.length);
    expect(finished.length).toBeGreaterThan(0);
    expect(finished.length).toBeLessThan(matches.length);
    // Reset matches have null scores
    const reset = snap.find((m) => m.status !== "FINISHED");
    expect(reset?.score.fullTime.home).toBeNull();
  });

  it("keeps all matches when the date is after the tournament", () => {
    const snap = snapshotMatchesAsOf(matches, AFTER_ALL);
    expect(snap.every((m) => m.status === "FINISHED")).toBe(true);
  });
});

describe("calculateScoresAsOf", () => {
  it("is non-decreasing as the date advances", () => {
    let prev = -1;
    const dates = [
      "2026-06-11T23:59:59Z",
      "2026-06-13T23:59:59Z",
      "2026-06-15T23:59:59Z",
      "2026-06-18T23:59:59Z",
      "2026-06-23T23:59:59Z",
      "2026-07-10T23:59:59Z",
    ];
    for (const iso of dates) {
      const score = calculateScoresAsOf(
        matches,
        allPredictions,
        new Date(iso),
      ).get("alice")!;
      expect(score).toBeGreaterThanOrEqual(prev);
      prev = score;
    }
  });

  it("an exact predictor outscores an all-0-0 predictor by the end", () => {
    const scores = calculateScoresAsOf(matches, allPredictions, AFTER_ALL);
    expect(scores.get("alice")!).toBeGreaterThan(scores.get("bob")!);
  });

  it("early date reflects fewer points than the end", () => {
    const early = calculateScoresAsOf(matches, allPredictions, FIRST_DAY).get(
      "alice",
    )!;
    const end = calculateScoresAsOf(matches, allPredictions, AFTER_ALL).get(
      "alice",
    )!;
    expect(early).toBeLessThan(end);
    expect(early).toBeGreaterThanOrEqual(0);
  });
});

describe("buildScoreTimeline", () => {
  const timeline = buildScoreTimeline(
    matches,
    allPredictions,
    profiles,
    AFTER_ALL,
  );

  it("only includes players who made predictions", () => {
    const ids = timeline.players.map((p) => p.userId).sort();
    expect(ids).toEqual(["alice", "bob"]);
  });

  it("assigns unique positions in [1, N] each row", () => {
    expect(timeline.rows.length).toBeGreaterThan(0);
    for (const row of timeline.rows) {
      const positions = timeline.players
        .map((p) => row[p.userId] as number)
        .sort();
      expect(positions).toEqual([1, 2]);
    }
  });

  it("the exact predictor is ranked 1st by the end", () => {
    const last = timeline.rows[timeline.rows.length - 1];
    expect(last.alice).toBe(1);
    expect(last.bob).toBe(2);
  });

  it("stores points alongside positions for the tooltip", () => {
    const end = calculateScoresAsOf(matches, allPredictions, AFTER_ALL);
    const last = timeline.rows[timeline.rows.length - 1];
    expect(last["alice::pts"]).toBe(end.get("alice"));
    expect(last["bob::pts"]).toBe(end.get("bob"));
  });

  it("returns no rows when nobody has predictions", () => {
    const empty = buildScoreTimeline(matches, new Map(), profiles, AFTER_ALL);
    expect(empty.players).toHaveLength(0);
    expect(empty.rows).toHaveLength(0);
  });
});
