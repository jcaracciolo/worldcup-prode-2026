import { KNOCKOUT_SCHEDULE } from './src/lib/tournament.js';

// Official R32 schedule from worldcupwiki.com (match number → city)
const officialR32: Record<number, { city: string; date: string; timeET: string }> = {
  73: { city: 'Los Angeles', date: 'Jun 28', timeET: '3:00 PM' },
  74: { city: 'Boston', date: 'Jun 29', timeET: '4:30 PM' },
  75: { city: 'Monterrey', date: 'Jun 29', timeET: '8:00 PM' },
  76: { city: 'Houston', date: 'Jun 29', timeET: '1:00 PM' },
  77: { city: 'New York', date: 'Jun 30', timeET: '5:00 PM' },
  78: { city: 'Dallas', date: 'Jun 30', timeET: '1:00 PM' },
  79: { city: 'Mexico City', date: 'Jun 30', timeET: '8:00 PM' },
  80: { city: 'Atlanta', date: 'Jul 01', timeET: '12:00 PM' },
  81: { city: 'San Francisco', date: 'Jul 01', timeET: '8:00 PM' },
  82: { city: 'Seattle', date: 'Jul 01', timeET: '4:00 PM' },
  83: { city: 'Toronto', date: 'Jul 02', timeET: '7:00 PM' },
  84: { city: 'Los Angeles', date: 'Jul 02', timeET: '3:00 PM' },
  85: { city: 'Vancouver', date: 'Jul 02', timeET: '11:00 PM' },
  86: { city: 'Miami', date: 'Jul 03', timeET: '6:00 PM' },
  87: { city: 'Kansas City', date: 'Jul 03', timeET: '9:30 PM' },
  88: { city: 'Dallas', date: 'Jul 03', timeET: '2:00 PM' },
};

// Official R16 (from FIFA): 89-96
const officialR16: Record<number, { city: string }> = {
  89: { city: 'Houston' },        // Jul 4
  90: { city: 'Philadelphia' },   // Jul 4
  91: { city: 'New York' },       // Jul 5
  92: { city: 'Mexico City' },    // Jul 5
  93: { city: 'Dallas' },         // Jul 6
  94: { city: 'Seattle' },        // Jul 6
  95: { city: 'Atlanta' },        // Jul 7
  96: { city: 'Vancouver' },      // Jul 7
};

// Official QF
const officialQF: Record<number, { city: string }> = {
  97: { city: 'Boston' },         // Jul 9
  98: { city: 'Los Angeles' },    // Jul 10
  99: { city: 'Miami' },          // Jul 11  - worldcupwiki says MetLife/NY but kickoffadventures says Miami
  100: { city: 'Kansas City' },   // Jul 11
};

// Official SF/3rd/Final
const officialLate: Record<number, { city: string }> = {
  101: { city: 'Dallas' },        // Jul 14 - SF1
  102: { city: 'Atlanta' },       // Jul 15 - SF2
  103: { city: 'Miami' },         // Jul 18 - 3rd place
  104: { city: 'New York' },      // Jul 19 - Final
};

const normalize = (c: string) => c.toLowerCase().replace(/[^a-z]/g, '');

console.log('=== ROUND OF 32 (73-88) ===');
let mismatches = 0;
for (const [numStr, official] of Object.entries(officialR32)) {
  const num = parseInt(numStr);
  const match = KNOCKOUT_SCHEDULE.find(m => m.fifaNumber === num);
  if (!match) { console.log(`MISSING #${num}`); mismatches++; continue; }
  if (normalize(match.venue.city) !== normalize(official.city)) {
    console.log(`❌ #${num}: ours=${match.venue.city}, official=${official.city} (${official.date} ${official.timeET} ET)`);
    mismatches++;
  } else {
    console.log(`✅ #${num}: ${match.venue.city}`);
  }
}

console.log('\n=== ROUND OF 16 (89-96) ===');
for (const [numStr, official] of Object.entries(officialR16)) {
  const num = parseInt(numStr);
  const match = KNOCKOUT_SCHEDULE.find(m => m.fifaNumber === num);
  if (!match) { console.log(`MISSING #${num}`); mismatches++; continue; }
  if (normalize(match.venue.city) !== normalize(official.city)) {
    console.log(`❌ #${num}: ours=${match.venue.city}, official=${official.city}`);
    mismatches++;
  } else {
    console.log(`✅ #${num}: ${match.venue.city}`);
  }
}

console.log('\n=== QF / SF / 3rd / Final (97-104) ===');
const allLate = { ...officialQF, ...officialLate };
for (const [numStr, official] of Object.entries(allLate)) {
  const num = parseInt(numStr);
  const match = KNOCKOUT_SCHEDULE.find(m => m.fifaNumber === num);
  if (!match) { console.log(`MISSING #${num}`); mismatches++; continue; }
  if (normalize(match.venue.city) !== normalize(official.city)) {
    console.log(`❌ #${num}: ours=${match.venue.city}, official=${official.city}`);
    mismatches++;
  } else {
    console.log(`✅ #${num}: ${match.venue.city}`);
  }
}

console.log(`\n${mismatches === 0 ? '✅ All knockout venues match!' : `❌ ${mismatches} mismatches found`}`);
