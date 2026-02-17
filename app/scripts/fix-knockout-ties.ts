/**
 * Fix knockout ties — sets penalty_winner on all knockout predictions that are ties.
 *
 * Simply picks 'HOME' or 'AWAY' randomly for each tied knockout prediction
 * that doesn't have a penalty_winner set yet. No bracket resolution needed.
 *
 * Usage: npx tsx scripts/fix-knockout-ties.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://yzcimgrudhtnjdlvgnhg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6Y2ltZ3J1ZGh0bmpkbHZnbmhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM0ODQyMiwiZXhwIjoyMDg1OTI0NDIyfQ.KxC3zx7IWV1WKqu4BR5_HmT_eAlAt4f0QfoMNjjNaiQ",
);

async function main() {
  // Find all knockout ties (match_id >= 73) without a penalty_winner
  console.log("Finding knockout ties without penalty_winner...");

  const { data: ties, error } = await supabase
    .from("predictions")
    .select("id, match_id, home_goals, away_goals, penalty_winner")
    .gte("match_id", 73)
    .not("home_goals", "is", null)
    .not("away_goals", "is", null)
    .is("penalty_winner", null);

  if (error) throw error;

  // Filter to actual ties (home_goals === away_goals)
  const actualTies = (ties || []).filter((p) => p.home_goals === p.away_goals);
  console.log(`  Found ${actualTies.length} ties needing penalty_winner`);

  if (actualTies.length === 0) {
    console.log("Nothing to fix.");
    return;
  }

  // Update each with random HOME/AWAY
  const BATCH = 50;
  let fixed = 0;

  for (let i = 0; i < actualTies.length; i += BATCH) {
    const batch = actualTies.slice(i, i + BATCH);
    await Promise.all(
      batch.map((p) => {
        const penaltyWinner = Math.random() < 0.5 ? "HOME" : "AWAY";
        return supabase
          .from("predictions")
          .update({ penalty_winner: penaltyWinner })
          .eq("id", p.id)
          .then(({ error }) => {
            if (error) {
              console.error(`  Failed id=${p.id}:`, error.message);
            } else {
              fixed++;
            }
          });
      }),
    );
  }

  console.log(`\nFixed ${fixed} knockout ties with random penalty_winner.`);
}

main().catch(console.error);
