import { describe, it, expect } from "vitest";
import { getMatchHighlight } from "../match-highlight";
import type { MatchWithLiveInfo } from "@/contexts/MatchContext";

function match(
  stage: string,
  home: number | null,
  away: number | null,
  winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null,
  status: MatchWithLiveInfo["status"] = "FINISHED",
): MatchWithLiveInfo {
  return {
    id: 74,
    stage,
    status,
    score: {
      winner,
      duration: "REGULAR",
      fullTime: { home, away },
      halfTime: { home: 0, away: 0 },
    },
  } as unknown as MatchWithLiveInfo;
}

describe("getMatchHighlight", () => {
  it("highlights the decisive winner only", () => {
    const h = getMatchHighlight(match("LAST_32", 2, 1, "HOME_TEAM"));
    expect(h.homeHighlight).toBe(true);
    expect(h.awayHighlight).toBe(false);
  });

  it("highlights both teams on a group-stage draw", () => {
    const h = getMatchHighlight(match("GROUP_STAGE", 1, 1, "DRAW"));
    expect(h.homeHighlight).toBe(true);
    expect(h.awayHighlight).toBe(true);
  });

  it("highlights the penalty advancer (home) on a knockout draw", () => {
    const h = getMatchHighlight(match("LAST_32", 1, 1, "HOME_TEAM"));
    expect(h.homeHighlight).toBe(true);
    expect(h.awayHighlight).toBe(false);
  });

  it("highlights the penalty advancer (away) on a knockout draw", () => {
    const h = getMatchHighlight(match("SEMI_FINALS", 1, 1, "AWAY_TEAM"));
    expect(h.homeHighlight).toBe(false);
    expect(h.awayHighlight).toBe(true);
  });

  it("highlights neither on a knockout draw with no recorded advancer", () => {
    const h = getMatchHighlight(match("LAST_16", 1, 1, "DRAW"));
    expect(h.homeHighlight).toBe(false);
    expect(h.awayHighlight).toBe(false);
  });
});
