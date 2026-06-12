import { BRACKET_SOURCES } from './src/lib/tournament.js';

// Official bracket from worldcupwiki.com:
// Match 73: 2A vs 2B
// Match 74: 1E vs 3rd (A/B/C/D/F)
// Match 75: 1F vs 2C
// Match 76: 1C vs 2F
// Match 77: 1I vs 3rd (C/D/F/G/H)
// Match 78: 2E vs 2I
// Match 79: 1A vs 3rd (C/E/F/H/I)
// Match 80: 1L vs 3rd (E/H/I/J/K)
// Match 81: 1D vs 3rd (B/E/F/I/J)
// Match 82: 1G vs 3rd (A/E/H/I/J)
// Match 83: 2K vs 2L
// Match 84: 1H vs 2J
// Match 85: 1B vs 3rd (E/F/G/I/J)
// Match 86: 1J vs 2H
// Match 87: 1K vs 3rd (D/E/I/J/L)
// Match 88: 2D vs 2G

type OfficialBracket = {
  home: string;
  away: string | null; // null = 3rd place
};

const officialBracket: Record<number, OfficialBracket> = {
  73: { home: '2A', away: '2B' },
  74: { home: '1E', away: null },  // 3rd place
  75: { home: '1F', away: '2C' },
  76: { home: '1C', away: '2F' },
  77: { home: '1I', away: null },  // 3rd place
  78: { home: '2E', away: '2I' },
  79: { home: '1A', away: null },  // 3rd place
  80: { home: '1L', away: null },  // 3rd place
  81: { home: '1D', away: null },  // 3rd place
  82: { home: '1G', away: null },  // 3rd place
  83: { home: '2K', away: '2L' },
  84: { home: '1H', away: '2J' },
  85: { home: '1B', away: null },  // 3rd place
  86: { home: '1J', away: '2H' },
  87: { home: '1K', away: null },  // 3rd place
  88: { home: '2D', away: '2G' },
};

// R16 bracket from official:
// 89: W74 vs W77  (winner of 1E/3rd vs winner of 1I/3rd)
// 90: W73 vs W75  (winner of 2A/2B vs winner of 1F/2C)  
// 91: W76 vs W78  (winner of 1C/2F vs winner of 2E/2I)
// 92: W79 vs W80  (winner of 1A/3rd vs winner of 1L/3rd)
// 93: W83 vs W84  (winner of 2K/2L vs winner of 1H/2J)
// 94: W81 vs W82  (winner of 1D/3rd vs winner of 1G/3rd)
// 95: W86 vs W88  (winner of 1J/2H vs winner of 2D/2G)
// 96: W85 vs W87  (winner of 1B/3rd vs winner of 1K/3rd)

const officialR16: Record<number, { homeFrom: number; awayFrom: number }> = {
  89: { homeFrom: 74, awayFrom: 77 },
  90: { homeFrom: 73, awayFrom: 75 },
  91: { homeFrom: 76, awayFrom: 78 },
  92: { homeFrom: 79, awayFrom: 80 },
  93: { homeFrom: 83, awayFrom: 84 },
  94: { homeFrom: 81, awayFrom: 82 },
  95: { homeFrom: 86, awayFrom: 88 },
  96: { homeFrom: 85, awayFrom: 87 },
};

function formatPos(bs: any): string {
  if (!bs) return '?';
  const g = bs.group.replace('GROUP_', '');
  return `${bs.position}${g}`;
}

console.log('=== R32 BRACKET MATCHUPS ===');
let mismatches = 0;
for (const [numStr, official] of Object.entries(officialBracket)) {
  const num = parseInt(numStr);
  const bs = BRACKET_SOURCES.find((b: any) => b.fifaNumber === num);
  if (!bs) { console.log(`MISSING #${num}`); mismatches++; continue; }

  const ourHome = bs.homePosition ? formatPos(bs.homePosition) : '?';
  const ourAway = bs.awayPosition ? formatPos(bs.awayPosition) : (bs.awayPosition === null ? '3rd' : '?');

  const ok = ourHome === official.home && 
    ((official.away === null && ourAway === '3rd') || ourAway === official.away);

  if (!ok) {
    console.log(`❌ #${num}: ours=${ourHome} vs ${ourAway}, official=${official.home} vs ${official.away || '3rd'}`);
    mismatches++;
  } else {
    console.log(`✅ #${num}: ${ourHome} vs ${ourAway}`);
  }
}

console.log('\n=== R16 BRACKET SOURCES ===');
for (const [numStr, official] of Object.entries(officialR16)) {
  const num = parseInt(numStr);
  const bs = BRACKET_SOURCES.find((b: any) => b.fifaNumber === num);
  if (!bs) { console.log(`MISSING #${num}`); mismatches++; continue; }

  const ok = bs.homeFromMatch === official.homeFrom && bs.awayFromMatch === official.awayFrom;
  if (!ok) {
    console.log(`❌ #${num}: ours=W${bs.homeFromMatch} vs W${bs.awayFromMatch}, official=W${official.homeFrom} vs W${official.awayFrom}`);
    mismatches++;
  } else {
    console.log(`✅ #${num}: W${bs.homeFromMatch} vs W${bs.awayFromMatch}`);
  }
}

console.log(`\n${mismatches === 0 ? '✅ All bracket matchups correct!' : `❌ ${mismatches} bracket mismatches`}`);
