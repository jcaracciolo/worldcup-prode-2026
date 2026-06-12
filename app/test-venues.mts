import { GROUP_STAGE_SCHEDULE } from './src/lib/tournament.js';

// Official FIFA schedule: [fifaNum, group, home, away, city]
const official: [number, string, string, string, string][] = [
  [1, 'A', 'MEX', 'RSA', 'Mexico City'],
  [2, 'A', 'KOR', 'CZE', 'Guadalajara'],
  [3, 'B', 'CAN', 'BIH', 'Toronto'],
  [4, 'D', 'USA', 'PAR', 'Los Angeles'],
  [5, 'D', 'AUS', 'TUR', 'Vancouver'],
  [6, 'B', 'QAT', 'SUI', 'San Francisco'],
  [7, 'C', 'BRA', 'MAR', 'New York'],
  [8, 'C', 'HAI', 'SCO', 'Boston'],
  [9, 'E', 'GER', 'CUR', 'Houston'],
  [10, 'F', 'NED', 'JPN', 'Dallas'],
  [11, 'E', 'CIV', 'ECU', 'Philadelphia'],
  [12, 'F', 'TUN', 'SWE', 'Monterrey'],
  [13, 'H', 'ESP', 'CPV', 'Atlanta'],
  [14, 'G', 'BEL', 'EGY', 'Seattle'],
  [15, 'H', 'KSA', 'URU', 'Miami'],
  [16, 'G', 'IRN', 'NZL', 'Los Angeles'],
  [17, 'I', 'FRA', 'SEN', 'New York'],
  [18, 'I', 'NOR', 'IRQ', 'Boston'],
  [19, 'J', 'ARG', 'ALG', 'Kansas City'],
  [20, 'J', 'AUT', 'JOR', 'San Francisco'],
  [21, 'K', 'POR', 'COD', 'Houston'],
  [22, 'L', 'ENG', 'CRO', 'Dallas'],
  [23, 'L', 'GHA', 'PAN', 'Toronto'],
  [24, 'K', 'UZB', 'COL', 'Mexico City'],
  [25, 'A', 'RSA', 'CZE', 'Atlanta'],
  [26, 'B', 'SUI', 'BIH', 'Los Angeles'],
  [27, 'B', 'CAN', 'QAT', 'Vancouver'],
  [28, 'A', 'MEX', 'KOR', 'Guadalajara'],
  [29, 'D', 'PAR', 'TUR', 'San Francisco'],
  [30, 'D', 'USA', 'AUS', 'Seattle'],
  [31, 'C', 'SCO', 'MAR', 'Boston'],
  [32, 'C', 'BRA', 'HAI', 'Philadelphia'],
  [33, 'F', 'TUN', 'JPN', 'Monterrey'],
  [34, 'F', 'NED', 'SWE', 'Houston'],
  [35, 'E', 'GER', 'CIV', 'Toronto'],
  [36, 'E', 'ECU', 'CUR', 'Kansas City'],
  [37, 'H', 'ESP', 'KSA', 'Atlanta'],
  [38, 'G', 'BEL', 'IRN', 'Los Angeles'],
  [39, 'H', 'URU', 'CPV', 'Miami'],
  [40, 'G', 'NZL', 'EGY', 'Vancouver'],
  [41, 'J', 'ARG', 'AUT', 'Dallas'],
  [42, 'I', 'FRA', 'IRQ', 'Philadelphia'],
  [43, 'I', 'NOR', 'SEN', 'New York'],
  [44, 'J', 'JOR', 'ALG', 'San Francisco'],
  [45, 'K', 'POR', 'UZB', 'Houston'],
  [46, 'L', 'ENG', 'GHA', 'Boston'],
  [47, 'L', 'PAN', 'CRO', 'Toronto'],
  [48, 'K', 'COL', 'COD', 'Guadalajara'],
  [49, 'B', 'CAN', 'SUI', 'Vancouver'],
  [50, 'B', 'QAT', 'BIH', 'Seattle'],
  [51, 'C', 'MAR', 'HAI', 'Atlanta'],
  [52, 'C', 'SCO', 'BRA', 'Miami'],
  [53, 'A', 'MEX', 'CZE', 'Mexico City'],
  [54, 'A', 'KOR', 'RSA', 'Monterrey'],
  [55, 'E', 'ECU', 'GER', 'New York'],
  [56, 'E', 'CUR', 'CIV', 'Philadelphia'],
  [57, 'F', 'TUN', 'NED', 'Kansas City'],
  [58, 'F', 'JPN', 'SWE', 'Dallas'],
  [59, 'D', 'USA', 'TUR', 'Los Angeles'],
  [60, 'D', 'PAR', 'AUS', 'San Francisco'],
  [61, 'I', 'NOR', 'FRA', 'Boston'],
  [62, 'I', 'SEN', 'IRQ', 'Toronto'],
  [63, 'H', 'URU', 'ESP', 'Guadalajara'],
  [64, 'H', 'CPV', 'KSA', 'Houston'],
  [65, 'G', 'NZL', 'BEL', 'Vancouver'],
  [66, 'G', 'EGY', 'IRN', 'Seattle'],
  [67, 'L', 'PAN', 'ENG', 'New York'],
  [68, 'L', 'CRO', 'GHA', 'Philadelphia'],
  [69, 'K', 'COL', 'POR', 'Miami'],
  [70, 'K', 'UZB', 'COD', 'Atlanta'],
  [71, 'J', 'JOR', 'ARG', 'Dallas'],
  [72, 'J', 'ALG', 'AUT', 'Kansas City'],
];

const normalize = (c: string) => c.toLowerCase().replace(/[^a-z]/g, '');
let mismatches = 0;
for (const [fifaNum, group, home, away, officialCity] of official) {
  const match = GROUP_STAGE_SCHEDULE.find(m => m.fifaNumber === fifaNum);
  if (!match) {
    console.log(`MISSING match #${fifaNum}`);
    mismatches++;
    continue;
  }
  if (normalize(match.venue.city) !== normalize(officialCity)) {
    console.log(`#${fifaNum} VENUE MISMATCH: ${home} vs ${away} (Grp ${group}) — ours=${match.venue.city}, official=${officialCity}`);
    mismatches++;
  }
}
console.log(mismatches === 0 ? '✅ All 72 group stage venues MATCH!' : `❌ ${mismatches} mismatches`);
