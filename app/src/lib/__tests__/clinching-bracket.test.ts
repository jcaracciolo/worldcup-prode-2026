import { describe, it, expect } from "vitest";
import { LiveBracketResolver } from "../live-bracket-resolver";
import { Match, Team, asFifaMatchId } from "@/types/football";

function team(id: number, tla: string): Team {
  return { id, name: tla, shortName: tla, tla, crest: null };
}

const A1 = team(11, "AA1");
const A2 = team(12, "AA2");
const A3 = team(13, "AA3");
const A4 = team(14, "AA4");
const placeholder = team(0, "1A"); // invalid API team → resolver uses bracket slot

function groupMatch(
  id: number,
  home: Team,
  away: Team,
  hg: number | null,
  ag: number | null,
): Match {
  const finished = hg !== null && ag !== null;
  return {
    id: asFifaMatchId(id),
    utcDate: "2026-06-11T19:00:00Z",
    status: finished ? "FINISHED" : "TIMED",
    matchday: 1,
    stage: "GROUP_STAGE",
    group: "GROUP_A",
    homeTeam: home,
    awayTeam: away,
    score: {
      winner: finished ? (hg! > ag! ? "HOME_TEAM" : ag! > hg! ? "AWAY_TEAM" : "DRAW") : null,
      duration: "REGULAR",
      fullTime: { home: hg, away: ag },
      halfTime: { home: null, away: null },
    },
    venue: null,
    referees: [],
  } as Match;
}

function r32Match(id: number): Match {
  return {
    id: asFifaMatchId(id),
    utcDate: "2026-06-29T19:00:00Z",
    status: "TIMED",
    matchday: null,
    stage: "LAST_32",
    group: null,
    homeTeam: placeholder,
    awayTeam: placeholder,
    score: {
      winner: null,
      duration: "REGULAR",
      fullTime: { home: null, away: null },
      halfTime: { home: null, away: null },
    },
    venue: null,
    referees: [],
  } as Match;
}

describe("LiveBracketResolver — early R32 fill via clinching", () => {
  // GROUP_A: A1 clinches 1st (6 pts, others capped ≤5) but the group is NOT
  // complete (A1 vs A4 and A2 vs A3 still to play). 2nd is still contested.
  const groupA: Match[] = [
    groupMatch(1, A1, A2, 1, 0), // A1 beats A2
    groupMatch(2, A1, A3, 1, 0), // A1 beats A3 → A1 = 6
    groupMatch(3, A3, A4, 0, 0), // A3/A4 draw
    groupMatch(4, A2, A4, 0, 0), // A2/A4 draw
    groupMatch(5, A1, A4, null, null), // pending
    groupMatch(6, A2, A3, null, null), // pending
  ];

  it("fills the 1A R32 slot (match 79) once 1st is clinched, before the group ends", () => {
    // Match 79 home = Winner of Group A (position 1); away = a 3rd-place team.
    const matches = [...groupA, r32Match(79)];
    const bracket = new LiveBracketResolver(matches).resolve();

    const m79 = bracket.teams.get(asFifaMatchId(79))!;
    expect(m79.home?.id).toBe(A1.id); // clinched winner filled early
    // 3rd-place away slot stays unresolved until ALL groups are complete.
    expect(m79.away).toBeNull();
  });

  it("leaves the 2A R32 slot (match 73 home) unresolved while 2nd is contested", () => {
    const matches = [...groupA, r32Match(73)];
    const bracket = new LiveBracketResolver(matches).resolve();

    const m73 = bracket.teams.get(asFifaMatchId(73))!;
    expect(m73.home).toBeNull(); // 2nd place not clinched → not filled
  });
});
