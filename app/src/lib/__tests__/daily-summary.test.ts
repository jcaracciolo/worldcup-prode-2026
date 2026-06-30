import { describe, it, expect } from "vitest";
import {
  computeCompletedMatchDays,
  computeDailySummary,
} from "../daily-summary";
import { Match, FifaMatchId, Team } from "@/types/football";
import { LocalPrediction } from "@/types/database";
import { AllPredictions } from "../score-timeline";

let teamId = 100;
function team(tla: string): Team {
  const id = teamId++;
  return {
    id,
    name: tla,
    shortName: tla,
    tla,
    crest: null,
  } as unknown as Team;
}

function makeMatch(
  id: number,
  dateISO: string,
  group: string,
  home: Team,
  away: Team,
  hg: number | null,
  ag: number | null,
  finished = true,
): Match {
  const winner =
    hg === null || ag === null
      ? null
      : hg > ag
        ? "HOME_TEAM"
        : ag > hg
          ? "AWAY_TEAM"
          : "DRAW";
  return {
    id: id as FifaMatchId,
    utcDate: dateISO,
    status: finished ? "FINISHED" : "TIMED",
    matchday: 1,
    stage: "GROUP_STAGE",
    group,
    homeTeam: home,
    awayTeam: away,
    score: {
      winner: winner as Match["score"]["winner"],
      duration: "REGULAR",
      fullTime: { home: hg, away: ag },
      halfTime: { home: 0, away: 0 },
    },
    venue: "Stadium",
    referees: [],
  } as unknown as Match;
}

function preds(
  entries: Array<[number, number, number]>,
): LocalPrediction[] {
  return entries.map(([match_id, home_goals, away_goals]) => ({
    match_id: match_id as FifaMatchId,
    home_goals,
    away_goals,
    penalty_winner: null,
  }));
}

// Teams
const A = team("AAA");
const B = team("BBB");
const C = team("CCC");
const D = team("DDD");
const E = team("EEE");
const F = team("FFF");

const NOW = new Date("2026-06-14T00:00:00Z");

// Day 1 (06-12): one match, all play it.
const m1 = makeMatch(1, "2026-06-12T18:00:00Z", "GROUP_A", A, B, 1, 0);
// Day 2 (06-13): two matches.
// Match B: home win 2-0; Match C: away win 0-1 (only alice calls it).
const m2 = makeMatch(2, "2026-06-13T16:00:00Z", "GROUP_B", C, D, 2, 0);
const m3 = makeMatch(3, "2026-06-13T19:00:00Z", "GROUP_C", E, F, 0, 1);

const matches = [m1, m2, m3];

const profiles = [
  { id: "alice", display_name: "Alice", country: null },
  { id: "bob", display_name: "Bob", country: "ar" },
  { id: "carol", display_name: "Carol", country: null },
  { id: "dave", display_name: "Dave", country: null },
  { id: "erin", display_name: "Erin", country: null }, // no predictions
];

const allPredictions: AllPredictions = new Map([
  [
    "alice",
    {
      // m1 1-0 (exact), m2 2-0 (exact, correct), m3 0-1 (exact, correct, lone)
      predictions: preds([
        [1, 1, 0],
        [2, 2, 0],
        [3, 0, 1],
      ]),
      overrides: [],
      thirdPlaceOverrides: [],
    },
  ],
  [
    "bob",
    {
      // m2 1-0 (correct result, not exact), m3 1-0 (wrong)
      predictions: preds([
        [1, 0, 0],
        [2, 1, 0],
        [3, 1, 0],
      ]),
      overrides: [],
      thirdPlaceOverrides: [],
    },
  ],
  [
    "carol",
    {
      // m2 0-1 (wrong), m3 1-1 (wrong)
      predictions: preds([
        [1, 0, 0],
        [2, 0, 1],
        [3, 1, 1],
      ]),
      overrides: [],
      thirdPlaceOverrides: [],
    },
  ],
  [
    "dave",
    {
      // m2 3-1 (correct result, not exact), m3 2-2 (wrong)
      predictions: preds([
        [1, 0, 0],
        [2, 3, 1],
        [3, 2, 2],
      ]),
      overrides: [],
      thirdPlaceOverrides: [],
    },
  ],
]);

describe("computeCompletedMatchDays", () => {
  it("lists fully-finished match days only", () => {
    const days = computeCompletedMatchDays(matches, NOW);
    expect(days).toEqual(["2026-06-12", "2026-06-13"]);
  });

  it("excludes a day with an unfinished match", () => {
    const m3Pending = makeMatch(
      3,
      "2026-06-13T19:00:00Z",
      "GROUP_C",
      E,
      F,
      null,
      null,
      false,
    );
    const days = computeCompletedMatchDays([m1, m2, m3Pending], NOW);
    expect(days).toEqual(["2026-06-12"]);
  });
});

describe("computeDailySummary — day 2", () => {
  const s = computeDailySummary(
    matches,
    allPredictions,
    profiles,
    NOW,
    "2026-06-13",
  );
  const award = (key: string) => s.awards.find((a) => a.key === key);

  it("labels the day and lists its matches with team data", () => {
    expect(s.dayKey).toBe("2026-06-13");
    expect(s.matches.map((m) => m.id)).toEqual([2, 3]);
    expect(s.matches[0].homeTla).toBe("CCC");
    expect(s.matches[0].awayTla).toBe("DDD");
    expect(s.matches[0].homeScore).toBe(2);
  });

  it("Sharpshooter: most correct results = Alice (2)", () => {
    const a = award("sharpshooter")!;
    expect(a.winners.map((w) => w.userId)).toEqual(["alice"]);
    expect(a.winners[0].detail).toBe("2 correct");
  });

  it("Exact Score (per-match): Alice on both matches (≤3 exact predictors)", () => {
    const a = award("rare-bullseye")!;
    expect(a.winners.every((w) => w.userId === "alice")).toBe(true);
    expect(a.winners.length).toBe(2);
    expect(a.winners[0].match).toBeDefined();
  });

  it("Closest Predictor was removed", () => {
    expect(award("closest-predictor")).toBeUndefined();
  });

  it("Goal Machine count award was removed", () => {
    expect(award("goal-machine")).toBeUndefined();
  });

  it("Lone Wolf: only Alice called match 3", () => {
    const a = award("lone-wolf")!;
    expect(a.winners).toHaveLength(1);
    expect(a.winners[0].userId).toBe("alice");
    expect(a.winners[0].match?.id).toBe(3);
    expect(a.winners[0].match?.homeTla).toBe("EEE");
  });

  it("Against the Grain is now per-match and excludes the lone case", () => {
    // In this fixture the only contrarian-correct call is Alice's lone match-3
    // pick, which Lone Wolf already covers. Against the Grain needs a pack of
    // 2+ minority-correct predictors, so it does not fire here.
    expect(award("against-the-grain")).toBeUndefined();
  });

  it("Day MVP includes Alice (most points that day)", () => {
    const a = award("day-mvp")!;
    expect(a.winners.some((w) => w.userId === "alice")).toBe(true);
    expect(a.winners[0].detail?.startsWith("+")).toBe(true);
  });

  it("Quiet Day lists the fewest-points players (bottom tiers)", () => {
    const a = award("fewest-points")!;
    expect(a).toBeDefined();
    // Carol got both day matches' results wrong → fewest points; she must appear
    // and the lowest tier's detail is a "+N" points string.
    expect(a.winners.some((w) => w.userId === "carol")).toBe(true);
    expect(a.winners[0].detail?.startsWith("+")).toBe(true);
    // Alice (the day's best) must NOT be in the fewest-points bottom tiers.
    expect(a.winners.some((w) => w.userId === "alice")).toBe(false);
  });

  it("omits players with no predictions", () => {
    for (const a of s.awards) {
      expect(a.winners.some((w) => w.userId === "erin")).toBe(false);
    }
  });
});

describe("Rare Bullseye threshold", () => {
  it("excludes a match where 4+ players nail the exact score", () => {
    // Single day, single match; 4 players all predict the exact 1-1.
    const t1 = team("XXX");
    const t2 = team("YYY");
    const m = makeMatch(10, "2026-06-20T18:00:00Z", "GROUP_A", t1, t2, 1, 1);
    const everyoneExact: AllPredictions = new Map(
      ["a", "b", "c", "d"].map((id) => [
        id,
        {
          predictions: preds([[10, 1, 1]]),
          overrides: [],
          thirdPlaceOverrides: [],
        },
      ]),
    );
    const profs = ["a", "b", "c", "d"].map((id) => ({
      id,
      display_name: id.toUpperCase(),
      country: null,
    }));
    const s = computeDailySummary(
      [m],
      everyoneExact,
      profs,
      new Date("2026-06-21T00:00:00Z"),
      "2026-06-20",
    );
    expect(s.awards.find((a) => a.key === "rare-bullseye")).toBeUndefined();
  });

  it("scales the threshold to 20% of the group", () => {
    // 10-player group → threshold = floor(10 * 0.2) = 2.
    const t1 = team("PPP");
    const t2 = team("QQQ");
    const m = makeMatch(11, "2026-06-20T18:00:00Z", "GROUP_B", t1, t2, 2, 1);
    const ids = ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8", "u9", "u10"];
    const profs = ids.map((id) => ({
      id,
      display_name: id.toUpperCase(),
      country: null,
    }));
    const when = new Date("2026-06-21T00:00:00Z");

    // 2 players nail 2-1 (≤20%), the rest predict 0-0 → award present.
    const twoExact: AllPredictions = new Map(
      ids.map((id, i) => [
        id,
        {
          predictions: preds([[11, i < 2 ? 2 : 0, i < 2 ? 1 : 0]]),
          overrides: [],
          thirdPlaceOverrides: [],
        },
      ]),
    );
    const sa = computeDailySummary([m], twoExact, profs, when, "2026-06-20");
    const awA = sa.awards.find((a) => a.key === "rare-bullseye");
    expect(awA).toBeDefined();
    expect(awA!.winners).toHaveLength(2);

    // 3 players nail it (>20%) → award excluded.
    const threeExact: AllPredictions = new Map(
      ids.map((id, i) => [
        id,
        {
          predictions: preds([[11, i < 3 ? 2 : 0, i < 3 ? 1 : 0]]),
          overrides: [],
          thirdPlaceOverrides: [],
        },
      ]),
    );
    const sb = computeDailySummary([m], threeExact, profs, when, "2026-06-20");
    expect(sb.awards.find((a) => a.key === "rare-bullseye")).toBeUndefined();
  });
});

describe("Against the Grain (per match)", () => {
  it("lists the small pack (≤ 20% cutoff) who called the result, by match", () => {
    // 15-player group → cutoff = floor(15 * 0.2) = 3. Actual is a home win;
    // only 2 call it (2 in [2, 3]) → award fires for those two.
    const t1 = team("HOM");
    const t2 = team("AWY");
    const m = makeMatch(30, "2026-06-20T18:00:00Z", "GROUP_C", t1, t2, 2, 0);
    const ids = Array.from({ length: 15 }, (_, i) => `u${i}`);
    const ap: AllPredictions = new Map(
      ids.map((id, i) => [
        id,
        {
          // u0, u1 predict a home win (correct); the rest predict an away win.
          predictions: preds([[30, i < 2 ? 1 : 0, i < 2 ? 0 : 1]]),
          overrides: [],
          thirdPlaceOverrides: [],
        },
      ]),
    );
    const profs = ids.map((id) => ({
      id,
      display_name: id.toUpperCase(),
      country: null,
    }));
    const s = computeDailySummary(
      [m],
      ap,
      profs,
      new Date("2026-06-21T00:00:00Z"),
      "2026-06-20",
    );
    const a = s.awards.find((x) => x.key === "against-the-grain")!;
    expect(a).toBeDefined();
    expect(a.winners.map((w) => w.userId).sort()).toEqual(["u0", "u1"]);
    expect(a.winners.every((w) => w.match?.id === 30)).toBe(true);
    expect(a.winners[0].match?.homeTla).toBe("HOM");
  });

  it("does not fire when more than the cutoff called it right", () => {
    // 15-player group → cutoff = 3. Here 5 call the home win (5 > 3) → too many
    // to be "against the grain".
    const t1 = team("HM2");
    const t2 = team("AW2");
    const m = makeMatch(31, "2026-06-20T18:00:00Z", "GROUP_C", t1, t2, 2, 0);
    const ids = Array.from({ length: 15 }, (_, i) => `u${i}`);
    const ap: AllPredictions = new Map(
      ids.map((id, i) => [
        id,
        {
          predictions: preds([[31, i < 5 ? 1 : 0, i < 5 ? 0 : 1]]),
          overrides: [],
          thirdPlaceOverrides: [],
        },
      ]),
    );
    const profs = ids.map((id) => ({
      id,
      display_name: id.toUpperCase(),
      country: null,
    }));
    const s = computeDailySummary(
      [m],
      ap,
      profs,
      new Date("2026-06-21T00:00:00Z"),
      "2026-06-20",
    );
    expect(s.awards.find((x) => x.key === "against-the-grain")).toBeUndefined();
  });
});

describe("Cross-award prioritization on tied cutoffs", () => {
  it("orders a tied award so multi-award players come first", () => {
    // Two matches, both home wins. zoe nails both exactly; amy & bob get the
    // results right but not exact. All three tie on Sharpshooter (2 correct),
    // but only zoe also wins Goal Machine / Closest / Day MVP — so zoe appears
    // in more awards and must be ordered first despite an alphabetically-later
    // name.
    const t1 = team("AA1");
    const t2 = team("AA2");
    const t3 = team("BB1");
    const t4 = team("BB2");
    const mm1 = makeMatch(20, "2026-06-22T16:00:00Z", "GROUP_A", t1, t2, 1, 0);
    const mm2 = makeMatch(21, "2026-06-22T19:00:00Z", "GROUP_B", t3, t4, 2, 0);

    const ap: AllPredictions = new Map([
      [
        "zoe",
        {
          predictions: preds([
            [20, 1, 0],
            [21, 2, 0],
          ]),
          overrides: [],
          thirdPlaceOverrides: [],
        },
      ],
      [
        "amy",
        {
          predictions: preds([
            [20, 3, 0],
            [21, 4, 0],
          ]),
          overrides: [],
          thirdPlaceOverrides: [],
        },
      ],
      [
        "bob",
        {
          predictions: preds([
            [20, 5, 0],
            [21, 6, 0],
          ]),
          overrides: [],
          thirdPlaceOverrides: [],
        },
      ],
    ]);
    const profs = [
      { id: "zoe", display_name: "Zoe", country: null },
      { id: "amy", display_name: "Amy", country: null },
      { id: "bob", display_name: "Bob", country: null },
    ];

    const s = computeDailySummary(
      [mm1, mm2],
      ap,
      profs,
      new Date("2026-06-23T00:00:00Z"),
      "2026-06-22",
    );

    const sharp = s.awards.find((a) => a.key === "sharpshooter")!;
    // All three tie at 2 correct. With a 3-player group the 20% cutoff is 1, so
    // only the highest-priority player survives — and that must be Zoe, who
    // features across more awards (not whoever sorts first alphabetically).
    expect(sharp.winners.map((w) => w.userId)).toEqual(["zoe"]);
    // Zoe is the sole Exact Score winner (confirms her extra award appearances).
    expect(
      s.awards
        .find((a) => a.key === "rare-bullseye")!
        .winners.every((w) => w.userId === "zoe"),
    ).toBe(true);
  });
});

