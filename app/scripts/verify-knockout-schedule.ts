// Programmatically compare the codebase knockout schedule against FIFA's
// official API (api.fifa.com), the authoritative source.
//
// Checks, per FIFA match number (regulations numbering):
//   1. Venue city   — tournament.ts vs FIFA Stadium.CityName
//   2. Kickoff (UTC) — tournament.ts date+time vs FIFA Date
//   3. Positions     — r32/r16/qf/sf bracket vs FIFA PlaceHolderA/B
//
// Usage: node --import tsx scripts/verify-knockout-schedule.ts

import { KNOCKOUT_SCHEDULE } from "../src/lib/tournament.ts";
import {
  r32Bracket,
  r16Bracket,
  qfBracket,
  sfBracket,
} from "../src/lib/r32-bracket.ts";

const FIFA_URL =
  "https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&count=200&language=en";

// FIFA uses sponsor-neutral stadium names; compare by CITY which is stable.
// Normalise a couple of FIFA city spellings to the codebase's.
const CITY_ALIASES: Record<string, string> = {
  "new york": "new york",
  "new york / new jersey": "new york",
  "new york new jersey": "new york",
  inglewood: "los angeles",
  "los angeles": "los angeles",
  foxborough: "boston",
  "kansas city": "kansas city",
  "miami gardens": "miami",
  miami: "miami",
  "santa clara": "san francisco",
  "san francisco bay area": "san francisco",
  arlington: "dallas",
  "east rutherford": "new york",
  guadalupe: "monterrey",
  "mexico city": "mexico city",
  philadelphia: "philadelphia",
  seattle: "seattle",
  houston: "houston",
  atlanta: "atlanta",
  toronto: "toronto",
  vancouver: "vancouver",
};
const normCity = (c: string) =>
  CITY_ALIASES[c.trim().toLowerCase()] ?? c.trim().toLowerCase();

// Build expected position label ("1A", "2B", "3rd", "W73", ...) from a bracket slot.
function r32Label(pos: { group: string; position: number } | null): string | null {
  if (pos === null) return "3rd"; // dynamic third-place slot
  const letter = pos.group.replace("GROUP_", "");
  return `${pos.position}${letter}`;
}

async function main() {
  const res = await fetch(FIFA_URL, { headers: { Accept: "application/json" } });
  const json = (await res.json()) as { Results: any[] };

  // Index FIFA matches by MatchNumber (knockout only: 73-104).
  const fifa = new Map<number, any>();
  for (const m of json.Results) {
    if (m.MatchNumber >= 73 && m.MatchNumber <= 104) fifa.set(m.MatchNumber, m);
  }
  console.log(`FIFA knockout matches fetched: ${fifa.size}`);

  // Index codebase schedule + positions by match number.
  const sched = new Map<number, any>();
  for (const s of KNOCKOUT_SCHEDULE) sched.set(s.fifaNumber, s);

  const posByMatch = new Map<number, [string | null, string | null]>();
  for (const b of r32Bracket)
    posByMatch.set(b.matchNumber as number, [
      r32Label(b.homePosition),
      r32Label(b.awayPosition),
    ]);
  for (const b of r16Bracket)
    posByMatch.set(b.matchNumber as number, [
      `W${b.homeFromR32}`,
      `W${b.awayFromR32}`,
    ]);
  for (const b of qfBracket)
    posByMatch.set(b.matchNumber as number, [
      `W${b.homeFromR16}`,
      `W${b.awayFromR16}`,
    ]);
  for (const b of sfBracket)
    posByMatch.set(b.matchNumber as number, [
      `W${b.homeFromQF}`,
      `W${b.awayFromQF}`,
    ]);

  const problems: string[] = [];

  for (let n = 73; n <= 104; n++) {
    const f = fifa.get(n);
    const s = sched.get(n);
    if (!f) {
      problems.push(`#${n}: missing from FIFA API`);
      continue;
    }
    if (!s) {
      problems.push(`#${n}: missing from tournament.ts`);
      continue;
    }

    const issues: string[] = [];

    // 1. City
    const fifaCity = normCity(f.Stadium?.CityName?.[0]?.Description ?? "");
    const ourCity = normCity(s.venue.city);
    if (fifaCity !== ourCity) {
      issues.push(
        `CITY ours=${s.venue.city} (${ourCity}) vs FIFA=${f.Stadium?.CityName?.[0]?.Description} (${fifaCity})`,
      );
    }

    // 2. Kickoff UTC
    const ourUtc = new Date(`${s.date}T${s.time}:00Z`).toISOString();
    const fifaUtc = new Date(f.Date).toISOString();
    if (ourUtc !== fifaUtc) {
      issues.push(`TIME ours=${ourUtc} vs FIFA=${fifaUtc}`);
    }

    // 3. Positions
    const ourPos = posByMatch.get(n);
    const fifaA = (f.PlaceHolderA ?? "").toString();
    const fifaB = (f.PlaceHolderB ?? "").toString();
    if (ourPos) {
      const norm = (x: string | null) => (x ?? "").toLowerCase().replace(/\s+/g, "");
      // FIFA labels a third-place slot with the eligible-group pool, e.g.
      // "3ABCDF". Our generic "3rd" slot corresponds to any such pool.
      const isPool = (x: string) => /^3[a-l]{2,}$/i.test(x.replace(/\s+/g, ""));
      const aMatch =
        norm(ourPos[0]) === norm(fifaA) || (ourPos[0] === "3rd" && isPool(fifaA));
      const bMatch =
        norm(ourPos[1]) === norm(fifaB) || (ourPos[1] === "3rd" && isPool(fifaB));
      if (!aMatch || !bMatch) {
        issues.push(
          `POS ours=[${ourPos[0]} v ${ourPos[1]}] vs FIFA=[${fifaA} v ${fifaB}]`,
        );
      }
    }

    if (issues.length) {
      problems.push(`#${n} (${s.stage}):\n    ` + issues.join("\n    "));
    }
  }

  console.log(`\n=== Mismatches: ${problems.length} ===`);
  for (const p of problems) console.log(p);
  if (problems.length === 0) console.log("All knockout matches match FIFA. ✓");
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
