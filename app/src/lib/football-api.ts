import {
  Match,
  MatchesResponse,
  StandingsResponse,
  TeamsResponse,
} from "@/types/football";

const API_BASE_URL = "https://api.football-data.org/v4";
const COMPETITION_CODE = "WC";

async function fetchFromAPI<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "X-Auth-Token": process.env.FOOTBALL_DATA_API_TOKEN!,
    },
    next: { revalidate: 60 }, // Cache for 60 seconds
  });

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

export async function getMatches(): Promise<Match[]> {
  const data = await fetchFromAPI<MatchesResponse>(
    `/competitions/${COMPETITION_CODE}/matches`,
  );
  return data.matches;
}

export async function getMatch(matchId: number): Promise<Match | null> {
  try {
    const data = await fetchFromAPI<Match>(`/matches/${matchId}`);
    return data;
  } catch {
    return null;
  }
}

export async function getStandings(): Promise<StandingsResponse> {
  return fetchFromAPI<StandingsResponse>(
    `/competitions/${COMPETITION_CODE}/standings`,
  );
}

export async function getTeams(): Promise<TeamsResponse> {
  return fetchFromAPI<TeamsResponse>(`/competitions/${COMPETITION_CODE}/teams`);
}

export async function getTodaysMatches(): Promise<Match[]> {
  const matches = await getMatches();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get today's matches
  let todaysMatches = matches.filter((match) => {
    const matchDate = new Date(match.utcDate);
    return matchDate >= today && matchDate < tomorrow;
  });

  // If no matches today, get nearest upcoming
  if (todaysMatches.length === 0) {
    const upcomingMatches = matches
      .filter((match) => new Date(match.utcDate) > today)
      .sort(
        (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
      );

    if (upcomingMatches.length > 0) {
      const nextMatchDate = new Date(upcomingMatches[0].utcDate);
      nextMatchDate.setHours(0, 0, 0, 0);
      const nextDayEnd = new Date(nextMatchDate);
      nextDayEnd.setDate(nextDayEnd.getDate() + 1);

      todaysMatches = upcomingMatches.filter((match) => {
        const matchDate = new Date(match.utcDate);
        return matchDate >= nextMatchDate && matchDate < nextDayEnd;
      });
    }
  }

  return todaysMatches;
}

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
  if (match.status !== "FINISHED") return null;

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
