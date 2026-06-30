/**
 * Stat tables — per-player tournament metrics (exact scores, correct results,
 * teams passed, single guesses, …), each ranked into a mini-leaderboard showing
 * the top 3 plus the current user's standing "as if the table were completed".
 *
 * Simulation-consistent: only matches finished by `now` count.
 */

import { Match, FifaMatchId } from "@/types/football";
import { getMatchResult, getPredictionResult } from "./match-utils";
import { calculateTotalPoints } from "./scoring";
import { LiveBracketResolver } from "./live-bracket-resolver";
import { AllPredictions, snapshotMatchesAsOf } from "./score-timeline";

export interface StatRow {
  userId: string;
  name: string;
  country: string | null;
  value: number;
  /** Percentage of the opportunities this metric measures (0–100), or null. */
  pct: number | null;
  /** 1-based rank within this stat (ties share a rank). */
  rank: number;
}

export interface StatTable {
  key: string;
  title: string;
  description: string;
  emoji: string;
  /** Top 3 players for this stat. */
  top: StatRow[];
  /** The 4th-ranked player (shown when the current user is already in the top 3). */
  fourth: StatRow | null;
  /** The current user's row (may be outside the top 3); null if not a player. */
  you: StatRow | null;
  /** Full ranked list of all players (for the expanded "see more" view). */
  all: StatRow[];
  /** Total number of ranked players (denominator for "X of N"). */
  totalPlayers: number;
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

interface MetricContext {
  players: PlayerData[];
  /** Matches finished as of `now`. */
  finished: Match[];
  /** Full match list (for engine-based metrics). */
  matches: Match[];
  allPredictions: AllPredictions;
  now: Date;
  /** Per-player count of finished matches that player actually predicted. */
  predictedFinished: Map<string, number>;
}

interface MetricDef {
  key: string;
  title: string;
  description: string;
  emoji: string;
  /** Compute a value for every player (keyed by userId). */
  computeAll: (ctx: MetricContext) => Map<string, number>;
  /**
   * Denominator for the percentage, per player. Return a single number to use
   * the same denominator for everyone. Defaults to the player's predicted
   * finished-match count.
   */
  denomAll?: (ctx: MetricContext) => Map<string, number> | number;
}

/** Helper: per-player count from a finished-match predicate. */
function countPerPlayer(
  ctx: MetricContext,
  predicate: (p: { home: number; away: number }, m: Match) => boolean,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const { profile, preds } of ctx.players) {
    let n = 0;
    for (const m of ctx.finished) {
      const p = preds.get(m.id);
      if (p && predicate(p, m)) n++;
    }
    out.set(profile.id, n);
  }
  return out;
}

/**
 * Total number of teams that have actually advanced so far: top 2 of every
 * completed group, plus each completed group's best-third once ALL groups are
 * complete (mirrors the scoring engine's advancing-team logic). This is the max
 * a perfect predictor could have in "Teams Passed".
 */
function countAdvancedSlots(ctx: MetricContext): number {
  const snapshot = snapshotMatchesAsOf(ctx.matches, ctx.now);
  const liveBracket = new LiveBracketResolver(snapshot).resolve();

  // Group completeness (all of a group's matches finished as of now).
  const groupTotals = new Map<string, { total: number; finished: number }>();
  for (const m of ctx.matches) {
    if (m.stage !== "GROUP_STAGE" || !m.group) continue;
    const e = groupTotals.get(m.group) ?? { total: 0, finished: 0 };
    e.total += 1;
    if (
      m.status === "FINISHED" &&
      m.score.fullTime.home !== null &&
      new Date(m.utcDate).getTime() <= ctx.now.getTime()
    ) {
      e.finished += 1;
    }
    groupTotals.set(m.group, e);
  }
  const isComplete = (g: string) => {
    const e = groupTotals.get(g);
    return !!e && e.total > 0 && e.finished === e.total;
  };
  const allGroupsComplete =
    groupTotals.size > 0 &&
    [...groupTotals.keys()].every((g) => isComplete(g));

  let slots = 0;
  liveBracket.groupStandings.forEach((standings, group) => {
    if (!isComplete(group)) return;
    slots += Math.min(2, standings.length);
    if (allGroupsComplete && liveBracket.thirdPlaceQualifying.get(group)) {
      slots += 1;
    }
  });
  return slots;
}

const METRICS: MetricDef[] = [
  {
    key: "correct-results",
    title: "Correct Results",
    description: "Matches with the right outcome (win / draw / loss)",
    emoji: "✅",
    computeAll: (ctx) =>
      countPerPlayer(ctx, (p, m) => {
        const actual = getMatchResult(m);
        return !!actual && getPredictionResult(p.home, p.away) === actual;
      }),
  },
  {
    key: "wrong-results",
    title: "Wrong Results",
    description: "Matches where you called the wrong outcome",
    emoji: "❌",
    computeAll: (ctx) =>
      countPerPlayer(ctx, (p, m) => {
        const actual = getMatchResult(m);
        return !!actual && getPredictionResult(p.home, p.away) !== actual;
      }),
  },
  {
    key: "exact-scores",
    title: "Exact Scores",
    description: "Matches predicted perfectly (both teams' goals)",
    emoji: "🎯",
    computeAll: (ctx) =>
      countPerPlayer(
        ctx,
        (p, m) =>
          p.home === m.score.fullTime.home && p.away === m.score.fullTime.away,
      ),
  },
  {
    key: "correct-goals",
    title: "Correct Goal Tallies",
    description: "Individual team scorelines guessed right (up to 2 per match)",
    emoji: "🥅",
    computeAll: (ctx) => {
      const out = new Map<string, number>();
      for (const { profile, preds } of ctx.players) {
        let n = 0;
        for (const m of ctx.finished) {
          const p = preds.get(m.id);
          if (!p) continue;
          if (p.home === m.score.fullTime.home) n++;
          if (p.away === m.score.fullTime.away) n++;
        }
        out.set(profile.id, n);
      }
      return out;
    },
    // Two goal tallies per predicted finished match.
    denomAll: (ctx) => {
      const out = new Map<string, number>();
      ctx.predictedFinished.forEach((v, k) => out.set(k, v * 2));
      return out;
    },
  },
  {
    key: "teams-passed",
    title: "Teams Passed",
    description: "Teams you correctly tipped to reach the Round of 32",
    emoji: "🎫",
    computeAll: (ctx) => {
      const out = new Map<string, number>();
      // Snapshot the actual results to `now`, resolve the live bracket once.
      const snapshot = snapshotMatchesAsOf(ctx.matches, ctx.now);
      const withFifa = snapshot.map((m) => ({
        ...m,
        fifaNumber: m.id as FifaMatchId,
      }));
      const liveBracket = new LiveBracketResolver(snapshot).resolve();
      for (const { profile } of ctx.players) {
        const bundle = ctx.allPredictions.get(profile.id);
        if (!bundle) {
          out.set(profile.id, 0);
          continue;
        }
        const { breakdown } = calculateTotalPoints(
          withFifa,
          bundle.predictions,
          bundle.overrides ?? [],
          liveBracket,
          bundle.thirdPlaceOverrides ?? [],
        );
        out.set(
          profile.id,
          breakdown.filter((b) => b.type === "group_advance").length,
        );
      }
      return out;
    },
    // Denominator: total teams that have actually advanced so far (top 2 of each
    // completed group, plus best thirds once all groups are complete).
    denomAll: (ctx) => countAdvancedSlots(ctx),
  },
  {
    key: "single-guesses",
    title: "Single Guesses",
    description: "Matches where you were the only one to call the result",
    emoji: "🦄",
    computeAll: (ctx) => {
      const out = new Map<string, number>();
      for (const { profile } of ctx.players) out.set(profile.id, 0);
      for (const m of ctx.finished) {
        const actual = getMatchResult(m);
        if (!actual) continue;
        let soleUserId: string | null = null;
        let correctCount = 0;
        for (const { profile, preds } of ctx.players) {
          const p = preds.get(m.id);
          if (p && getPredictionResult(p.home, p.away) === actual) {
            correctCount++;
            soleUserId = profile.id;
            if (correctCount > 1) break;
          }
        }
        if (correctCount === 1 && soleUserId) {
          out.set(soleUserId, (out.get(soleUserId) ?? 0) + 1);
        }
      }
      return out;
    },
  },
];

/** A match counts toward stats once it has FINISHED and kicked off by `now`. */
function isFinishedAsOf(m: Match, now: Date): boolean {
  return (
    m.status === "FINISHED" &&
    m.score.fullTime.home !== null &&
    m.score.fullTime.away !== null &&
    new Date(m.utcDate).getTime() <= now.getTime()
  );
}

/** Rank rows by value descending; ties share a rank (1, 1, 3, …). */
function rank(rows: Omit<StatRow, "rank">[]): StatRow[] {
  const sorted = [...rows].sort(
    (a, b) => b.value - a.value || a.name.localeCompare(b.name),
  );
  let lastValue: number | null = null;
  let lastRank = 0;
  return sorted.map((r, i) => {
    const rk = lastValue !== null && r.value === lastValue ? lastRank : i + 1;
    lastValue = r.value;
    lastRank = rk;
    return { ...r, rank: rk };
  });
}

export function computeStatTables(
  matches: Match[],
  allPredictions: AllPredictions,
  profiles: Profile[],
  currentUserId: string | null,
  now: Date,
): StatTable[] {
  const finished = matches.filter((m) => isFinishedAsOf(m, now));
  const finishedIds = new Set(finished.map((m) => m.id));

  // Players with at least one filled prediction, with a fast lookup map each.
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

  // Per-player: how many finished matches did they actually predict (the natural
  // denominator for per-match accuracy percentages).
  const predictedFinished = new Map<string, number>();
  for (const { profile, preds } of players) {
    let n = 0;
    preds.forEach((_v, id) => {
      if (finishedIds.has(id)) n++;
    });
    predictedFinished.set(profile.id, n);
  }

  const ctx: MetricContext = {
    players,
    finished,
    matches,
    allPredictions,
    now,
    predictedFinished,
  };

  return METRICS.map((metric) => {
    const values = metric.computeAll(ctx);
    const denomResult = metric.denomAll
      ? metric.denomAll(ctx)
      : predictedFinished;
    const denomFor = (userId: string): number =>
      typeof denomResult === "number"
        ? denomResult
        : (denomResult.get(userId) ?? 0);

    const ranked = rank(
      players.map(({ profile }) => {
        const value = values.get(profile.id) ?? 0;
        const denom = denomFor(profile.id);
        return {
          userId: profile.id,
          name: profile.display_name,
          country: profile.country,
          value,
          pct: denom > 0 ? Math.round((value / denom) * 100) : null,
        };
      }),
    );

    return {
      key: metric.key,
      title: metric.title,
      description: metric.description,
      emoji: metric.emoji,
      top: ranked.slice(0, 3),
      fourth: ranked[3] ?? null,
      you: currentUserId
        ? (ranked.find((r) => r.userId === currentUserId) ?? null)
        : null,
      all: ranked,
      totalPlayers: ranked.length,
    };
  });
}
