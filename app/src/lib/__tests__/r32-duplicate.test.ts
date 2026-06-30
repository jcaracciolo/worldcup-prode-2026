import { describe, it, expect } from "vitest";
import { LiveBracketResolver } from "../live-bracket-resolver";
import { buildAllMatches, buildGroupStageMatches, buildKnockoutMatches } from "./bracket-resolver.mock";
import { Match } from "@/types/football";

// Mulberry32 PRNG for deterministic fuzzing
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Randomize the scores of all group matches with the given seed. */
function randomizeGroupScores(matches: Match[], seed: number): Match[] {
  const r = rng(seed);
  return matches.map((m) => {
    if (m.stage !== "GROUP_STAGE") return m;
    const hg = Math.floor(r() * 4);
    const ag = Math.floor(r() * 4);
    const winner = hg > ag ? "HOME_TEAM" : ag > hg ? "AWAY_TEAM" : "DRAW";
    return {
      ...m,
      status: "FINISHED" as const,
      score: {
        winner: winner as Match["score"]["winner"],
        duration: "REGULAR",
        fullTime: { home: hg, away: ag },
        halfTime: { home: 0, away: 0 },
      },
    };
  });
}

/** Collect duplicate team IDs across all R32 (73-88) home/away slots. */
function findR32Duplicates(resolver: LiveBracketResolver): Map<number, string[]> {
  const bracket = resolver.resolve();
  const seen = new Map<number, string[]>(); // teamId -> list of "M<id>/<side>"
  for (let id = 73; id <= 88; id++) {
    const r = bracket.teams.get(id as never);
    if (!r) continue;
    if (r.home?.id != null) {
      const arr = seen.get(r.home.id) ?? [];
      arr.push(`M${id}/home(${r.home.tla})`);
      seen.set(r.home.id, arr);
    }
    if (r.away?.id != null) {
      const arr = seen.get(r.away.id) ?? [];
      arr.push(`M${id}/away(${r.away.tla})`);
      seen.set(r.away.id, arr);
    }
  }
  const dups = new Map<number, string[]>();
  for (const [tid, locs] of seen) {
    if (locs.length > 1) dups.set(tid, locs);
  }
  return dups;
}

describe("R32 duplicate team detection (fuzz)", () => {
  it("never places the same team in two R32 slots when all groups complete", () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 2000; seed++) {
      const group = randomizeGroupScores(buildGroupStageMatches(), seed);
      const all = [...group, ...buildKnockoutMatches()];
      const dups = findR32Duplicates(new LiveBracketResolver(all));
      if (dups.size > 0) {
        const desc = [...dups.entries()]
          .map(([tid, locs]) => `team#${tid}: ${locs.join(" + ")}`)
          .join("; ");
        failures.push(`seed=${seed}: ${desc}`);
      }
    }
    if (failures.length > 0) {
      console.error(`Found ${failures.length} duplicate scenarios:`);
      failures.slice(0, 10).forEach((f) => console.error("  " + f));
    }
    expect(failures).toEqual([]);
  });

  it("never places the same team in two R32 slots in partial (clinching) states", () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 2000; seed++) {
      let group = randomizeGroupScores(buildGroupStageMatches(), seed);
      // Make a subset of group matches "not finished" to trigger clinching path.
      const r = rng(seed + 999983);
      group = group.map((m) => {
        if (m.stage === "GROUP_STAGE" && r() < 0.25) {
          return {
            ...m,
            status: "TIMED" as const,
            score: {
              winner: null,
              duration: "REGULAR",
              fullTime: { home: null, away: null },
              halfTime: { home: null, away: null },
            },
          };
        }
        return m;
      });
      const all = [...group, ...buildKnockoutMatches()];
      const dups = findR32Duplicates(new LiveBracketResolver(all));
      if (dups.size > 0) {
        const desc = [...dups.entries()]
          .map(([tid, locs]) => `team#${tid}: ${locs.join(" + ")}`)
          .join("; ");
        failures.push(`seed=${seed}: ${desc}`);
      }
    }
    if (failures.length > 0) {
      console.error(`Found ${failures.length} partial-state duplicate scenarios:`);
      failures.slice(0, 10).forEach((f) => console.error("  " + f));
    }
    expect(failures).toEqual([]);
  });
});

// keep buildAllMatches referenced to avoid unused import lint
void buildAllMatches;

describe("R32 calc ignores API position disagreement", () => {
  it("ignores a football-data position the calc disagrees with (no duplicate)", async () => {
    const { TEAM_C2 } = await import("./bracket-resolver.mock");
    // Our calc for GROUP_C (from buildGroupStageMatches) ranks: 1C=FRA, 2C=GER(TEAM_C2).
    const group = buildGroupStageMatches();
    const knockout = buildKnockoutMatches();

    // Simulate football-data.org assigning match 76 home (the 1C slot) = Germany,
    // i.e. the API thinks Germany WON group C — disagreeing with our calc (2nd).
    const tampered = knockout.map((m) => {
      if (m.id === 76) {
        return { ...m, homeTeam: TEAM_C2 }; // valid API team in the 1C slot
      }
      return m;
    });

    const all = [...group, ...tampered];
    const dups = findR32Duplicates(new LiveBracketResolver(all));

    const germanyLocs = dups.get(TEAM_C2.id) ?? [];
    console.log("Germany appears at:", germanyLocs.join(" + ") || "(no duplicate)");
    // The API team is ignored entirely: Germany is placed solely by our calc
    // (2C → M75 away), never duplicated into the API-claimed 1C slot.
    expect(germanyLocs.length).toBeLessThanOrEqual(1);
  });
});

