import { FifaMatchId } from "@/types/football";
import { getMatchInfo } from "@/lib/tournament";

// City name to 3-letter abbreviation mapping
export const CITY_ABBREVIATIONS: Record<string, string> = {
  "Mexico City": "MXC",
  Miami: "MIA",
  Vancouver: "VAN",
  "New York": "NYC",
  "Los Angeles": "LAX",
  Dallas: "DAL",
  Houston: "HOU",
  Seattle: "SEA",
  "San Francisco": "SFO",
  Boston: "BOS",
  Monterrey: "MTY",
  Atlanta: "ATL",
  Philadelphia: "PHI",
  "Kansas City": "KAN",
  Toronto: "TOR",
  Guadalajara: "GDL",
};

export function formatMatchDate(utcDate: string): string {
  return new Date(utcDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatMatchTime(utcDate: string): string {
  return new Date(utcDate).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getVenueAbbreviation(city: string): string {
  return CITY_ABBREVIATIONS[city] || city.substring(0, 3).toUpperCase();
}

export function getVenueFromFifaNumber(fifaMatchNumber?: FifaMatchId) {
  if (!fifaMatchNumber) return null;
  const matchInfo = getMatchInfo(fifaMatchNumber);
  return matchInfo?.venue || null;
}
