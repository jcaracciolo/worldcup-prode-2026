import type { LiveDataProvider, LiveMatchData } from "./types";
import { API_FOOTBALL_STATUS_MAP, ProviderRateLimitError, ProviderError } from "./types";

const API_BASE = "https://v3.football.api-sports.io";

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
 * Free tier: 100 requests/day, 10 requests/minute.
 *
 * Supports multiple instances with different API keys to increase quota.
 */
export class ApiFootballProvider implements LiveDataProvider {
  readonly name: string;
  readonly priority: number;
  private readonly apiKey: string;

  constructor(apiKey: string, instanceId: number = 1) {
    this.apiKey = apiKey;
    this.name = instanceId === 1 ? "api-football" : `api-football-${instanceId}`;
    this.priority = 10 + instanceId - 1; // 10, 11, 12, ...
  }

  async fetchLiveMatches(): Promise<LiveMatchData[]> {
    const today = new Date().toISOString().slice(0, 10);
    const url = `${API_BASE}/fixtures?date=${today}`;

    const response = await fetch(url, {
      headers: { "x-apisports-key": this.apiKey },
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
      if (errorMsg.toLowerCase().includes("rate limit")) {
        throw new ProviderRateLimitError(this.name, 60);
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
