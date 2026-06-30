import type { LiveDataProvider, LiveMatchData } from "./types";
import type { Match, MatchesResponse } from "@/types/football";
import { ProviderRateLimitError, ProviderError } from "./types";

const API_BASE_URL = "https://api.football-data.org/v4";
const COMPETITION_CODE = "WC";

/**
 * Live data provider backed by football-data.org.
 *
 * Reachable from the Azure datacenter (unlike worldcup26.ir) and free with
 * NO daily cap — only a 10 requests/minute rate limit. Live scores are
 * refreshed roughly every 1-2 minutes; the free tier does not expose the
 * live match minute, only the score and status.
 *
 * Registered as the lowest-priority fallback: used only when the fresher
 * providers (worldcup26, api-football) return nothing.
 */
export class FootballDataLiveProvider implements LiveDataProvider {
  readonly name = "football-data-live";
  readonly priority = 20; // Lowest priority — last-resort fallback

  async fetchLiveMatches(): Promise<LiveMatchData[]> {
    const token = process.env.FOOTBALL_DATA_API_TOKEN;
    if (!token) {
      throw new ProviderError(this.name, "FOOTBALL_DATA_API_TOKEN not set");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(
        `${API_BASE_URL}/competitions/${COMPETITION_CODE}/matches?status=IN_PLAY,PAUSED`,
        {
          headers: { "X-Auth-Token": token },
          cache: "no-store",
          signal: controller.signal,
        },
      );

      if (response.status === 429) {
        const retryAfter = parseInt(
          response.headers.get("Retry-After") || "60",
          10,
        );
        throw new ProviderRateLimitError(this.name, retryAfter);
      }

      if (!response.ok) {
        throw new ProviderError(
          this.name,
          `HTTP ${response.status}: ${response.statusText}`,
        );
      }

      const data: MatchesResponse = await response.json();
      return (data.matches || []).map((m) => this.mapMatch(m));
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapMatch(match: Match): LiveMatchData {
    // football-data.org is the source of our Match["status"] enum, so its
    // status values map directly — no translation needed.
    return {
      homeTeamName: match.homeTeam.name,
      awayTeamName: match.awayTeam.name,
      utcDate: match.utcDate,
      status: match.status,
      homeGoals: match.score.fullTime.home,
      awayGoals: match.score.fullTime.away,
    };
  }
}
