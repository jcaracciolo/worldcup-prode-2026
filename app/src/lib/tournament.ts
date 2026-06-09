/**
 * TOURNAMENT STRUCTURE - Single Source of Truth for STATIC data
 *
 * This file contains ONLY tournament structure data that is known before the tournament:
 * - Match venues, dates, times
 * - Bracket structure (who plays who)
 * - Group compositions
 *
 * For LIVE data (scores, match status), use api-client.ts
 *
 * Usage:
 *   const matchInfo = getMatchInfo(86);  // Get venue, date, time
 *   const bracket = getBracketSource(86); // Get bracket structure
 */

// =====================================================================
// TYPES
// =====================================================================

export type Stage =
  | "GROUP_STAGE"
  | "LAST_32"
  | "LAST_16"
  | "QUARTER_FINALS"
  | "SEMI_FINALS"
  | "THIRD_PLACE"
  | "FINAL";

export interface Venue {
  stadium: string;
  city: string;
  country: string;
}

export interface MatchInfo {
  fifaNumber: number;
  stage: Stage;
  date: string; // ISO date: "2026-07-03"
  time: string; // UTC time: "18:00"
  venue: Venue;
}

export interface GroupPosition {
  group: string; // "GROUP_A", "GROUP_B", etc.
  position: 1 | 2 | 3;
}

export interface BracketSource {
  fifaNumber: number;
  stage: Stage;
  // For R32: teams come from group positions
  homePosition?: GroupPosition;
  awayPosition?: GroupPosition | null; // null = 3rd place (dynamic)
  // For R16+: teams come from previous round winners
  homeFromMatch?: number;
  awayFromMatch?: number;
  // For third place: losers from semi finals
  homeLoserFrom?: number;
  awayLoserFrom?: number;
}

// =====================================================================
// CONSTANTS
// =====================================================================

/** All group names in order (A-L for 48-team format) */
export const GROUPS = [
  "GROUP_A",
  "GROUP_B",
  "GROUP_C",
  "GROUP_D",
  "GROUP_E",
  "GROUP_F",
  "GROUP_G",
  "GROUP_H",
  "GROUP_I",
  "GROUP_J",
  "GROUP_K",
  "GROUP_L",
] as const;

export type GroupName = (typeof GROUPS)[number];

// =====================================================================
// GROUP STAGE SCHEDULE (FIFA Match Numbers 1-72)
// This is the OFFICIAL FIFA schedule for World Cup 2026
// =====================================================================

export const GROUP_STAGE_SCHEDULE: MatchInfo[] = [
  // Matchday 1
  {
    fifaNumber: 1,
    stage: "GROUP_STAGE",
    date: "2026-06-11",
    time: "19:00",
    venue: { stadium: "Estadio Azteca", city: "Mexico City", country: "MEX" },
  },
  {
    fifaNumber: 2,
    stage: "GROUP_STAGE",
    date: "2026-06-11",
    time: "02:00",
    venue: { stadium: "Estadio Akron", city: "Guadalajara", country: "MEX" },
  },
  {
    fifaNumber: 3,
    stage: "GROUP_STAGE",
    date: "2026-06-12",
    time: "19:00",
    venue: { stadium: "BMO Field", city: "Toronto", country: "CAN" },
  },
  {
    fifaNumber: 4,
    stage: "GROUP_STAGE",
    date: "2026-06-12",
    time: "01:00",
    venue: { stadium: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  },
  {
    fifaNumber: 5,
    stage: "GROUP_STAGE",
    date: "2026-06-13",
    time: "04:00",
    venue: { stadium: "BC Place", city: "Vancouver", country: "CAN" },
  },
  {
    fifaNumber: 6,
    stage: "GROUP_STAGE",
    date: "2026-06-13",
    time: "19:00",
    venue: { stadium: "Levi's Stadium", city: "San Francisco", country: "USA" },
  },
  {
    fifaNumber: 7,
    stage: "GROUP_STAGE",
    date: "2026-06-13",
    time: "22:00",
    venue: { stadium: "MetLife Stadium", city: "New York", country: "USA" },
  },
  {
    fifaNumber: 8,
    stage: "GROUP_STAGE",
    date: "2026-06-13",
    time: "01:00",
    venue: { stadium: "Gillette Stadium", city: "Boston", country: "USA" },
  },
  {
    fifaNumber: 9,
    stage: "GROUP_STAGE",
    date: "2026-06-14",
    time: "17:00",
    venue: { stadium: "NRG Stadium", city: "Houston", country: "USA" },
  },
  {
    fifaNumber: 10,
    stage: "GROUP_STAGE",
    date: "2026-06-14",
    time: "20:00",
    venue: { stadium: "AT&T Stadium", city: "Dallas", country: "USA" },
  },
  {
    fifaNumber: 11,
    stage: "GROUP_STAGE",
    date: "2026-06-14",
    time: "23:00",
    venue: {
      stadium: "Lincoln Financial Field",
      city: "Philadelphia",
      country: "USA",
    },
  },
  {
    fifaNumber: 12,
    stage: "GROUP_STAGE",
    date: "2026-06-14",
    time: "02:00",
    venue: { stadium: "Estadio BBVA", city: "Monterrey", country: "MEX" },
  },
  // Matchday 2
  {
    fifaNumber: 13,
    stage: "GROUP_STAGE",
    date: "2026-06-15",
    time: "16:00",
    venue: {
      stadium: "Mercedes-Benz Stadium",
      city: "Atlanta",
      country: "USA",
    },
  },
  {
    fifaNumber: 14,
    stage: "GROUP_STAGE",
    date: "2026-06-15",
    time: "19:00",
    venue: { stadium: "Lumen Field", city: "Seattle", country: "USA" },
  },
  {
    fifaNumber: 15,
    stage: "GROUP_STAGE",
    date: "2026-06-15",
    time: "22:00",
    venue: { stadium: "Hard Rock Stadium", city: "Miami", country: "USA" },
  },
  {
    fifaNumber: 16,
    stage: "GROUP_STAGE",
    date: "2026-06-15",
    time: "01:00",
    venue: { stadium: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  },
  {
    fifaNumber: 17,
    stage: "GROUP_STAGE",
    date: "2026-06-16",
    time: "19:00",
    venue: { stadium: "MetLife Stadium", city: "New York", country: "USA" },
  },
  {
    fifaNumber: 18,
    stage: "GROUP_STAGE",
    date: "2026-06-16",
    time: "22:00",
    venue: { stadium: "Gillette Stadium", city: "Boston", country: "USA" },
  },
  {
    fifaNumber: 19,
    stage: "GROUP_STAGE",
    date: "2026-06-16",
    time: "01:00",
    venue: {
      stadium: "Arrowhead Stadium",
      city: "Kansas City",
      country: "USA",
    },
  },
  {
    fifaNumber: 20,
    stage: "GROUP_STAGE",
    date: "2026-06-16",
    time: "04:00",
    venue: { stadium: "Levi's Stadium", city: "San Francisco", country: "USA" },
  },
  // Matchday 3
  {
    fifaNumber: 21,
    stage: "GROUP_STAGE",
    date: "2026-06-17",
    time: "17:00",
    venue: { stadium: "NRG Stadium", city: "Houston", country: "USA" },
  },
  {
    fifaNumber: 22,
    stage: "GROUP_STAGE",
    date: "2026-06-17",
    time: "20:00",
    venue: { stadium: "AT&T Stadium", city: "Dallas", country: "USA" },
  },
  {
    fifaNumber: 23,
    stage: "GROUP_STAGE",
    date: "2026-06-17",
    time: "23:00",
    venue: { stadium: "BMO Field", city: "Toronto", country: "CAN" },
  },
  {
    fifaNumber: 24,
    stage: "GROUP_STAGE",
    date: "2026-06-17",
    time: "02:00",
    venue: { stadium: "Estadio Azteca", city: "Mexico City", country: "MEX" },
  },
  // Matchday 4
  {
    fifaNumber: 25,
    stage: "GROUP_STAGE",
    date: "2026-06-18",
    time: "16:00",
    venue: {
      stadium: "Mercedes-Benz Stadium",
      city: "Atlanta",
      country: "USA",
    },
  },
  {
    fifaNumber: 26,
    stage: "GROUP_STAGE",
    date: "2026-06-18",
    time: "19:00",
    venue: { stadium: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  },
  {
    fifaNumber: 27,
    stage: "GROUP_STAGE",
    date: "2026-06-18",
    time: "22:00",
    venue: { stadium: "BC Place", city: "Vancouver", country: "CAN" },
  },
  {
    fifaNumber: 28,
    stage: "GROUP_STAGE",
    date: "2026-06-18",
    time: "01:00",
    venue: { stadium: "Estadio Akron", city: "Guadalajara", country: "MEX" },
  },
  {
    fifaNumber: 29,
    stage: "GROUP_STAGE",
    date: "2026-06-19",
    time: "03:00",
    venue: { stadium: "Levi's Stadium", city: "San Francisco", country: "USA" },
  },
  {
    fifaNumber: 30,
    stage: "GROUP_STAGE",
    date: "2026-06-19",
    time: "19:00",
    venue: { stadium: "Lumen Field", city: "Seattle", country: "USA" },
  },
  {
    fifaNumber: 31,
    stage: "GROUP_STAGE",
    date: "2026-06-19",
    time: "22:00",
    venue: { stadium: "Gillette Stadium", city: "Boston", country: "USA" },
  },
  {
    fifaNumber: 32,
    stage: "GROUP_STAGE",
    date: "2026-06-19",
    time: "00:30",
    venue: {
      stadium: "Lincoln Financial Field",
      city: "Philadelphia",
      country: "USA",
    },
  },
  // Matchday 5
  {
    fifaNumber: 33,
    stage: "GROUP_STAGE",
    date: "2026-06-20",
    time: "04:00",
    venue: { stadium: "Estadio BBVA", city: "Monterrey", country: "MEX" },
  },
  {
    fifaNumber: 34,
    stage: "GROUP_STAGE",
    date: "2026-06-20",
    time: "17:00",
    venue: { stadium: "NRG Stadium", city: "Houston", country: "USA" },
  },
  {
    fifaNumber: 35,
    stage: "GROUP_STAGE",
    date: "2026-06-20",
    time: "20:00",
    venue: { stadium: "BMO Field", city: "Toronto", country: "CAN" },
  },
  {
    fifaNumber: 36,
    stage: "GROUP_STAGE",
    date: "2026-06-20",
    time: "00:00",
    venue: {
      stadium: "Arrowhead Stadium",
      city: "Kansas City",
      country: "USA",
    },
  },
  // Matchday 6
  {
    fifaNumber: 37,
    stage: "GROUP_STAGE",
    date: "2026-06-21",
    time: "16:00",
    venue: {
      stadium: "Mercedes-Benz Stadium",
      city: "Atlanta",
      country: "USA",
    },
  },
  {
    fifaNumber: 38,
    stage: "GROUP_STAGE",
    date: "2026-06-21",
    time: "19:00",
    venue: { stadium: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  },
  {
    fifaNumber: 39,
    stage: "GROUP_STAGE",
    date: "2026-06-21",
    time: "22:00",
    venue: { stadium: "Hard Rock Stadium", city: "Miami", country: "USA" },
  },
  {
    fifaNumber: 40,
    stage: "GROUP_STAGE",
    date: "2026-06-21",
    time: "01:00",
    venue: { stadium: "BC Place", city: "Vancouver", country: "CAN" },
  },
  // Matchday 7
  {
    fifaNumber: 41,
    stage: "GROUP_STAGE",
    date: "2026-06-22",
    time: "17:00",
    venue: { stadium: "AT&T Stadium", city: "Dallas", country: "USA" },
  },
  {
    fifaNumber: 42,
    stage: "GROUP_STAGE",
    date: "2026-06-22",
    time: "21:00",
    venue: {
      stadium: "Lincoln Financial Field",
      city: "Philadelphia",
      country: "USA",
    },
  },
  {
    fifaNumber: 43,
    stage: "GROUP_STAGE",
    date: "2026-06-22",
    time: "00:00",
    venue: { stadium: "MetLife Stadium", city: "New York", country: "USA" },
  },
  {
    fifaNumber: 44,
    stage: "GROUP_STAGE",
    date: "2026-06-22",
    time: "03:00",
    venue: { stadium: "Levi's Stadium", city: "San Francisco", country: "USA" },
  },
  // Matchday 8
  {
    fifaNumber: 45,
    stage: "GROUP_STAGE",
    date: "2026-06-23",
    time: "17:00",
    venue: { stadium: "NRG Stadium", city: "Houston", country: "USA" },
  },
  {
    fifaNumber: 46,
    stage: "GROUP_STAGE",
    date: "2026-06-23",
    time: "20:00",
    venue: { stadium: "Gillette Stadium", city: "Boston", country: "USA" },
  },
  {
    fifaNumber: 47,
    stage: "GROUP_STAGE",
    date: "2026-06-23",
    time: "23:00",
    venue: { stadium: "BMO Field", city: "Toronto", country: "CAN" },
  },
  {
    fifaNumber: 48,
    stage: "GROUP_STAGE",
    date: "2026-06-23",
    time: "02:00",
    venue: { stadium: "Estadio Akron", city: "Guadalajara", country: "MEX" },
  },
  // Matchday 9 (Round 3 - simultaneous kicks)
  {
    fifaNumber: 49,
    stage: "GROUP_STAGE",
    date: "2026-06-24",
    time: "19:00",
    venue: { stadium: "BC Place", city: "Vancouver", country: "CAN" },
  },
  {
    fifaNumber: 50,
    stage: "GROUP_STAGE",
    date: "2026-06-24",
    time: "19:00",
    venue: { stadium: "Lumen Field", city: "Seattle", country: "USA" },
  },
  {
    fifaNumber: 51,
    stage: "GROUP_STAGE",
    date: "2026-06-24",
    time: "22:00",
    venue: {
      stadium: "Mercedes-Benz Stadium",
      city: "Atlanta",
      country: "USA",
    },
  },
  {
    fifaNumber: 52,
    stage: "GROUP_STAGE",
    date: "2026-06-24",
    time: "22:00",
    venue: { stadium: "Hard Rock Stadium", city: "Miami", country: "USA" },
  },
  {
    fifaNumber: 53,
    stage: "GROUP_STAGE",
    date: "2026-06-24",
    time: "01:00",
    venue: { stadium: "Estadio Azteca", city: "Mexico City", country: "MEX" },
  },
  {
    fifaNumber: 54,
    stage: "GROUP_STAGE",
    date: "2026-06-24",
    time: "01:00",
    venue: { stadium: "Estadio BBVA", city: "Monterrey", country: "MEX" },
  },
  {
    fifaNumber: 55,
    stage: "GROUP_STAGE",
    date: "2026-06-25",
    time: "20:00",
    venue: { stadium: "MetLife Stadium", city: "New York", country: "USA" },
  },
  {
    fifaNumber: 56,
    stage: "GROUP_STAGE",
    date: "2026-06-25",
    time: "20:00",
    venue: {
      stadium: "Lincoln Financial Field",
      city: "Philadelphia",
      country: "USA",
    },
  },
  {
    fifaNumber: 57,
    stage: "GROUP_STAGE",
    date: "2026-06-25",
    time: "23:00",
    venue: {
      stadium: "Arrowhead Stadium",
      city: "Kansas City",
      country: "USA",
    },
  },
  {
    fifaNumber: 58,
    stage: "GROUP_STAGE",
    date: "2026-06-25",
    time: "23:00",
    venue: { stadium: "AT&T Stadium", city: "Dallas", country: "USA" },
  },
  {
    fifaNumber: 59,
    stage: "GROUP_STAGE",
    date: "2026-06-25",
    time: "02:00",
    venue: { stadium: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  },
  {
    fifaNumber: 60,
    stage: "GROUP_STAGE",
    date: "2026-06-25",
    time: "02:00",
    venue: { stadium: "Levi's Stadium", city: "San Francisco", country: "USA" },
  },
  {
    fifaNumber: 61,
    stage: "GROUP_STAGE",
    date: "2026-06-26",
    time: "19:00",
    venue: { stadium: "Gillette Stadium", city: "Boston", country: "USA" },
  },
  {
    fifaNumber: 62,
    stage: "GROUP_STAGE",
    date: "2026-06-26",
    time: "19:00",
    venue: { stadium: "BMO Field", city: "Toronto", country: "CAN" },
  },
  {
    fifaNumber: 63,
    stage: "GROUP_STAGE",
    date: "2026-06-26",
    time: "00:00",
    venue: { stadium: "Estadio Akron", city: "Guadalajara", country: "MEX" },
  },
  {
    fifaNumber: 64,
    stage: "GROUP_STAGE",
    date: "2026-06-26",
    time: "00:00",
    venue: { stadium: "NRG Stadium", city: "Houston", country: "USA" },
  },
  {
    fifaNumber: 65,
    stage: "GROUP_STAGE",
    date: "2026-06-27",
    time: "03:00",
    venue: { stadium: "BC Place", city: "Vancouver", country: "CAN" },
  },
  {
    fifaNumber: 66,
    stage: "GROUP_STAGE",
    date: "2026-06-27",
    time: "03:00",
    venue: { stadium: "Lumen Field", city: "Seattle", country: "USA" },
  },
  {
    fifaNumber: 67,
    stage: "GROUP_STAGE",
    date: "2026-06-27",
    time: "21:00",
    venue: { stadium: "MetLife Stadium", city: "New York", country: "USA" },
  },
  {
    fifaNumber: 68,
    stage: "GROUP_STAGE",
    date: "2026-06-27",
    time: "21:00",
    venue: {
      stadium: "Lincoln Financial Field",
      city: "Philadelphia",
      country: "USA",
    },
  },
  {
    fifaNumber: 69,
    stage: "GROUP_STAGE",
    date: "2026-06-27",
    time: "23:30",
    venue: { stadium: "Hard Rock Stadium", city: "Miami", country: "USA" },
  },
  {
    fifaNumber: 70,
    stage: "GROUP_STAGE",
    date: "2026-06-27",
    time: "23:30",
    venue: {
      stadium: "Mercedes-Benz Stadium",
      city: "Atlanta",
      country: "USA",
    },
  },
  {
    fifaNumber: 71,
    stage: "GROUP_STAGE",
    date: "2026-06-27",
    time: "02:00",
    venue: { stadium: "AT&T Stadium", city: "Dallas", country: "USA" },
  },
  {
    fifaNumber: 72,
    stage: "GROUP_STAGE",
    date: "2026-06-27",
    time: "02:00",
    venue: {
      stadium: "Arrowhead Stadium",
      city: "Kansas City",
      country: "USA",
    },
  },
];

// =====================================================================
// KNOCKOUT MATCH SCHEDULE (FIFA Match Numbers 73-104)
// This is the OFFICIAL FIFA schedule for World Cup 2026
// =====================================================================

export const KNOCKOUT_SCHEDULE: MatchInfo[] = [
  // ROUND OF 32 (Matches 73-88)
  {
    fifaNumber: 73,
    stage: "LAST_32",
    date: "2026-06-28",
    time: "19:00",
    venue: { stadium: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  },
  {
    fifaNumber: 74,
    stage: "LAST_32",
    date: "2026-06-29",
    time: "17:00",
    venue: { stadium: "NRG Stadium", city: "Houston", country: "USA" },
  },
  {
    fifaNumber: 75,
    stage: "LAST_32",
    date: "2026-06-29",
    time: "20:30",
    venue: { stadium: "Gillette Stadium", city: "Boston", country: "USA" },
  },
  {
    fifaNumber: 76,
    stage: "LAST_32",
    date: "2026-06-29",
    time: "01:00",
    venue: { stadium: "Estadio BBVA", city: "Monterrey", country: "MEX" },
  },
  {
    fifaNumber: 77,
    stage: "LAST_32",
    date: "2026-06-30",
    time: "17:00",
    venue: { stadium: "AT&T Stadium", city: "Dallas", country: "USA" },
  },
  {
    fifaNumber: 78,
    stage: "LAST_32",
    date: "2026-06-30",
    time: "21:00",
    venue: { stadium: "MetLife Stadium", city: "New York", country: "USA" },
  },
  {
    fifaNumber: 79,
    stage: "LAST_32",
    date: "2026-06-30",
    time: "01:00",
    venue: { stadium: "Estadio Azteca", city: "Mexico City", country: "MEX" },
  },
  {
    fifaNumber: 80,
    stage: "LAST_32",
    date: "2026-07-01",
    time: "16:00",
    venue: {
      stadium: "Mercedes-Benz Stadium",
      city: "Atlanta",
      country: "USA",
    },
  },
  {
    fifaNumber: 81,
    stage: "LAST_32",
    date: "2026-07-01",
    time: "20:00",
    venue: { stadium: "Lumen Field", city: "Seattle", country: "USA" },
  },
  {
    fifaNumber: 82,
    stage: "LAST_32",
    date: "2026-07-01",
    time: "00:00",
    venue: { stadium: "Levi's Stadium", city: "San Francisco", country: "USA" },
  },
  {
    fifaNumber: 83,
    stage: "LAST_32",
    date: "2026-07-02",
    time: "19:00",
    venue: { stadium: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  },
  {
    fifaNumber: 84,
    stage: "LAST_32",
    date: "2026-07-02",
    time: "23:00",
    venue: { stadium: "BMO Field", city: "Toronto", country: "CAN" },
  },
  {
    fifaNumber: 85,
    stage: "LAST_32",
    date: "2026-07-02",
    time: "03:00",
    venue: { stadium: "BC Place", city: "Vancouver", country: "CAN" },
  },
  {
    fifaNumber: 86,
    stage: "LAST_32",
    date: "2026-07-03",
    time: "18:00",
    venue: { stadium: "AT&T Stadium", city: "Dallas", country: "USA" },
  },
  {
    fifaNumber: 87,
    stage: "LAST_32",
    date: "2026-07-03",
    time: "22:00",
    venue: { stadium: "Hard Rock Stadium", city: "Miami", country: "USA" },
  },
  {
    fifaNumber: 88,
    stage: "LAST_32",
    date: "2026-07-03",
    time: "01:30",
    venue: {
      stadium: "Arrowhead Stadium",
      city: "Kansas City",
      country: "USA",
    },
  },

  // ROUND OF 16 (Matches 89-96)
  {
    fifaNumber: 89,
    stage: "LAST_16",
    date: "2026-07-04",
    time: "17:00",
    venue: { stadium: "NRG Stadium", city: "Houston", country: "USA" },
  },
  {
    fifaNumber: 90,
    stage: "LAST_16",
    date: "2026-07-04",
    time: "21:00",
    venue: {
      stadium: "Lincoln Financial Field",
      city: "Philadelphia",
      country: "USA",
    },
  },
  {
    fifaNumber: 91,
    stage: "LAST_16",
    date: "2026-07-05",
    time: "20:00",
    venue: { stadium: "MetLife Stadium", city: "New York", country: "USA" },
  },
  {
    fifaNumber: 92,
    stage: "LAST_16",
    date: "2026-07-05",
    time: "00:00",
    venue: { stadium: "Estadio Azteca", city: "Mexico City", country: "MEX" },
  },
  {
    fifaNumber: 93,
    stage: "LAST_16",
    date: "2026-07-06",
    time: "19:00",
    venue: { stadium: "AT&T Stadium", city: "Dallas", country: "USA" },
  },
  {
    fifaNumber: 94,
    stage: "LAST_16",
    date: "2026-07-06",
    time: "00:00",
    venue: { stadium: "Lumen Field", city: "Seattle", country: "USA" },
  },
  {
    fifaNumber: 95,
    stage: "LAST_16",
    date: "2026-07-07",
    time: "16:00",
    venue: {
      stadium: "Mercedes-Benz Stadium",
      city: "Atlanta",
      country: "USA",
    },
  },
  {
    fifaNumber: 96,
    stage: "LAST_16",
    date: "2026-07-07",
    time: "20:00",
    venue: { stadium: "BC Place", city: "Vancouver", country: "CAN" },
  },

  // QUARTER FINALS (Matches 97-100)
  {
    fifaNumber: 97,
    stage: "QUARTER_FINALS",
    date: "2026-07-09",
    time: "20:00",
    venue: { stadium: "Gillette Stadium", city: "Boston", country: "USA" },
  },
  {
    fifaNumber: 98,
    stage: "QUARTER_FINALS",
    date: "2026-07-10",
    time: "19:00",
    venue: { stadium: "SoFi Stadium", city: "Los Angeles", country: "USA" },
  },
  {
    fifaNumber: 99,
    stage: "QUARTER_FINALS",
    date: "2026-07-11",
    time: "21:00",
    venue: { stadium: "Hard Rock Stadium", city: "Miami", country: "USA" },
  },
  {
    fifaNumber: 100,
    stage: "QUARTER_FINALS",
    date: "2026-07-11",
    time: "01:00",
    venue: {
      stadium: "Arrowhead Stadium",
      city: "Kansas City",
      country: "USA",
    },
  },

  // SEMI FINALS (Matches 101-102)
  {
    fifaNumber: 101,
    stage: "SEMI_FINALS",
    date: "2026-07-14",
    time: "19:00",
    venue: { stadium: "AT&T Stadium", city: "Dallas", country: "USA" },
  },
  {
    fifaNumber: 102,
    stage: "SEMI_FINALS",
    date: "2026-07-15",
    time: "19:00",
    venue: {
      stadium: "Mercedes-Benz Stadium",
      city: "Atlanta",
      country: "USA",
    },
  },

  // THIRD PLACE (Match 103)
  {
    fifaNumber: 103,
    stage: "THIRD_PLACE",
    date: "2026-07-18",
    time: "21:00",
    venue: { stadium: "Hard Rock Stadium", city: "Miami", country: "USA" },
  },

  // FINAL (Match 104)
  {
    fifaNumber: 104,
    stage: "FINAL",
    date: "2026-07-19",
    time: "19:00",
    venue: { stadium: "MetLife Stadium", city: "New York", country: "USA" },
  },
];

// =====================================================================
// BRACKET STRUCTURE (Where teams come from)
// =====================================================================

export const BRACKET_SOURCES: BracketSource[] = [
  // ROUND OF 32 - Teams from group positions
  {
    fifaNumber: 73,
    stage: "LAST_32",
    homePosition: { group: "GROUP_A", position: 2 },
    awayPosition: { group: "GROUP_B", position: 2 },
  },
  {
    fifaNumber: 74,
    stage: "LAST_32",
    homePosition: { group: "GROUP_E", position: 1 },
    awayPosition: null,
  }, // 3rd: A/B/C/D/F
  {
    fifaNumber: 75,
    stage: "LAST_32",
    homePosition: { group: "GROUP_F", position: 1 },
    awayPosition: { group: "GROUP_C", position: 2 },
  },
  {
    fifaNumber: 76,
    stage: "LAST_32",
    homePosition: { group: "GROUP_C", position: 1 },
    awayPosition: { group: "GROUP_F", position: 2 },
  },
  {
    fifaNumber: 77,
    stage: "LAST_32",
    homePosition: { group: "GROUP_I", position: 1 },
    awayPosition: null,
  }, // 3rd: C/D/F/G/H
  {
    fifaNumber: 78,
    stage: "LAST_32",
    homePosition: { group: "GROUP_E", position: 2 },
    awayPosition: { group: "GROUP_I", position: 2 },
  },
  {
    fifaNumber: 79,
    stage: "LAST_32",
    homePosition: { group: "GROUP_A", position: 1 },
    awayPosition: null,
  }, // 3rd: C/E/F/H/I
  {
    fifaNumber: 80,
    stage: "LAST_32",
    homePosition: { group: "GROUP_L", position: 1 },
    awayPosition: null,
  }, // 3rd: E/H/I/J/K
  {
    fifaNumber: 81,
    stage: "LAST_32",
    homePosition: { group: "GROUP_D", position: 1 },
    awayPosition: null,
  }, // 3rd: B/E/F/I/J
  {
    fifaNumber: 82,
    stage: "LAST_32",
    homePosition: { group: "GROUP_G", position: 1 },
    awayPosition: null,
  }, // 3rd: A/E/H/I/J
  {
    fifaNumber: 83,
    stage: "LAST_32",
    homePosition: { group: "GROUP_K", position: 2 },
    awayPosition: { group: "GROUP_L", position: 2 },
  },
  {
    fifaNumber: 84,
    stage: "LAST_32",
    homePosition: { group: "GROUP_H", position: 1 },
    awayPosition: { group: "GROUP_J", position: 2 },
  },
  {
    fifaNumber: 85,
    stage: "LAST_32",
    homePosition: { group: "GROUP_B", position: 1 },
    awayPosition: null,
  }, // 3rd: E/F/G/I/J
  {
    fifaNumber: 86,
    stage: "LAST_32",
    homePosition: { group: "GROUP_J", position: 1 },
    awayPosition: { group: "GROUP_H", position: 2 },
  },
  {
    fifaNumber: 87,
    stage: "LAST_32",
    homePosition: { group: "GROUP_K", position: 1 },
    awayPosition: null,
  }, // 3rd: D/E/I/J/L
  {
    fifaNumber: 88,
    stage: "LAST_32",
    homePosition: { group: "GROUP_D", position: 2 },
    awayPosition: { group: "GROUP_G", position: 2 },
  },

  // ROUND OF 16 - Winners from R32
  { fifaNumber: 89, stage: "LAST_16", homeFromMatch: 74, awayFromMatch: 77 },
  { fifaNumber: 90, stage: "LAST_16", homeFromMatch: 73, awayFromMatch: 75 },
  { fifaNumber: 91, stage: "LAST_16", homeFromMatch: 76, awayFromMatch: 78 },
  { fifaNumber: 92, stage: "LAST_16", homeFromMatch: 79, awayFromMatch: 80 },
  { fifaNumber: 93, stage: "LAST_16", homeFromMatch: 83, awayFromMatch: 84 },
  { fifaNumber: 94, stage: "LAST_16", homeFromMatch: 81, awayFromMatch: 82 },
  { fifaNumber: 95, stage: "LAST_16", homeFromMatch: 86, awayFromMatch: 88 },
  { fifaNumber: 96, stage: "LAST_16", homeFromMatch: 85, awayFromMatch: 87 },

  // QUARTER FINALS - Winners from R16
  {
    fifaNumber: 97,
    stage: "QUARTER_FINALS",
    homeFromMatch: 89,
    awayFromMatch: 90,
  },
  {
    fifaNumber: 98,
    stage: "QUARTER_FINALS",
    homeFromMatch: 93,
    awayFromMatch: 94,
  },
  {
    fifaNumber: 99,
    stage: "QUARTER_FINALS",
    homeFromMatch: 91,
    awayFromMatch: 92,
  },
  {
    fifaNumber: 100,
    stage: "QUARTER_FINALS",
    homeFromMatch: 95,
    awayFromMatch: 96,
  },

  // SEMI FINALS - Winners from QF
  {
    fifaNumber: 101,
    stage: "SEMI_FINALS",
    homeFromMatch: 97,
    awayFromMatch: 98,
  },
  {
    fifaNumber: 102,
    stage: "SEMI_FINALS",
    homeFromMatch: 99,
    awayFromMatch: 100,
  },

  // THIRD PLACE - Losers from SF
  {
    fifaNumber: 103,
    stage: "THIRD_PLACE",
    homeLoserFrom: 101,
    awayLoserFrom: 102,
  },

  // FINAL - Winners from SF
  { fifaNumber: 104, stage: "FINAL", homeFromMatch: 101, awayFromMatch: 102 },
];

// =====================================================================
// LOOKUP MAPS (for O(1) access)
// =====================================================================

const scheduleByFifaNumber = new Map<number, MatchInfo>();
// Add all matches (group stage + knockout) to the lookup map
GROUP_STAGE_SCHEDULE.forEach((m) => scheduleByFifaNumber.set(m.fifaNumber, m));
KNOCKOUT_SCHEDULE.forEach((m) => scheduleByFifaNumber.set(m.fifaNumber, m));

const bracketByFifaNumber = new Map<number, BracketSource>();
BRACKET_SOURCES.forEach((b) => bracketByFifaNumber.set(b.fifaNumber, b));

// =====================================================================
// PUBLIC API - Use these functions everywhere
// =====================================================================

/**
 * Get match schedule info by FIFA match number
 * Returns venue, date, time, stage
 */
export function getMatchInfo(fifaNumber: number): MatchInfo | null {
  return scheduleByFifaNumber.get(fifaNumber) || null;
}

/**
 * Get bracket source info by FIFA match number
 * Returns where the teams come from (group positions or previous match winners)
 */
export function getBracketSource(fifaNumber: number): BracketSource | null {
  return bracketByFifaNumber.get(fifaNumber) || null;
}

/**
 * Get all matches for a specific stage
 */
export function getMatchesByStage(stage: Stage): MatchInfo[] {
  if (stage === "GROUP_STAGE") {
    return GROUP_STAGE_SCHEDULE;
  }
  return KNOCKOUT_SCHEDULE.filter((m) => m.stage === stage);
}

/**
 * Get human-readable position label
 */
export function getPositionLabel(group: string, position: number): string {
  const groupLetter = group.replace("GROUP_", "");
  const positionLabel = position === 1 ? "1st" : position === 2 ? "2nd" : "3rd";
  return `${positionLabel} ${groupLetter}`;
}

/**
 * Get stage display name
 */
export function getStageName(stage: Stage): string {
  switch (stage) {
    case "GROUP_STAGE":
      return "Group Stage";
    case "LAST_32":
      return "Round of 32";
    case "LAST_16":
      return "Round of 16";
    case "QUARTER_FINALS":
      return "Quarter Finals";
    case "SEMI_FINALS":
      return "Semi Finals";
    case "THIRD_PLACE":
      return "Third Place";
    case "FINAL":
      return "Final";
    default:
      return stage;
  }
}
