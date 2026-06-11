/**
 * Pure utility functions for Match objects.
 * Safe for client-side use — no server-only imports.
 */
import { Match } from "@/types/football";

export function getGroupMatches(matches: Match[]): Map<string, Match[]> {
  const groupMatches = new Map<string, Match[]>();

  matches
    .filter((match) => match.stage === "GROUP_STAGE" && match.group)
    .forEach((match) => {
      const group = match.group!;
      if (!groupMatches.has(group)) {
        groupMatches.set(group, []);
      }
      groupMatches.get(group)!.push(match);
    });

  return groupMatches;
}

export function getKnockoutMatches(matches: Match[]): Map<string, Match[]> {
  const knockoutStages = [
    "LAST_32",
    "LAST_16",
    "QUARTER_FINALS",
    "SEMI_FINALS",
    "THIRD_PLACE",
    "FINAL",
  ];

  const knockoutMatches = new Map<string, Match[]>();

  knockoutStages.forEach((stage) => {
    knockoutMatches.set(stage, []);
  });

  matches
    .filter((match) => knockoutStages.includes(match.stage))
    .forEach((match) => {
      knockoutMatches.get(match.stage)!.push(match);
    });

  return knockoutMatches;
}

export function isGroupStageMatch(match: Match): boolean {
  return match.stage === "GROUP_STAGE";
}

export function isKnockoutMatch(match: Match): boolean {
  return !isGroupStageMatch(match);
}

export function getMatchResult(match: Match): "home" | "away" | "draw" | null {
  if (
    match.status !== "FINISHED" &&
    match.status !== "IN_PLAY" &&
    match.status !== "PAUSED"
  )
    return null;

  const homeGoals = match.score.fullTime.home;
  const awayGoals = match.score.fullTime.away;

  if (homeGoals === null || awayGoals === null) return null;

  if (homeGoals > awayGoals) return "home";
  if (awayGoals > homeGoals) return "away";
  return "draw";
}

export function getPredictionResult(
  homeGoals: number,
  awayGoals: number,
): "home" | "away" | "draw" {
  if (homeGoals > awayGoals) return "home";
  if (awayGoals > homeGoals) return "away";
  return "draw";
}
