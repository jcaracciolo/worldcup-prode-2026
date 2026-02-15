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

  return sortStandings(Array.from(teamStats.values()));
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

  return sortStandings(Array.from(teamStats.values()));
}

/**
 * Sort standings by points, goal difference, goals for
 */
function sortStandings(standings: CalculatedStanding[]): CalculatedStanding[] {
  return standings
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference)
        return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    })
    .map((s, i) => ({ ...s, position: i + 1 }));
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
