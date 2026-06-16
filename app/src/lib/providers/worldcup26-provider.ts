import type { LiveDataProvider, LiveMatchData } from "./types";
import type { Match } from "@/types/football";
import { ProviderError } from "./types";

const API_BASE = "https://worldcup26.ir";

interface WC26Game {
  id: string;
  home_team_name_en: string;
  away_team_name_en: string;
  home_score: string;
  away_score: string;
  time_elapsed: string; // "notstarted" | "finished" | minute number | "HT"
  finished: string; // "TRUE" | "FALSE"
  local_date: string; // "MM/DD/YYYY HH:MM"
  type: string; // "group" | "round_of_32" etc.
}

interface WC26Response {
  games: WC26Game[];
}

/**
 * Live data provider using the free worldcup26.ir open-source API.
 * No API key required for read access. ~3s response time.
 * Provides real-time scores during live matches.
 */
export class WorldCup26Provider implements LiveDataProvider {
  readonly name = "worldcup26";
  readonly priority = 5; // Higher priority than API-FOOTBALL (tried first)

  async fetchLiveMatches(): Promise<LiveMatchData[]> {
    // worldcup26.ir is free but flaky (SSL drops, slow responses).
    // Retry transient failures here so we exhaust this free provider's
    // chances before falling through to the limited API-FOOTBALL quota.
    const MAX_ATTEMPTS = 3;
    const PER_ATTEMPT_TIMEOUT_MS = 6_000;

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        PER_ATTEMPT_TIMEOUT_MS,
      );

      try {
        const response = await fetch(`${API_BASE}/get/games`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new ProviderError(
            this.name,
            `HTTP ${response.status}: ${response.statusText}`,
          );
        }

        const data: WC26Response = await response.json();

        if (!data.games || !Array.isArray(data.games)) {
          throw new ProviderError(this.name, "Invalid response format");
        }

        return data.games
          .filter((g) => g.home_team_name_en && g.away_team_name_en)
          .map((game) => this.mapGame(game));
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[worldcup26] attempt ${attempt}/${MAX_ATTEMPTS} failed: ${message}`,
        );
        // Small backoff before retrying (skip after the last attempt)
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    const message =
      lastError instanceof Error ? lastError.message : String(lastError);
    throw new ProviderError(
      this.name,
      `all ${MAX_ATTEMPTS} attempts failed: ${message}`,
    );
  }

  private mapGame(game: WC26Game): LiveMatchData {
    const status = this.mapStatus(game);
    const homeGoals = this.parseScore(game.home_score);
    const awayGoals = this.parseScore(game.away_score);

    // Extract date from local_date "MM/DD/YYYY HH:MM" → "YYYY-MM-DD"
    const datePart = this.extractDateISO(game.local_date);

    return {
      homeTeamName: game.home_team_name_en,
      awayTeamName: game.away_team_name_en,
      utcDate: `${datePart}T00:00:00Z`, // Only date portion matters for matching
      status,
      homeGoals,
      awayGoals,
      elapsed: this.parseElapsed(game.time_elapsed),
    };
  }

  private mapStatus(game: WC26Game): Match["status"] {
    if (game.finished === "TRUE" || game.time_elapsed === "finished") {
      return "FINISHED";
    }

    const elapsed = game.time_elapsed?.toLowerCase();

    if (!elapsed || elapsed === "notstarted") {
      return "TIMED";
    }

    if (elapsed === "ht" || elapsed === "halftime" || elapsed === "break") {
      return "PAUSED";
    }

    // If it's a number (minutes), match is in play
    if (/^\d+/.test(elapsed)) {
      return "IN_PLAY";
    }

    // Fallback
    return "TIMED";
  }

  private parseScore(score: string): number | null {
    if (!score || score === "null" || score === "") return null;
    const n = parseInt(score, 10);
    return isNaN(n) ? null : n;
  }

  private parseElapsed(timeElapsed: string): number | undefined {
    if (!timeElapsed) return undefined;
    const n = parseInt(timeElapsed, 10);
    return isNaN(n) ? undefined : n;
  }

  private extractDateISO(localDate: string): string {
    // "MM/DD/YYYY HH:MM" → "YYYY-MM-DD"
    const parts = localDate.split(" ")[0]?.split("/");
    if (parts && parts.length === 3) {
      const [mm, dd, yyyy] = parts;
      return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }
    // Fallback to today
    return new Date().toISOString().slice(0, 10);
  }
}
