import { describe, it, expect } from "vitest";
import { mergeMatchWithLiveData } from "../providers/composite-provider";
import type { Match } from "@/types/football";
import type { LiveMatchData } from "../providers/types";

function knockoutBase(
  winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null,
  home: number | null,
  away: number | null,
): Match {
  return {
    id: 74,
    stage: "LAST_32",
    status: "FINISHED",
    utcDate: "2026-06-29T18:00:00Z",
    homeTeam: { id: 1, name: "Germany", tla: "GER", crest: null },
    awayTeam: { id: 2, name: "Paraguay", tla: "PAR", crest: null },
    score: {
      winner,
      duration: "PENALTY_SHOOTOUT",
      fullTime: { home, away },
      halfTime: { home: 0, away: 0 },
    },
  } as unknown as Match;
}

function live(
  status: Match["status"],
  homeGoals: number | null,
  awayGoals: number | null,
): LiveMatchData {
  return {
    homeTeamName: "Germany",
    awayTeamName: "Paraguay",
    utcDate: "2026-06-29",
    status,
    homeGoals,
    awayGoals,
  } as unknown as LiveMatchData;
}

describe("mergeMatchWithLiveData — knockout tie advancer preservation", () => {
  it("does NOT overwrite the base shootout advancer when live reports a tie", () => {
    // Base already knows PAR advanced on penalties (1-1, winner=AWAY_TEAM).
    const base = knockoutBase("AWAY_TEAM", 1, 1);
    const merged = mergeMatchWithLiveData(base, live("FINISHED", 1, 1));
    // The live tie must not downgrade the winner to "DRAW"/null.
    expect(merged.score.winner).toBe("AWAY_TEAM");
    expect(merged.score.fullTime).toEqual({ home: 1, away: 1 });
  });

  it("still applies a decisive live winner", () => {
    const base = knockoutBase(null, null, null);
    const merged = mergeMatchWithLiveData(base, live("IN_PLAY", 2, 1));
    expect(merged.score.winner).toBe("HOME_TEAM");
  });

  it("keeps base winner (null) when live tie and base undecided", () => {
    const base = knockoutBase(null, null, null);
    const merged = mergeMatchWithLiveData(base, live("IN_PLAY", 1, 1));
    expect(merged.score.winner).toBeNull();
  });
});
