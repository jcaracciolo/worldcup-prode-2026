/**
 * Daily Summary — award-style recap of a single completed match day.
 *
 * Pure / React-free so it can be unit-tested. Reuses the existing scoring engine
 * (calculateTotalPoints + LiveBracketResolver via score-timeline helpers) for
 * per-day point / position / advance deltas, and per-match prediction scans for
 * the result-based awards.
 */

import { format } from "date-fns";
import { Match, FifaMatchId } from "@/types/football";
import { getMatchResult, getPredictionResult } from "./match-utils";
import { calculateTotalPoints } from "./scoring";
import { LiveBracketResolver } from "./live-bracket-resolver";
import { AllPredictions, snapshotMatchesAsOf } from "./score-timeline";

export interface AwardWinner {
  userId: string;
  name: string;
  country: string | null;
  /** Optional numeric/stat context shown after the name (e.g. "+12", "4 correct"). */
  detail?: string;
  /** Optional match this record was set on, for per-match awards (rendered with flags). */
  match?: MatchRef;
  /** Optional teams to render as flags (e.g. the teams an Oracle called to advance). */
  teams?: TeamRef[];
}

/** A match reference with team crests, for rendering flags + score. */
export interface MatchRef {
  id: FifaMatchId;
  homeTla: string;
  homeCrest: string | null;
  awayTla: string;
  awayCrest: string | null;
  homeScore: number | null;
  awayScore: number | null;
}

/** A team reference, for rendering a flag + code. */
export interface TeamRef {
  tla: string;
  crest: string | null;
}

export interface DailyAward {
  key: string;
  emoji: string;
  title: string;
  subtitle: string;
  winners: AwardWinner[];
}

export interface DailySummary {
  dayKey: string;
  dayLabel: string;
  /** The day's finished matches (for the header strip). */
  matches: MatchRef[];
  awards: DailyAward[];
}

interface Profile {
  id: string;
  display_name: string;
  country: string | null;
}

type PredMap = Map<FifaMatchId, { home: number; away: number }>;

interface PlayerData {
  profile: Profile;
  preds: PredMap;
}

// =====================================================================
// DAY GROUPING
// =====================================================================

/**
 * Match-day key for a date — mirrors getMatchDay() in MatchContext: shift back
 * 6h so late-night kickoffs group with the calendar day they belong to, then
 * take the local (en-CA = YYYY-MM-DD) date. Replicated here to keep this module
 * React-free and unit-testable.
 */
function matchDayKey(date: Date): string {
  const shifted = new Date(date.getTime() - 6 * 60 * 60 * 1000);
  return shifted.toLocaleDateString("en-CA");
}

/** A match counts as finished as of `now` (FINISHED and kickoff <= now). */
function isFinishedAsOf(m: Match, now: Date): boolean {
  return (
    m.status === "FINISHED" &&
    m.score.fullTime.home !== null &&
    m.score.fullTime.away !== null &&
    new Date(m.utcDate).getTime() <= now.getTime()
  );
}

/**
 * The keys of every match-day whose matches are ALL finished as of `now`,
 * sorted ascending. A day with any not-yet-finished match is excluded.
 */
export function computeCompletedMatchDays(matches: Match[], now: Date): string[] {
  const byDay = new Map<string, { total: number; finished: number }>();
  for (const m of matches) {
    const key = matchDayKey(new Date(m.utcDate));
    const e = byDay.get(key) ?? { total: 0, finished: 0 };
    e.total += 1;
    if (isFinishedAsOf(m, now)) e.finished += 1;
    byDay.set(key, e);
  }
  return [...byDay.entries()]
    .filter(([, e]) => e.total > 0 && e.finished === e.total)
    .map(([k]) => k)
    .sort();
}

/** Format a YYYY-MM-DD day key as e.g. "Mon, Jun 29" (parsed as a local date). */
export function formatDayLabel(dayKey: string): string {
  const [y, mo, d] = dayKey.split("-").map(Number);
  if (!y || !mo || !d) return dayKey;
  return format(new Date(y, mo - 1, d), "EEE, MMM d");
}

// =====================================================================
// AS-OF SCORING (total points + advance count per user)
// =====================================================================

interface AsOfStat {
  total: number;
  advance: number;
  /** Teams the user correctly predicted to advance (credited as-of this instant). */
  advanceTeams: TeamRef[];
}

function computeAsOf(
  matches: Match[],
  allPredictions: AllPredictions,
  asOf: Date,
): Map<string, AsOfStat> {
  const snapshot = snapshotMatchesAsOf(matches, asOf);
  const withFifa = snapshot.map((m) => ({
    ...m,
    fifaNumber: m.id as FifaMatchId,
  }));
  const liveBracket = new LiveBracketResolver(snapshot).resolve();

  const out = new Map<string, AsOfStat>();
  allPredictions.forEach((bundle, userId) => {
    const { totalPoints, breakdown } = calculateTotalPoints(
      withFifa,
      bundle.predictions,
      bundle.overrides ?? [],
      liveBracket,
      bundle.thirdPlaceOverrides ?? [],
    );
    const advanceEntries = breakdown.filter((b) => b.type === "group_advance");
    const advanceTeams: TeamRef[] = advanceEntries
      .filter((b) => b.team)
      .map((b) => ({ tla: b.team!.tla, crest: b.team!.crest }));
    out.set(userId, {
      total: totalPoints,
      advance: advanceEntries.length,
      advanceTeams,
    });
  });
  return out;
}

/** Competition-style ranking (ties share a rank: 1, 1, 3, …) by score desc. */
function rankByScore(scores: Map<string, number>): Map<string, number> {
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const ranks = new Map<string, number>();
  let lastScore: number | null = null;
  let lastRank = 0;
  sorted.forEach(([userId, score], i) => {
    const rk = lastScore !== null && score === lastScore ? lastRank : i + 1;
    lastScore = score;
    lastRank = rk;
    ranks.set(userId, rk);
  });
  return ranks;
}

/** "1st", "2nd", "3rd", "4th"… */
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// =====================================================================
// MAIN
// =====================================================================

const MAX_PER_MATCH_WINNERS = 10;

export function computeDailySummary(
  matches: Match[],
  allPredictions: AllPredictions,
  profiles: Profile[],
  now: Date,
  dayKey: string,
): DailySummary {
  // The day's finished matches.
  const dayMatches = matches.filter(
    (m) => matchDayKey(new Date(m.utcDate)) === dayKey && isFinishedAsOf(m, now),
  );

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const nameOf = (userId: string): { name: string; country: string | null } => {
    const p = profileById.get(userId);
    return { name: p?.display_name ?? "Unknown", country: p?.country ?? null };
  };

  // Scope the as-of scoring/ranking to THIS competition's members. allPredictions
  // is global (keyed by user across every competition), but profiles is the
  // competition's roster — so Day MVP / Climber / Oracle must only consider and
  // rank users in this circuit (matching the leaderboard), otherwise an outsider
  // could "win" and render as "Unknown".
  const scopedPredictions: AllPredictions = new Map();
  allPredictions.forEach((bundle, userId) => {
    if (profileById.has(userId)) scopedPredictions.set(userId, bundle);
  });

  // Players with at least one filled prediction (for per-match metrics).
  const players: PlayerData[] = [];
  for (const profile of profiles) {
    const bundle = allPredictions.get(profile.id);
    if (!bundle) continue;
    const preds: PredMap = new Map();
    for (const pr of bundle.predictions) {
      if (pr.home_goals !== null && pr.away_goals !== null) {
        preds.set(pr.match_id as FifaMatchId, {
          home: pr.home_goals,
          away: pr.away_goals,
        });
      }
    }
    if (preds.size > 0) players.push({ profile, preds });
  }

  const matchRef = (m: Match): MatchRef => ({
    id: m.id,
    homeTla: m.homeTeam?.tla || "???",
    homeCrest: m.homeTeam?.crest ?? null,
    awayTla: m.awayTeam?.tla || "???",
    awayCrest: m.awayTeam?.crest ?? null,
    homeScore: m.score.fullTime.home,
    awayScore: m.score.fullTime.away,
  });

  const summary: DailySummary = {
    dayKey,
    dayLabel: formatDayLabel(dayKey),
    matches: dayMatches.map(matchRef),
    awards: [],
  };

  if (dayMatches.length === 0) return summary;

  // ---- Day delta math (score / rank / advance) -----------------------
  const kickoffs = dayMatches.map((m) => new Date(m.utcDate).getTime());
  const beforeAsOf = new Date(Math.min(...kickoffs) - 1);
  const afterAsOf = new Date(Math.max(...kickoffs));

  const before = computeAsOf(matches, scopedPredictions, beforeAsOf);
  const after = computeAsOf(matches, scopedPredictions, afterAsOf);

  const beforeTotals = new Map(
    [...before.entries()].map(([u, s]) => [u, s.total]),
  );
  const afterTotals = new Map([...after.entries()].map(([u, s]) => [u, s.total]));
  const rankBefore = rankByScore(beforeTotals);
  const rankAfter = rankByScore(afterTotals);

  // Helper: build winners from a per-user numeric map, taking the top tier
  // (everyone tied at the max), with an optional minimum and detail formatter.
  // Returns the FULL tied set (sorted by name); cross-award prioritization and
  // the final cutoff happen later in applyCrossAwardPriority().
  const topWinners = (
    values: Map<string, number>,
    opts: {
      min?: number;
      detail: (v: number, userId: string) => string;
    },
  ): AwardWinner[] => {
    let max = -Infinity;
    values.forEach((v) => {
      if (v > max) max = v;
    });
    if (!isFinite(max) || max < (opts.min ?? 1)) return [];
    const winners: AwardWinner[] = [];
    for (const [userId, v] of values.entries()) {
      if (v === max) {
        const { name, country } = nameOf(userId);
        winners.push({ userId, name, country, detail: opts.detail(v, userId) });
      }
    }
    winners.sort((a, b) => a.name.localeCompare(b.name));
    return winners;
  };

  // Helper: winners across the top (or bottom) N value tiers. Used for "top 3"
  // style awards (Biggest Climber, Fewest Points) where we want a short podium,
  // not just the single best tier. Ties within a tier are all included.
  const rankedTiers = (
    values: Map<string, number>,
    opts: {
      detail: (v: number, userId: string) => string;
      order: "desc" | "asc";
      maxTiers: number;
      eligible?: Set<string>;
      min?: number; // for "desc": only values >= min count
    },
  ): AwardWinner[] => {
    const entries = [...values.entries()].filter(
      ([u, v]) =>
        (!opts.eligible || opts.eligible.has(u)) &&
        (opts.order === "desc" ? v >= (opts.min ?? 1) : true),
    );
    if (entries.length === 0) return [];
    entries.sort((a, b) =>
      opts.order === "desc" ? b[1] - a[1] : a[1] - b[1],
    );
    // Distinct values, in tier order, capped at maxTiers.
    const tierValues: number[] = [];
    for (const [, v] of entries) {
      if (!tierValues.includes(v)) {
        tierValues.push(v);
        if (tierValues.length >= opts.maxTiers) break;
      }
    }
    const tierSet = new Set(tierValues);
    const winners: AwardWinner[] = [];
    for (const [userId, v] of entries) {
      if (tierSet.has(v)) {
        const { name, country } = nameOf(userId);
        winners.push({ userId, name, country, detail: opts.detail(v, userId) });
      }
    }
    return winners;
  };

  // The "20% rule": several awards scale to the group size. A scoreline is
  // "rare" / a podium is "deep" when it involves no more than 20% of the
  // participating group. Floored (10 players → 2, 30 → 6) but never below 1.
  const groupCutoff = Math.max(1, Math.floor(players.length * 0.2));

  // 1. Day MVP — most points earned that day.
  const dayPoints = new Map<string, number>();
  for (const userId of afterTotals.keys()) {
    dayPoints.set(
      userId,
      (afterTotals.get(userId) ?? 0) - (beforeTotals.get(userId) ?? 0),
    );
  }
  const mvp = topWinners(dayPoints, {
    min: 1,
    detail: (v) => `+${v}`,
  });
  if (mvp.length > 0) {
    summary.awards.push({
      key: "day-mvp",
      emoji: "🏆",
      title: "Day MVP",
      subtitle: "Most points earned today",
      winners: mvp,
    });
  }

  // Day participants — players who predicted at least one of the day's matches.
  // Used so "Fewest Points" only ranks people who actually played that day.
  const dayMatchIds = new Set(dayMatches.map((m) => m.id));
  const dayParticipants = new Set<string>();
  for (const { profile, preds } of players) {
    for (const id of dayMatchIds) {
      if (preds.has(id)) {
        dayParticipants.add(profile.id);
        break;
      }
    }
  }

  // 1b. Fewest Points — bottom tiers (depth scales to 20% of the group, among
  // players who predicted today).
  const fewest = rankedTiers(dayPoints, {
    order: "asc",
    maxTiers: groupCutoff,
    eligible: dayParticipants,
    detail: (v) => `+${v}`,
  });
  if (fewest.length > 0) {
    summary.awards.push({
      key: "fewest-points",
      emoji: "🥶",
      title: "Quiet Day",
      subtitle: "Fewest points among today's players",
      winners: fewest,
    });
  }

  // 2. Biggest Climber — top climbers (depth scales to 20% of the group),
  // showing both positions gained and points added that day.
  const climb = new Map<string, number>();
  for (const userId of afterTotals.keys()) {
    const rb = rankBefore.get(userId);
    const ra = rankAfter.get(userId);
    if (rb != null && ra != null) climb.set(userId, rb - ra);
  }
  const climbers = rankedTiers(climb, {
    order: "desc",
    maxTiers: groupCutoff,
    min: 1,
    detail: (_v, userId) =>
      `${ordinal(rankBefore.get(userId)!)}→${ordinal(rankAfter.get(userId)!)} · +${dayPoints.get(userId) ?? 0} pts`,
  });
  if (climbers.length > 0) {
    summary.awards.push({
      key: "biggest-climber",
      emoji: "🚀",
      title: "Biggest Climber",
      subtitle: "Most positions gained today",
      winners: climbers,
    });
  }

  // 3. Sharpshooter — most correct results among the day's matches.
  const correctResults = new Map<string, number>();
  for (const { profile, preds } of players) {
    let n = 0;
    for (const m of dayMatches) {
      const p = preds.get(m.id);
      const actual = getMatchResult(m);
      if (p && actual && getPredictionResult(p.home, p.away) === actual) n++;
    }
    correctResults.set(profile.id, n);
  }
  const sharpshooters = topWinners(correctResults, {
    min: 1,
    detail: (v) => `${v} correct`,
  });
  if (sharpshooters.length > 0) {
    summary.awards.push({
      key: "sharpshooter",
      emoji: "🔫",
      title: "Sharpshooter",
      subtitle: "Most correct results today",
      winners: sharpshooters,
    });
  }

  // ---- Per-match analysis (correct predictors per match) -------------
  const loneWolf: AwardWinner[] = [];
  const rareBullseye: AwardWinner[] = [];
  const againstGrain: AwardWinner[] = [];

  for (const m of dayMatches) {
    const actual = getMatchResult(m);
    if (!actual) continue;

    // Players who predicted THIS match.
    const predictors = players.filter(({ preds }) => preds.has(m.id));
    const predictorCount = predictors.length;
    if (predictorCount === 0) continue;

    // Correct-result predictors.
    const correct = predictors.filter(({ preds }) => {
      const p = preds.get(m.id)!;
      return getPredictionResult(p.home, p.away) === actual;
    });

    // Lone Wolf: exactly one correct.
    if (correct.length === 1) {
      const { profile } = correct[0];
      const { name, country } = nameOf(profile.id);
      loneWolf.push({
        userId: profile.id,
        name,
        country,
        match: matchRef(m),
      });
    }

    // Against the Grain (per match): a small pack (2+) called the result right
    // while still rare — no more than the group's 20% cutoff. The lone case is
    // already covered by Lone Wolf, so require at least two here.
    if (correct.length >= 2 && correct.length <= groupCutoff) {
      for (const { profile } of correct) {
        const { name, country } = nameOf(profile.id);
        againstGrain.push({
          userId: profile.id,
          name,
          country,
          match: matchRef(m),
        });
      }
    }

    // Rare Bullseye: exact score nailed by ≤ 20% of the group (and ≥ 1).
    const exact = predictors.filter(({ preds }) => {
      const p = preds.get(m.id)!;
      return (
        p.home === m.score.fullTime.home && p.away === m.score.fullTime.away
      );
    });
    if (exact.length >= 1 && exact.length <= groupCutoff) {
      for (const { profile } of exact) {
        const { name, country } = nameOf(profile.id);
        rareBullseye.push({
          userId: profile.id,
          name,
          country,
          match: matchRef(m),
        });
      }
    }
  }

  // 6. Lone Wolf.
  if (loneWolf.length > 0) {
    summary.awards.push({
      key: "lone-wolf",
      emoji: "🦄",
      title: "Lone Wolf",
      subtitle: "Only one to call the result",
      winners: loneWolf,
    });
  }

  // 7. Exact Score — exact scoreline nailed by ≤20% of the group, by match.
  if (rareBullseye.length > 0) {
    summary.awards.push({
      key: "rare-bullseye",
      emoji: "🎯",
      title: "Exact Score",
      subtitle: `Exact scoreline nailed by ${groupCutoff} or fewer`,
      winners: rareBullseye,
    });
  }

  // 8. Against the Grain — per match, the minority who called the result right.
  if (againstGrain.length > 0) {
    summary.awards.push({
      key: "against-the-grain",
      emoji: "🎲",
      title: "Against the Grain",
      subtitle: "The few who called the result right",
      winners: againstGrain,
    });
  }

  // 9. Oracle — most teams whose advancement was decided today. Show the flags
  // of the teams each player correctly tipped to advance (newly decided today),
  // not just a count.
  const advancedToday = new Map<string, number>();
  const advancedTeams = new Map<string, TeamRef[]>();
  for (const userId of after.keys()) {
    const beforeTlas = new Set(
      (before.get(userId)?.advanceTeams ?? []).map((t) => t.tla),
    );
    const newly = (after.get(userId)?.advanceTeams ?? []).filter(
      (t) => !beforeTlas.has(t.tla),
    );
    advancedToday.set(userId, newly.length);
    advancedTeams.set(userId, newly);
  }
  const oracles = topWinners(advancedToday, {
    min: 1,
    detail: () => "",
  }).map((w) => ({
    userId: w.userId,
    name: w.name,
    country: w.country,
    teams: advancedTeams.get(w.userId) ?? [],
  }));
  if (oracles.length > 0) {
    summary.awards.push({
      key: "oracle",
      emoji: "🎫",
      title: "Oracle",
      subtitle: "Teams correctly tipped to advance today",
      winners: oracles,
    });
  }

  // Cross-award prioritization: when a tie has more winners than we display,
  // keep the players who feature across MULTIPLE awards (the day's standouts)
  // rather than cutting alphabetically. We count how many distinct awards each
  // player appears in, then order every award's winners by that frequency before
  // applying the per-award cap.
  applyCrossAwardPriority(summary.awards, groupCutoff);

  return summary;
}

/** Per-match awards list every qualifier (grouped by match), capped higher. */
const PER_MATCH_AWARDS = new Set([
  "lone-wolf",
  "rare-bullseye",
  "against-the-grain",
]);

function applyCrossAwardPriority(awards: DailyAward[], topCap: number): void {
  // How many distinct awards each player appears in.
  const appearances = new Map<string, number>();
  for (const award of awards) {
    const seen = new Set<string>();
    for (const w of award.winners) {
      if (seen.has(w.userId)) continue;
      seen.add(w.userId);
      appearances.set(w.userId, (appearances.get(w.userId) ?? 0) + 1);
    }
  }

  for (const award of awards) {
    // Stable sort: multi-table players first, then alphabetical. All winners in
    // an award share the same stat value (a tie), so this only re-prioritizes
    // who survives the cutoff — it never reorders by a different metric value.
    award.winners.sort((a, b) => {
      const fa = appearances.get(a.userId) ?? 0;
      const fb = appearances.get(b.userId) ?? 0;
      if (fb !== fa) return fb - fa;
      return a.name.localeCompare(b.name);
    });
    const cap = PER_MATCH_AWARDS.has(award.key)
      ? MAX_PER_MATCH_WINNERS
      : topCap;
    award.winners = award.winners.slice(0, cap);
  }
}
