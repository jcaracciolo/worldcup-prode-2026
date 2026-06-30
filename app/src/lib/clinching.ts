// Mathematical clinching for group standings.
//
// Determines whether a team's FINAL group position is already mathematically
// locked, given the matches played so far and the remaining fixtures — so the
// live bracket can fill 1st/2nd-place R32 slots before a group is finished.
//
// Approach: enumerate every remaining match at win/draw/loss granularity
// (<= 3^R, R<=6). In each scenario, points are fixed; ties are resolved using
// the FIFA 2026 ladder ONLY as far as already-played matches determine it:
//   - head-to-head POINTS are always determined (they need only W/D/L);
//   - head-to-head GD/goals and overall GD/goals count only when the relevant
//     matches are already played (their goals are known).
// Anything that would depend on an unplayed match's scoreline is treated as
// order-uncertain. A position is "clinched" iff it is the SAME exact rank in
// every scenario. This is sound (never claims a clinch a real result could
// overturn) and resolves ties that are already decided head-to-head.

import { Match, Team } from "@/types/football";

interface PlayedResult {
  homeId: number;
  awayId: number;
  homeGoals: number;
  awayGoals: number;
}
interface RemainingMatch {
  homeId: number;
  awayId: number;
}

type Outcome = "home" | "draw" | "away";

function isValidTeam(team: Team | null | undefined): team is Team {
  return !!team && team.id !== null && team.id !== undefined;
}

/** Points for a single match result from the perspective of (home, away). */
function pointsFor(homeGoals: number, awayGoals: number): [number, number] {
  if (homeGoals > awayGoals) return [3, 0];
  if (awayGoals > homeGoals) return [0, 3];
  return [1, 1];
}

/** Head-to-head points among `teamIds`, from played results + a scenario's W/D/L. */
function h2hPoints(
  teamIds: number[],
  played: PlayedResult[],
  remaining: RemainingMatch[],
  outcomes: Outcome[],
): Map<number, number> {
  const inSet = new Set(teamIds);
  const pts = new Map<number, number>(teamIds.map((id) => [id, 0]));

  for (const r of played) {
    if (!inSet.has(r.homeId) || !inSet.has(r.awayId)) continue;
    const [h, a] = pointsFor(r.homeGoals, r.awayGoals);
    pts.set(r.homeId, pts.get(r.homeId)! + h);
    pts.set(r.awayId, pts.get(r.awayId)! + a);
  }
  remaining.forEach((m, i) => {
    if (!inSet.has(m.homeId) || !inSet.has(m.awayId)) return;
    const o = outcomes[i];
    const h = o === "home" ? 3 : o === "draw" ? 1 : 0;
    const a = o === "away" ? 3 : o === "draw" ? 1 : 0;
    pts.set(m.homeId, pts.get(m.homeId)! + h);
    pts.set(m.awayId, pts.get(m.awayId)! + a);
  });
  return pts;
}

/** Head-to-head {points, gd, gf} among `teamIds` from PLAYED matches only. */
function h2hFull(
  teamIds: number[],
  played: PlayedResult[],
): Map<number, { points: number; gd: number; gf: number }> {
  const inSet = new Set(teamIds);
  const rec = new Map(
    teamIds.map((id) => [id, { points: 0, gd: 0, gf: 0 }]),
  );
  for (const r of played) {
    if (!inSet.has(r.homeId) || !inSet.has(r.awayId)) continue;
    const home = rec.get(r.homeId)!;
    const away = rec.get(r.awayId)!;
    home.gf += r.homeGoals;
    away.gf += r.awayGoals;
    home.gd += r.homeGoals - r.awayGoals;
    away.gd += r.awayGoals - r.homeGoals;
    const [h, a] = pointsFor(r.homeGoals, r.awayGoals);
    home.points += h;
    away.points += a;
  }
  return rec;
}

/** Overall {gd, gf} from PLAYED matches only (used when teams have none remaining). */
function overallFull(
  teamIds: number[],
  played: PlayedResult[],
): Map<number, { gd: number; gf: number }> {
  const inSet = new Set(teamIds);
  const rec = new Map(teamIds.map((id) => [id, { gd: 0, gf: 0 }]));
  for (const r of played) {
    if (inSet.has(r.homeId)) {
      const t = rec.get(r.homeId)!;
      t.gd += r.homeGoals - r.awayGoals;
      t.gf += r.homeGoals;
    }
    if (inSet.has(r.awayId)) {
      const t = rec.get(r.awayId)!;
      t.gd += r.awayGoals - r.homeGoals;
      t.gf += r.awayGoals;
    }
  }
  return rec;
}

function groupByEqual<T>(items: T[], key: (i: T) => string): T[][] {
  const runs: T[][] = [];
  for (const item of items) {
    const last = runs[runs.length - 1];
    if (last && key(last[0]) === key(item)) last.push(item);
    else runs.push([item]);
  }
  return runs;
}

function hasUnplayedIntra(ids: number[], remaining: RemainingMatch[]): boolean {
  const s = new Set(ids);
  return remaining.some((m) => s.has(m.homeId) && s.has(m.awayId));
}
function anyHasRemaining(ids: number[], remaining: RemainingMatch[]): boolean {
  const s = new Set(ids);
  return remaining.some((m) => s.has(m.homeId) || s.has(m.awayId));
}

/**
 * Resolve a set of teams that are level on POINTS into ordered "blocks"
 * (best→worst). A block with >1 team is order-UNCERTAIN (its internal order
 * depends on an unplayed scoreline). Mirrors the FIFA 2026 head-to-head ladder
 * but only advances while the criterion is determined by already-played matches.
 */
function resolveTie(
  ids: number[],
  played: PlayedResult[],
  remaining: RemainingMatch[],
  outcomes: Outcome[],
): number[][] {
  if (ids.length <= 1) return [ids];

  // Head-to-head points are always determined (need only W/D/L).
  const pts = h2hPoints(ids, played, remaining, outcomes);

  if (hasUnplayedIntra(ids, remaining)) {
    // GD/goals among the set are NOT determined → can only separate by H2H points.
    const sorted = [...ids].sort((a, b) => pts.get(b)! - pts.get(a)!);
    return groupByEqual(sorted, (id) => `${pts.get(id)}`).map((sub) => sub);
  }

  // All intra-set matches played → H2H GD/goals are determined.
  const rec = h2hFull(ids, played);
  const sorted = [...ids].sort(
    (a, b) =>
      rec.get(b)!.points - rec.get(a)!.points ||
      rec.get(b)!.gd - rec.get(a)!.gd ||
      rec.get(b)!.gf - rec.get(a)!.gf,
  );
  const buckets = groupByEqual(
    sorted,
    (id) => `${rec.get(id)!.points}|${rec.get(id)!.gd}|${rec.get(id)!.gf}`,
  );

  if (buckets.length === 1) {
    // Head-to-head cannot separate them at all → overall GD/goals.
    if (anyHasRemaining(ids, remaining)) return [ids]; // undetermined → uncertain
    const ov = overallFull(ids, played);
    return [...ids]
      .sort(
        (a, b) =>
          ov.get(b)!.gd - ov.get(a)!.gd ||
          ov.get(b)!.gf - ov.get(a)!.gf ||
          a - b, // deterministic stand-in for fair play / lots
      )
      .map((id) => [id]);
  }

  // Re-apply the procedure to any still-tied (strictly smaller) subset.
  const blocks: number[][] = [];
  for (const bucket of buckets) {
    if (bucket.length === 1) blocks.push(bucket);
    else blocks.push(...resolveTie(bucket, played, remaining, outcomes));
  }
  return blocks;
}

/** Best/worst possible final rank (1-indexed) of `teamId` in one scenario. */
function rankRange(
  teamId: number,
  teamIds: number[],
  points: Map<number, number>,
  played: PlayedResult[],
  remaining: RemainingMatch[],
  outcomes: Outcome[],
): [number, number] {
  const pT = points.get(teamId)!;
  const above = teamIds.filter((x) => points.get(x)! > pT).length;
  const bucket = teamIds.filter((x) => points.get(x)! === pT);
  if (bucket.length === 1) return [above + 1, above + 1];

  const blocks = resolveTie(bucket, played, remaining, outcomes);
  let before = 0;
  for (const block of blocks) {
    if (block.includes(teamId)) {
      return [above + before + 1, above + before + block.length];
    }
    before += block.length;
  }
  // Unreachable, but keep types happy.
  return [above + 1, above + bucket.length];
}

/** Generate all win/draw/loss combinations for the remaining matches. */
function* enumerateOutcomes(count: number): Generator<Outcome[]> {
  const opts: Outcome[] = ["home", "draw", "away"];
  const total = 3 ** count;
  for (let n = 0; n < total; n++) {
    const combo: Outcome[] = [];
    let x = n;
    for (let i = 0; i < count; i++) {
      combo.push(opts[x % 3]);
      x = Math.floor(x / 3);
    }
    yield combo;
  }
}

/**
 * Returns the positions (1-indexed) that are mathematically clinched to a
 * specific team in this group, mapped to that team. Only positions whose exact
 * rank is identical across EVERY remaining-result scenario are included.
 *
 * Empty when the group hasn't started or nothing is locked. Safe to call on a
 * finished group (returns the final positions), though the live resolver uses
 * its own complete-group path then.
 */
export function getClinchedPositions(groupMatches: Match[]): Map<number, Team> {
  const teamsById = new Map<number, Team>();
  for (const m of groupMatches) {
    if (isValidTeam(m.homeTeam)) teamsById.set(m.homeTeam.id, m.homeTeam);
    if (isValidTeam(m.awayTeam)) teamsById.set(m.awayTeam.id, m.awayTeam);
  }
  const teamIds = [...teamsById.keys()];
  if (teamIds.length === 0) return new Map();

  const played: PlayedResult[] = [];
  const remaining: RemainingMatch[] = [];
  for (const m of groupMatches) {
    if (!isValidTeam(m.homeTeam) || !isValidTeam(m.awayTeam)) continue;
    const hg = m.score?.fullTime?.home;
    const ag = m.score?.fullTime?.away;
    if (m.status === "FINISHED" && hg !== null && hg !== undefined && ag !== null && ag !== undefined) {
      played.push({ homeId: m.homeTeam.id, awayId: m.awayTeam.id, homeGoals: hg, awayGoals: ag });
    } else {
      remaining.push({ homeId: m.homeTeam.id, awayId: m.awayTeam.id });
    }
  }

  // Nothing played yet → nothing can be clinched.
  if (played.length === 0) return new Map();

  // Base points from played matches (added to per-scenario later).
  const basePoints = new Map<number, number>(teamIds.map((id) => [id, 0]));
  for (const r of played) {
    const [h, a] = pointsFor(r.homeGoals, r.awayGoals);
    basePoints.set(r.homeId, basePoints.get(r.homeId)! + h);
    basePoints.set(r.awayId, basePoints.get(r.awayId)! + a);
  }

  // For each team, the exact clinched rank, or null if not (yet) clinched.
  const clinchedRank = new Map<number, number | null>(
    teamIds.map((id) => [id, undefined as unknown as number | null]),
  );

  for (const outcomes of enumerateOutcomes(remaining.length)) {
    // Points for this scenario.
    const points = new Map(basePoints);
    remaining.forEach((m, i) => {
      const o = outcomes[i];
      const h = o === "home" ? 3 : o === "draw" ? 1 : 0;
      const a = o === "away" ? 3 : o === "draw" ? 1 : 0;
      points.set(m.homeId, points.get(m.homeId)! + h);
      points.set(m.awayId, points.get(m.awayId)! + a);
    });

    for (const id of teamIds) {
      if (clinchedRank.get(id) === null) continue; // already disqualified
      const [best, worst] = rankRange(id, teamIds, points, played, remaining, outcomes);
      const prev = clinchedRank.get(id);
      if (best !== worst) {
        clinchedRank.set(id, null);
      } else if (prev === undefined) {
        clinchedRank.set(id, best);
      } else if (prev !== best) {
        clinchedRank.set(id, null);
      }
    }
  }

  const result = new Map<number, Team>();
  for (const id of teamIds) {
    const rank = clinchedRank.get(id);
    if (rank != null) result.set(rank, teamsById.get(id)!);
  }
  return result;
}
