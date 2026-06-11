import type { LiveDataProvider, LiveMatchData } from "./types";
import { API_FOOTBALL_STATUS_MAP, ProviderRateLimitError, ProviderError } from "./types";

const API_BASE = "https://v3.football.api-sports.io";
const WORLD_CUP_LEAGUE_ID = 1;
const WORLD_CUP_SEASON = 2026;

// API-FOOTBALL response types (subset of what we need)
interface ApiFootballFixture {
  fixture: {
    id: number;
    date: string;
    status: {
      short: string;
      elapsed: number | null;
    };
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

interface ApiFootballResponse {
  response: ApiFootballFixture[];
  errors: Record<string, string>;
}

/**
 * Live data provider using API-FOOTBALL (api-sports.io).
 * Free tier: 100 requests/day. Fetches only live World Cup fixtures.
 */
export class ApiFootballProvider implements LiveDataProvider {
  readonly name = "api-football";
  readonly priority = 10;

  async fetchLiveMatches(): Promise<LiveMatchData[]> {
    const apiKey = process.env.API_FOOTBALL_KEY;
    if (!apiKey) {
      throw new ProviderError(this.name, "API_FOOTBALL_KEY not set");
    }

    // Use live=all to only get currently live fixtures (saves quota vs fetching all)
    const url = `${API_BASE}/fixtures?league=${WORLD_CUP_LEAGUE_ID}&season=${WORLD_CUP_SEASON}&live=all`;

    const response = await fetch(url, {
      headers: { "x-apisports-key": apiKey },
      cache: "no-store",
    });

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("Retry-After") || "900", 10);
      throw new ProviderRateLimitError(this.name, retryAfter);
    }

    if (!response.ok) {
      throw new ProviderError(
        this.name,
        `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    const data: ApiFootballResponse = await response.json();

    if (data.errors && Object.keys(data.errors).length > 0) {
      const errorMsg = Object.values(data.errors).join(", ");
      // Check for rate limit error in the response body
      if (errorMsg.toLowerCase().includes("rate limit")) {
        throw new ProviderRateLimitError(this.name, 900);
      }
      throw new ProviderError(this.name, errorMsg);
    }

    return data.response.map((fixture) => this.mapFixture(fixture));
  }

  private mapFixture(fixture: ApiFootballFixture): LiveMatchData {
    const statusShort = fixture.fixture.status.short;
    const status = API_FOOTBALL_STATUS_MAP[statusShort] || "TIMED";

    return {
      homeTeamName: fixture.teams.home.name,
      awayTeamName: fixture.teams.away.name,
      utcDate: fixture.fixture.date,
      status,
      homeGoals: fixture.goals.home,
      awayGoals: fixture.goals.away,
      elapsed: fixture.fixture.status.elapsed ?? undefined,
    };
  }
}
