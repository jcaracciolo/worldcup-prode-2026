import { describe, it, expect } from "vitest";
import { randomFillPredictions } from "../random-predictions";
import { validatePredictions } from "../prediction-validation";
import { isKnockoutMatchLocked } from "../time";
import { MatchWithLiveInfo } from "@/contexts/MatchContext";
import { FifaMatchId } from "@/types/football";
import { LocalPrediction } from "@/types/database";

// Minimal match factory — the lock helpers only read id, stage, utcDate.
function ko(id: number, utcDate: string): MatchWithLiveInfo {
  return {
    id: id as FifaMatchId,
    stage: "LAST_32",
    utcDate,
  } as unknown as MatchWithLiveInfo;
}

const MID_WINDOW = new Date(Date.UTC(2026, 5, 29, 0, 0, 0)); // Jun 29 00:00Z

// #73 has kicked off (locked); #76 (next day) is still open.
const MATCH_73 = ko(73, "2026-06-28T19:00:00Z");
const MATCH_76 = ko(76, "2026-06-29T17:00:00Z");
const matches = [MATCH_73, MATCH_76];

const lockAtMid = (d: string | Date) => isKnockoutMatchLocked(d, MID_WINDOW);

describe("randomFillPredictions respects per-match knockout locks", () => {
  it("does not fill a knockout match that has individually locked", () => {
    const empty = new Map<FifaMatchId, LocalPrediction>();
    const result = randomFillPredictions(matches, empty, {
      groupLocked: true,
      knockoutOpen: true,
      knockoutLocked: false, // deadline not yet passed
      isKnockoutMatchLocked: lockAtMid,
    });
    // #73 is locked → must remain unfilled; #76 is open → gets filled
    expect(result.has(73 as FifaMatchId)).toBe(false);
    expect(result.has(76 as FifaMatchId)).toBe(true);
  });
});

describe("validatePredictions ignores locked-and-missing knockout matches", () => {
  it("does not warn about a locked match that has no prediction", () => {
    const empty = new Map<FifaMatchId, LocalPrediction>();
    const warnings = validatePredictions(matches, empty, {
      groupLocked: true,
      knockoutOpen: true,
      knockoutLocked: false,
      isKnockoutMatchLocked: lockAtMid,
    });
    // Only #76 (still open) should be counted as missing — 1 of 1
    expect(warnings.some((w) => /1 of 1 knockout matches/.test(w))).toBe(true);
  });
});
