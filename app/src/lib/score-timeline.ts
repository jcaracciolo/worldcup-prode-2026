/**
 * Score timeline — compute each player's cumulative score as of a given date,
 * and build a per-day timeline for the stats chart.
 *
 * Reuses the existing scoring engine (calculateTotalPoints + LiveBracketResolver)
 * by snapshotting the match set to a date: any match not yet completed by that
 * date is treated as not-played, so standings, bonuses and knockout resolution
 * all reflect only what was known at that point in time.
 */

import { format } from "date-fns";
import { Match, FifaMatchId } from "@/types/football";
import {
  LocalPrediction,
  LocalGroupStandingsOverride,
  LocalThirdPlaceOverride,
} from "@/types/database";
import { LiveBracketResolver } from "./live-bracket-resolver";
import { calculateTotalPoints } from "./scoring";

/** Per-user prediction bundle, matching useAllPredictions().content values. */
export interface UserPredictionBundle {
  predictions: LocalPrediction[];
  overrides: LocalGroupStandingsOverride[];
  thirdPlaceOverrides: LocalThirdPlaceOverride[];
}

export type AllPredictions = Map<string, UserPredictionBundle>;

export interface TimelinePlayer {
  userId: string;
  name: string;
  country: string | null;
}

/**
 * One row per day. For each player, two keys:
 *   - `[userId]`            → position that day (1 = leader), the plotted value
 *   - `[userId + PTS_SUFFIX]` → cumulative points that day (for the tooltip)
 */
export type TimelineRow = { date: string } & Record<string, number | string>;

/** Suffix for the per-player points field stored alongside the position. */
export const PTS_SUFFIX = "::pts";

export interface ScoreTimeline {
  rows: TimelineRow[];
  players: TimelinePlayer[];
}

/** A match counts toward scores as of `date` once it has FINISHED and its
 *  kickoff is at or before `date`. */
function isScoredAsOf(match: Match, date: Date): boolean {
  return (
    match.status === "FINISHED" &&
    match.score.fullTime.home !== null &&
    match.score.fullTime.away !== null &&
    new Date(match.utcDate).getTime() <= date.getTime()
  );
}

/**
 * Return a copy of `matches` where any match not yet scored as of `date` is
 * reset to an unplayed state (status SCHEDULED, scores null). Matches already
 * scored are returned unchanged.
 */
export function snapshotMatchesAsOf(matches: Match[], date: Date): Match[] {
  return matches.map((m) => {
    if (isScoredAsOf(m, date)) return m;
    return {
      ...m,
      status: "SCHEDULED",
      score: {
        ...m.score,
        winner: null,
        fullTime: { home: null, away: null },
        halfTime: { home: null, away: null },
      },
    };
  });
}

/**
 * Compute every player's total score as of `date`.
 * Builds the live bracket once from the date-snapshot, then scores each user.
 */
export function calculateScoresAsOf(
  matches: Match[],
  allPredictions: AllPredictions,
  date: Date,
): Map<string, number> {
  const snapshot = snapshotMatchesAsOf(matches, date);
  const withFifa = snapshot.map((m) => ({
    ...m,
    fifaNumber: m.id as FifaMatchId,
  }));
  const liveBracket = new LiveBracketResolver(snapshot).resolve();

  const scores = new Map<string, number>();
  allPredictions.forEach((bundle, userId) => {
    const { totalPoints } = calculateTotalPoints(
      withFifa,
      bundle.predictions,
      bundle.overrides ?? [],
      liveBracket,
      bundle.thirdPlaceOverrides ?? [],
    );
    scores.set(userId, totalPoints);
  });
  return scores;
}

/** UTC calendar day string (YYYY-MM-DD) for a date. */
function utcDayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** End-of-day (UTC) instant for a YYYY-MM-DD day string. */
function endOfUtcDay(dayStr: string): Date {
  return new Date(`${dayStr}T23:59:59.999Z`);
}

/**
 * Build the per-day position timeline (bump chart) for the chart.
 *
 * - One point per UTC day that contains at least one finished match, capped at
 *   `now` (simulation-aware). The current day uses `now` as its as-of instant so
 *   matches finished earlier today are included.
 * - Each row stores every player's **position** that day (1 = leader) plus their
 *   cumulative points (under `userId + PTS_SUFFIX`) for the tooltip.
 * - Positions are unique per day; ties are broken by the previous day's position
 *   (to minimize line crossings), then alphabetically — so each player has a
 *   distinct line.
 * - Only players who have made at least one prediction are included.
 */
export function buildScoreTimeline(
  matches: Match[],
  allPredictions: AllPredictions,
  profiles: { id: string; display_name: string; country: string | null }[],
  now: Date,
): ScoreTimeline {
  // Players with at least one filled prediction.
  const players: TimelinePlayer[] = profiles
    .filter((p) => {
      const bundle = allPredictions.get(p.id);
      return (
        !!bundle &&
        bundle.predictions.some(
          (pr) => pr.home_goals !== null && pr.away_goals !== null,
        )
      );
    })
    .map((p) => ({ userId: p.id, name: p.display_name, country: p.country }));

  if (players.length === 0) return { rows: [], players };

  // Distinct days (UTC) with a finished match, up to now.
  const daySet = new Set<string>();
  for (const m of matches) {
    if (!isScoredAsOf(m, now)) continue;
    daySet.add(utcDayString(new Date(m.utcDate)));
  }
  const days = [...daySet].sort();
  if (days.length === 0) return { rows: [], players };

  const nameById = new Map(players.map((p) => [p.userId, p.name]));
  const rows: TimelineRow[] = [];
  // Previous day's positions, used as a tiebreaker to keep lines stable.
  const prevPos = new Map<string, number>();

  for (const day of days) {
    const asOf = new Date(Math.min(endOfUtcDay(day).getTime(), now.getTime()));
    const scores = calculateScoresAsOf(matches, allPredictions, asOf);

    // Rank players: highest points first; ties → previous position, then name.
    const ranked = players
      .map((p) => ({ userId: p.userId, pts: scores.get(p.userId) ?? 0 }))
      .sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        const pa = prevPos.get(a.userId) ?? Number.MAX_SAFE_INTEGER;
        const pb = prevPos.get(b.userId) ?? Number.MAX_SAFE_INTEGER;
        if (pa !== pb) return pa - pb;
        return (nameById.get(a.userId) ?? "").localeCompare(
          nameById.get(b.userId) ?? "",
        );
      });

    const row: TimelineRow = {
      date: format(new Date(`${day}T12:00:00Z`), "MMM d"),
    };
    ranked.forEach((r, i) => {
      const position = i + 1;
      row[r.userId] = position;
      row[`${r.userId}${PTS_SUFFIX}`] = r.pts;
      prevPos.set(r.userId, position);
    });
    rows.push(row);
  }

  return { rows, players };
}
