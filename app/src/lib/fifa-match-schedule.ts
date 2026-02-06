/**
 * FIFA Match Number Mapping for World Cup 2026 R32
 * 
 * Maps venue + date combinations to correct FIFA match numbers.
 * FIFA doesn't number matches strictly chronologically, so we need
 * to identify matches by their venue and date to ensure correct mapping.
 */

// R32 match schedule with FIFA numbers (official schedule)
// Format: { date (ISO): { venue keyword: FIFA match number } }
export const R32_MATCH_SCHEDULE: Record<string, Record<string, number>> = {
  // June 28
  "2026-06-28": {
    "inglewood": 73, // SoFi Stadium - 2A vs 2B
    "los angeles": 73,
    "sofi": 73,
  },
  // June 29
  "2026-06-29": {
    "foxborough": 74, // Gillette Stadium - 1E vs 3rd
    "boston": 74,
    "gillette": 74,
    "monterrey": 75, // Estadio BBVA - 1F vs 2C
    "guadalupe": 75,
    "bbva": 75,
    "houston": 76, // NRG Stadium - 1C vs 2F
    "nrg": 76,
  },
  // June 30
  "2026-06-30": {
    "east rutherford": 77, // MetLife Stadium - 1I vs 3rd
    "new york": 77,
    "new jersey": 77,
    "metlife": 77,
    "arlington": 78, // AT&T Stadium - 2E vs 2I
    "dallas": 78,
    "at&t": 78,
    "mexico city": 79, // Estadio Azteca - 1A vs 3rd
    "azteca": 79,
  },
  // July 1
  "2026-07-01": {
    "atlanta": 80, // Mercedes-Benz Stadium - 1L vs 3rd
    "mercedes-benz": 80,
    "santa clara": 81, // Levi's Stadium - 1D vs 3rd
    "san francisco": 81,
    "levi's": 81,
    "seattle": 82, // Lumen Field - 1G vs 3rd
    "lumen": 82,
  },
  // July 2
  "2026-07-02": {
    "toronto": 83, // BMO Field - 2K vs 2L
    "bmo": 83,
    "inglewood": 84, // SoFi Stadium - 1H vs 2J
    "los angeles": 84,
    "sofi": 84,
    "vancouver": 85, // BC Place - 1B vs 3rd
    "bc place": 85,
  },
  // July 3
  "2026-07-03": {
    "miami": 86, // Hard Rock Stadium - 1J vs 2H
    "hard rock": 86,
    "miami gardens": 86,
    "kansas city": 87, // Arrowhead Stadium - 1K vs 3rd
    "arrowhead": 87,
    "arlington": 88, // AT&T Stadium - 2D vs 2G
    "dallas": 88,
    "at&t": 88,
  },
};

/**
 * Get FIFA match number from a match date and venue
 * @param date Match date (UTC)
 * @param venueCity City name from venue
 * @param stadiumName Stadium name (optional, for disambiguation)
 * @returns FIFA match number or null if not found
 */
export function getFifaMatchNumberFromVenue(
  date: Date,
  venueCity: string,
  stadiumName?: string,
): number | null {
  const dateKey = date.toISOString().split("T")[0];
  const daySchedule = R32_MATCH_SCHEDULE[dateKey];
  
  if (!daySchedule) return null;
  
  const cityLower = venueCity.toLowerCase();
  const stadiumLower = stadiumName?.toLowerCase() || "";
  
  // Try exact city match first
  for (const [keyword, matchNumber] of Object.entries(daySchedule)) {
    if (cityLower.includes(keyword) || stadiumLower.includes(keyword)) {
      return matchNumber;
    }
  }
  
  return null;
}

// R16 match schedule (July 4-7)
export const R16_MATCH_SCHEDULE: Record<string, Record<string, number>> = {
  "2026-07-04": {
    "houston": 90, // NRG Stadium
    "nrg": 90,
    "philadelphia": 89, // Lincoln Financial Field
  },
  "2026-07-05": {
    "east rutherford": 91, // MetLife Stadium
    "new york": 91,
    "mexico city": 92, // Estadio Azteca
    "azteca": 92,
  },
  "2026-07-06": {
    "arlington": 93, // AT&T Stadium
    "dallas": 93,
    "seattle": 94, // Lumen Field
  },
  "2026-07-07": {
    "atlanta": 95, // Mercedes-Benz Stadium
    "vancouver": 96, // BC Place
  },
};

// QF match schedule (July 9-11)
export const QF_MATCH_SCHEDULE: Record<string, Record<string, number>> = {
  "2026-07-09": {
    "foxborough": 97, // Gillette Stadium
    "boston": 97,
  },
  "2026-07-10": {
    "inglewood": 98, // SoFi Stadium
    "los angeles": 98,
  },
  "2026-07-11": {
    "miami": 99, // Hard Rock Stadium
    "kansas city": 100, // Arrowhead Stadium
  },
};

// SF match schedule (July 14-15)
export const SF_MATCH_SCHEDULE: Record<string, Record<string, number>> = {
  "2026-07-14": {
    "arlington": 101, // AT&T Stadium
    "dallas": 101,
  },
  "2026-07-15": {
    "atlanta": 102, // Mercedes-Benz Stadium
  },
};
