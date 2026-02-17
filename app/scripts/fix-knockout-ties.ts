/**
 * Fix knockout ties — sets winner_id on all knockout predictions that are ties.
 *
 * Uses the app's own PredictionBracketResolver to determine which teams
 * play in each knockout match from each user's predicted bracket. Then
 * randomly picks home or away as the penalty winner.
 *
 * Match data (group stage team assignments) is only needed to compute
 * predicted group standings — it tells us "match 5 = Germany vs Japan"
 * so we can apply each user's predicted scores to build their standings.
 *
 * Usage: npx tsx scripts/fix-knockout-ties.ts
 * Requires: app running at localhost:3000 (for match data)
 */

import { createClient } from "@supabase/supabase-js";
import type { Match, FifaMatchId } from "../src/types/football.js";
import type { LocalPrediction } from "../src/types/database.js";
import { PredictionBracketResolver } from "../src/lib/prediction-bracket-resolver.js";
import type { LiveBracket } from "../src/lib/live-bracket-resolver.js";

const supabase = createClient(
  "https://yzcimgrudhtnjdlvgnhg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6Y2ltZ3J1ZGh0bmpkbHZnbmhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM0ODQyMiwiZXhwIjoyMDg1OTI0NDIyfQ.KxC3zx7IWV1WKqu4BR5_HmT_eAlAt4f0QfoMNjjNaiQ"
);

// Pre-tournament: empty live bracket (no group matches played yet)
const EMPTY_LIVE_BRACKET: LiveBracket = {
  kind: "live",
  teams: new Map(),
  groupStandings: new Map(),
  thirdPlaceQualifying: new Map(),
};

// =====================================================================
// Fetch all predictions (paginated past Supabase 1000-row limit)
// =====================================================================
async function fetchAllPredictions() {
  const all: Array<{
    id: number;
    user_id: string;
    competition_id: number;
    match_id: number;
    home_goals: number | null;
    away_goals: number | null;
    winner_id: number | null;
  }> = [];

  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("predictions")
      .select("id, user_id, competition_id, match_id, home_goals, away_goals, winner_id")
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// =====================================================================
// Main
// =====================================================================
async function main() {
  // 1. Get match data from the running app (group stage team assignments only)
  console.log("Fetching match data from localhost:3000...");
  const res = await fetch("http://localhost:3000/api/matches");
  if (!res.ok) throw new Error(`Failed to fetch matches: ${res.status}`);
  const { matches } = (await res.json()) as { matches: Match[] };
  console.log(`  Got ${matches.length} matches`);

  // 2. Get all predictions from Supabase
  console.log("Fetching all predictions...");
  const allPredictions = await fetchAllPredictions();
  console.log(`  Got ${allPredictions.length} predictions`);

  // 3. Group by (user_id, competition_id)
  const byUserComp = new Map<string, typeof allPredictions>();
  for (const p of allPredictions) {
    const key = `${p.user_id}|${p.competition_id}`;
    if (!byUserComp.has(key)) byUserComp.set(key, []);
    byUserComp.get(key)!.push(p);
  }
  console.log(`  ${byUserComp.size} user-competition pairs`);

  // 4. Process round by round — must fix ties in earlier rounds first
  //    so the resolver can chain winners forward to later rounds.
  const ROUNDS = [
    { label: "R32", minMatch: 73, maxMatch: 88 },
    { label: "R16", minMatch: 89, maxMatch: 96 },
    { label: "QF",  minMatch: 97, maxMatch: 100 },
    { label: "SF",  minMatch: 101, maxMatch: 102 },
    { label: "3rd", minMatch: 103, maxMatch: 103 },
    { label: "Final", minMatch: 104, maxMatch: 104 },
  ];

  let totalFixed = 0;

  for (const round of ROUNDS) {
    const updates: Array<{ id: number; winner_id: number; key: string }> = [];

    for (const [key, preds] of byUserComp) {
      // Build prediction map with current winner_id values
      const predMap = new Map<FifaMatchId, LocalPrediction>();
      for (const p of preds) {
        predMap.set(p.match_id as FifaMatchId, {
          match_id: p.match_id,
          home_goals: p.home_goals,
          away_goals: p.away_goals,
          winner_id: p.winner_id,
        });
      }

      // Resolve bracket using the app's own PredictionBracketResolver
      const bracket = new PredictionBracketResolver({
        liveBracket: EMPTY_LIVE_BRACKET,
        matches,
        predictions: predMap,
      }).resolve();

      // Fix ties in THIS round only
      for (const p of preds) {
        if (p.match_id < round.minMatch || p.match_id > round.maxMatch) continue;
        if (p.home_goals === null || p.away_goals === null) continue;
        if (p.home_goals !== p.away_goals) continue; // not a tie

        const resolved = bracket.teams.get(p.match_id as FifaMatchId);
        if (!resolved?.home || !resolved?.away) continue;

        // Already correct?
        if (p.winner_id === resolved.home.id || p.winner_id === resolved.away.id) {
          continue;
        }

        // Pick random winner from user's predicted bracket teams
        const winner = Math.random() < 0.5 ? resolved.home : resolved.away;
        updates.push({ id: p.id, winner_id: winner.id, key });
      }
    }

    if (updates.length === 0) {
      console.log(`  ${round.label}: 0 ties to fix`);
      continue;
    }

    // Write updates for this round
    const BATCH = 50;
    for (let i = 0; i < updates.length; i += BATCH) {
      const batch = updates.slice(i, i + BATCH);
      await Promise.all(
        batch.map(({ id, winner_id }) =>
          supabase
            .from("predictions")
            .update({ winner_id })
            .eq("id", id)
            .then(({ error }) => {
              if (error) console.error(`  Failed id=${id}:`, error.message);
            })
        )
      );
    }

    // Update in-memory predictions so next round sees correct winner_id
    for (const { id, winner_id, key } of updates) {
      const preds = byUserComp.get(key)!;
      const pred = preds.find((p) => p.id === id);
      if (pred) pred.winner_id = winner_id;
    }

    console.log(`  ${round.label}: fixed ${updates.length} ties`);
    totalFixed += updates.length;
  }

  console.log(`\nTotal fixed: ${totalFixed}`);
}

main().catch(console.error);
