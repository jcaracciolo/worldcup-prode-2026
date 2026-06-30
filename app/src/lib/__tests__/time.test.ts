import { describe, it, expect } from "vitest";
import {
  isKnockoutMatchLocked,
  isKnockoutStageLocked,
  getDaysUntilKnockoutLocks,
  KNOCKOUT_START,
  KNOCKOUT_DEADLINE,
} from "../time";

// Key instants
const BEFORE_FIRST = new Date(Date.UTC(2026, 5, 28, 18, 0, 0)); // Jun 28 18:00Z, before #73
const FIRST_KICKOFF = KNOCKOUT_START; // Jun 28 19:00Z (#73)
const MID_WINDOW = new Date(Date.UTC(2026, 5, 29, 0, 0, 0)); // Jun 29 00:00Z
const DEADLINE = KNOCKOUT_DEADLINE; // Jun 29 17:00Z
const AFTER_DEADLINE = new Date(Date.UTC(2026, 5, 29, 18, 0, 0)); // Jun 29 18:00Z

// Representative knockout matches (UTC ISO kickoff times)
const MATCH_73 = "2026-06-28T19:00:00Z"; // first match
const MATCH_76 = "2026-06-29T17:00:00Z"; // next day, at the deadline
const MATCH_R16 = "2026-07-04T17:00:00Z"; // weeks later

describe("isKnockoutStageLocked (now = bracket deadline)", () => {
  it("is false before the deadline (even after the first match starts)", () => {
    expect(isKnockoutStageLocked(BEFORE_FIRST)).toBe(false);
    expect(isKnockoutStageLocked(FIRST_KICKOFF)).toBe(false);
    expect(isKnockoutStageLocked(MID_WINDOW)).toBe(false);
  });
  it("is true at and after the deadline", () => {
    expect(isKnockoutStageLocked(DEADLINE)).toBe(true);
    expect(isKnockoutStageLocked(AFTER_DEADLINE)).toBe(true);
  });
});

describe("isKnockoutMatchLocked (per-match)", () => {
  it("before the first match: nothing is locked", () => {
    expect(isKnockoutMatchLocked(MATCH_73, BEFORE_FIRST)).toBe(false);
    expect(isKnockoutMatchLocked(MATCH_76, BEFORE_FIRST)).toBe(false);
    expect(isKnockoutMatchLocked(MATCH_R16, BEFORE_FIRST)).toBe(false);
  });

  it("mid-window: only the first (kicked-off) match is locked", () => {
    expect(isKnockoutMatchLocked(MATCH_73, MID_WINDOW)).toBe(true);
    expect(isKnockoutMatchLocked(MATCH_76, MID_WINDOW)).toBe(false);
    expect(isKnockoutMatchLocked(MATCH_R16, MID_WINDOW)).toBe(false);
  });

  it("first match locks exactly at its kickoff", () => {
    expect(isKnockoutMatchLocked(MATCH_73, FIRST_KICKOFF)).toBe(true);
  });

  it("after the deadline: the whole bracket is locked", () => {
    expect(isKnockoutMatchLocked(MATCH_73, AFTER_DEADLINE)).toBe(true);
    expect(isKnockoutMatchLocked(MATCH_76, AFTER_DEADLINE)).toBe(true);
    expect(isKnockoutMatchLocked(MATCH_R16, AFTER_DEADLINE)).toBe(true);
  });

  it("a match kicking off before the deadline locks at its own kickoff", () => {
    // MATCH_76 kicks off exactly at the deadline; just before, it is unlocked
    const justBefore = new Date(DEADLINE.getTime() - 60_000);
    expect(isKnockoutMatchLocked(MATCH_76, justBefore)).toBe(false);
    expect(isKnockoutMatchLocked(MATCH_76, DEADLINE)).toBe(true);
  });
});

describe("getDaysUntilKnockoutLocks (counts down to the deadline)", () => {
  it("returns null once the deadline has passed", () => {
    expect(getDaysUntilKnockoutLocks(AFTER_DEADLINE)).toBeNull();
    expect(getDaysUntilKnockoutLocks(DEADLINE)).toBeNull();
  });
  it("returns a small day count in the days before the deadline", () => {
    const days = getDaysUntilKnockoutLocks(BEFORE_FIRST);
    expect(days).not.toBeNull();
    expect(days as number).toBeLessThanOrEqual(5);
    expect(days as number).toBeGreaterThan(0);
  });
});
