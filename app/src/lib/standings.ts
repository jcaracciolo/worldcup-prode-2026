/**
 * Standings Calculation Utilities
 *
 * Functions to calculate group standings from predictions or actual results.
 * Used by user profile page and scoring context.
 */

import { Match, CalculatedStanding } from "@/types/football";
import { LocalPrediction } from "@/types/database";

/**
 * Calculate standings from user predictions
 * @param groupMatches - matches in the group (match.id = FIFA match number)
 * @param predictionMap - predictions keyed by FIFA match number
 */
export function calculateStandingsFromPredictions(
  groupMatches: Match[],
  predictionMap: Map<number, LocalPrediction>,
): CalculatedStanding[] {
  const teamStats = new Map<number, CalculatedStanding>();
  const results: MatchResult[] = [];

  // Initialize all teams
  groupMatches.forEach((match) => {
    if (!teamStats.has(match.homeTeam.id)) {
      teamStats.set(match.homeTeam.id, {
        team: match.homeTeam,
        position: 0,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
      });
    }
    if (!teamStats.has(match.awayTeam.id)) {
      teamStats.set(match.awayTeam.id, {
        team: match.awayTeam,
        position: 0,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
      });
    }
  });

  // Apply predictions
  groupMatches.forEach((match) => {
    // match.id is the FIFA number - use directly as lookup key
    const prediction = predictionMap.get(match.id);
    if (
      !prediction ||
      prediction.home_goals === null ||
      prediction.away_goals === null
    )
      return;

    const homeStats = teamStats.get(match.homeTeam.id)!;
    const awayStats = teamStats.get(match.awayTeam.id)!;

    homeStats.played++;
    awayStats.played++;
    homeStats.goalsFor += prediction.home_goals;
    homeStats.goalsAgainst += prediction.away_goals;
    awayStats.goalsFor += prediction.away_goals;
    awayStats.goalsAgainst += prediction.home_goals;
    homeStats.goalDifference = homeStats.goalsFor - homeStats.goalsAgainst;
    awayStats.goalDifference = awayStats.goalsFor - awayStats.goalsAgainst;

    results.push({
      homeId: match.homeTeam.id,
      awayId: match.awayTeam.id,
      homeGoals: prediction.home_goals,
      awayGoals: prediction.away_goals,
    });

    if (prediction.home_goals > prediction.away_goals) {
      homeStats.won++;
      homeStats.points += 3;
      awayStats.lost++;
    } else if (prediction.away_goals > prediction.home_goals) {
      awayStats.won++;
      awayStats.points += 3;
      homeStats.lost++;
    } else {
      homeStats.drawn++;
      awayStats.drawn++;
      homeStats.points += 1;
      awayStats.points += 1;
    }
  });

  return sortStandings(Array.from(teamStats.values()), results);
}

/**
 * Check if a team is valid (has an ID - can be negative for placeholder teams)
 * TBD teams from the API are replaced with placeholder teams that have negative IDs
 */
function isValidTeam(team: Match["homeTeam"] | Match["awayTeam"]): boolean {
  return team && team.id !== null && team.id !== undefined;
}

/**
 * Calculate standings from actual match results
 * Includes placeholder teams (negative IDs) for TBD qualification slots
 */
export function calculateActualStandings(
  groupMatches: Match[],
): CalculatedStanding[] {
  const teamStats = new Map<number, CalculatedStanding>();
  const results: MatchResult[] = [];

  // Initialize all teams (skip null/TBD teams)
  groupMatches.forEach((match) => {
    if (isValidTeam(match.homeTeam) && !teamStats.has(match.homeTeam.id)) {
      teamStats.set(match.homeTeam.id, {
        team: match.homeTeam,
        position: 0,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
      });
    }
    if (isValidTeam(match.awayTeam) && !teamStats.has(match.awayTeam.id)) {
      teamStats.set(match.awayTeam.id, {
        team: match.awayTeam,
        position: 0,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
      });
    }
  });

  // Apply actual results (skip matches involving TBD teams)
  groupMatches.forEach((match) => {
    if (match.status !== "FINISHED") return;
    if (!isValidTeam(match.homeTeam) || !isValidTeam(match.awayTeam)) return;

    const homeGoals = match.score.fullTime.home;
    const awayGoals = match.score.fullTime.away;
    if (homeGoals === null || awayGoals === null) return;

    const homeStats = teamStats.get(match.homeTeam.id)!;
    const awayStats = teamStats.get(match.awayTeam.id)!;

    homeStats.played++;
    awayStats.played++;
    homeStats.goalsFor += homeGoals;
    homeStats.goalsAgainst += awayGoals;
    awayStats.goalsFor += awayGoals;
    awayStats.goalsAgainst += homeGoals;

    homeStats.goalDifference = homeStats.goalsFor - homeStats.goalsAgainst;
    awayStats.goalDifference = awayStats.goalsFor - awayStats.goalsAgainst;

    results.push({
      homeId: match.homeTeam.id,
      awayId: match.awayTeam.id,
      homeGoals,
      awayGoals,
    });

    if (homeGoals > awayGoals) {
      homeStats.won++;
      homeStats.points += 3;
      awayStats.lost++;
    } else if (awayGoals > homeGoals) {
      awayStats.won++;
      awayStats.points += 3;
      homeStats.lost++;
    } else {
      homeStats.drawn++;
      awayStats.drawn++;
      homeStats.points += 1;
      awayStats.points += 1;
    }
  });

  return sortStandings(Array.from(teamStats.values()), results);
}

/**
 * A single played match result, used to compute head-to-head sub-tables.
 */
interface MatchResult {
  homeId: number;
  awayId: number;
  homeGoals: number;
  awayGoals: number;
}

/** Aggregated head-to-head record among a tied subset of teams. */
interface H2HRecord {
  points: number;
  goalDifference: number;
  goalsFor: number;
}

/**
 * Compute a head-to-head mini-table among ONLY the given teams, using just the
 * matches played between those teams.
 */
function computeHeadToHead(
  teamIds: number[],
  results: MatchResult[],
): Map<number, H2HRecord> {
  const records = new Map<number, H2HRecord>();
  teamIds.forEach((id) =>
    records.set(id, { points: 0, goalDifference: 0, goalsFor: 0 }),
  );

  const inGroup = new Set(teamIds);
  for (const r of results) {
    if (!inGroup.has(r.homeId) || !inGroup.has(r.awayId)) continue;

    const home = records.get(r.homeId)!;
    const away = records.get(r.awayId)!;

    home.goalsFor += r.homeGoals;
    away.goalsFor += r.awayGoals;
    home.goalDifference += r.homeGoals - r.awayGoals;
    away.goalDifference += r.awayGoals - r.homeGoals;

    if (r.homeGoals > r.awayGoals) home.points += 3;
    else if (r.awayGoals > r.homeGoals) away.points += 3;
    else {
      home.points += 1;
      away.points += 1;
    }
  }

  return records;
}

/** Split an already-sorted list into runs whose key() values are all equal. */
function groupByEqual<T>(
  items: T[],
  key: (item: T) => string,
): T[][] {
  const runs: T[][] = [];
  for (const item of items) {
    const last = runs[runs.length - 1];
    if (last && key(last[0]) === key(item)) last.push(item);
    else runs.push([item]);
  }
  return runs;
}

/**
 * Break a tie among teams that are equal on the overall criteria
 * (points, goal difference, goals scored) using the FIFA head-to-head rules:
 *   d) points in matches between the tied teams
 *   e) goal difference in those matches
 *   f) goals scored in those matches
 * If a subset is still tied after head-to-head, the procedure is re-applied to
 * that smaller subset (re-computing the mini-table among only those teams), per
 * FIFA regulations. Fair-play points are not tracked, so the final fallback is
 * a deterministic ordering by team id (in place of drawing of lots).
 */
function breakTie(
  tied: CalculatedStanding[],
  results: MatchResult[],
): CalculatedStanding[] {
  if (tied.length <= 1) return tied;

  const h2h = computeHeadToHead(
    tied.map((s) => s.team.id),
    results,
  );

  const sorted = [...tied].sort((a, b) => {
    const ra = h2h.get(a.team.id)!;
    const rb = h2h.get(b.team.id)!;
    if (rb.points !== ra.points) return rb.points - ra.points;
    if (rb.goalDifference !== ra.goalDifference)
      return rb.goalDifference - ra.goalDifference;
    if (rb.goalsFor !== ra.goalsFor) return rb.goalsFor - ra.goalsFor;
    return a.team.id - b.team.id; // deterministic stand-in for drawing of lots
  });

  const h2hKey = (s: CalculatedStanding) => {
    const r = h2h.get(s.team.id)!;
    return `${r.points}|${r.goalDifference}|${r.goalsFor}`;
  };
  const buckets = groupByEqual(sorted, h2hKey);

  // Head-to-head produced no separation at all → use the deterministic fallback.
  if (buckets.length === 1) return sorted;

  // Otherwise re-apply the procedure to any still-tied (smaller) subset.
  const result: CalculatedStanding[] = [];
  for (const bucket of buckets) {
    if (bucket.length === 1) result.push(bucket[0]);
    else result.push(...breakTie(bucket, results));
  }
  return result;
}

/**
 * Rank a group's standings using the full FIFA tiebreaker hierarchy:
 *   a) points, b) goal difference, c) goals scored (all group matches), then
 *   d–f) head-to-head among teams still level (see breakTie).
 */
function sortStandings(
  standings: CalculatedStanding[],
  results: MatchResult[],
): CalculatedStanding[] {
  // Order by the overall criteria first.
  const sorted = [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference)
      return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });

  // Resolve any teams level on (points, GD, GF) via head-to-head.
  const overallKey = (s: CalculatedStanding) =>
    `${s.points}|${s.goalDifference}|${s.goalsFor}`;
  const ranked = groupByEqual(sorted, overallKey).flatMap((run) =>
    run.length === 1 ? run : breakTie(run, results),
  );

  return ranked.map((s, i) => ({ ...s, position: i + 1 }));
}

/**
 * Group matches by group name
 */
export function groupMatchesByGroup(matches: Match[]): Map<string, Match[]> {
  const groups = new Map<string, Match[]>();
  matches
    .filter((m) => m.stage === "GROUP_STAGE")
    .forEach((m) => {
      if (!m.group) return;
      if (!groups.has(m.group)) groups.set(m.group, []);
      groups.get(m.group)!.push(m);
    });
  return groups;
}

/**
 * Calculate all group standings from predictions
 */
export function calculateAllGroupStandings(
  matches: Match[],
  predictionMap: Map<number, LocalPrediction>,
): Map<string, CalculatedStanding[]> {
  const groups = groupMatchesByGroup(matches);
  const allStandings = new Map<string, CalculatedStanding[]>();

  groups.forEach((groupMatches, groupName) => {
    allStandings.set(
      groupName,
      calculateStandingsFromPredictions(groupMatches, predictionMap),
    );
  });

  return allStandings;
}

/**
 * Calculate all actual group standings
 */
export function calculateAllActualStandings(
  matches: Match[],
): Map<string, CalculatedStanding[]> {
  const groups = groupMatchesByGroup(matches);
  const allStandings = new Map<string, CalculatedStanding[]>();

  groups.forEach((groupMatches, groupName) => {
    allStandings.set(groupName, calculateActualStandings(groupMatches));
  });

  return allStandings;
}
