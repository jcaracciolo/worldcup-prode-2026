// Verify that the backfilled overrides FREEZE each user's predicted standings:
// applying the CURRENT-working-tree tiebreaker + the computed overrides must
// reproduce the frozen target order saved in computed-overrides.json.
//
// Run it twice:
//   1) with the OLD tiebreaker in place (sanity — must pass trivially)
//   2) after applying the FIFA-2026 fix (the real test — must STILL pass,
//      proving the overrides freeze standings across the rule change)
//
// Usage: node --import tsx scripts/verify-freeze.ts --snapshot <dir>

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  calculateStandingsFromPredictions,
  groupMatchesByGroup,
} from "../src/lib/standings.ts";
import type { Match } from "../src/types/football.ts";
import type { LocalPrediction } from "../src/types/database.ts";

interface PredictionRow {
  user_id: string;
  match_id: number;
  home_goals: number | null;
  away_goals: number | null;
  penalty_winner: "HOME" | "AWAY" | null;
}
interface OverrideRow {
  user_id: string;
  group_name: string;
  team_id: number;
  position: number;
}

const PROD_MATCHES_URL = "https://worldcupprode.azurewebsites.net/api/matches";

async function main() {
  const args = process.argv.slice(2);
  const snapDir = args[args.indexOf("--snapshot") + 1];
  if (!snapDir) throw new Error("--snapshot <dir> required");

  const res = await fetch(PROD_MATCHES_URL);
  const { matches } = (await res.json()) as { matches: Match[] };
  const groupMatches = matches.filter((m) => m.stage === "GROUP_STAGE");

  const predictions: PredictionRow[] = JSON.parse(
    readFileSync(join(snapDir, "predictions.json"), "utf8"),
  );
  const { rows: computed } = JSON.parse(
    readFileSync(join(snapDir, "computed-overrides.json"), "utf8"),
  ) as { rows: OverrideRow[] };

  const predsByUser = new Map<string, PredictionRow[]>();
  for (const p of predictions) {
    if (!predsByUser.has(p.user_id)) predsByUser.set(p.user_id, []);
    predsByUser.get(p.user_id)!.push(p);
  }
  // target order + the overrides to apply (same data)
  const ovrByUserGroup = new Map<string, OverrideRow[]>();
  for (const o of computed) {
    const k = `${o.user_id}|${o.group_name}`;
    if (!ovrByUserGroup.has(k)) ovrByUserGroup.set(k, []);
    ovrByUserGroup.get(k)!.push(o);
  }

  let checked = 0;
  let mismatches = 0;
  const failures: string[] = [];

  for (const [k, overrides] of ovrByUserGroup) {
    const [userId, groupName] = k.split("|");
    const userPreds = predsByUser.get(userId) ?? [];
    const predictionMap = new Map<number, LocalPrediction>();
    for (const p of userPreds) {
      predictionMap.set(p.match_id, {
        match_id: p.match_id,
        home_goals: p.home_goals,
        away_goals: p.away_goals,
        penalty_winner: p.penalty_winner,
      } as LocalPrediction);
    }

    const groups = groupMatchesByGroup(groupMatches);
    const gm = groups.get(groupName)!;
    const standings = calculateStandingsFromPredictions(gm, predictionMap);

    // Apply overrides exactly as the app does (ascending position order).
    const ordered = [...overrides].sort((a, b) => a.position - b.position);
    ordered.forEach((override) => {
      const teamIndex = standings.findIndex(
        (s) => s.team.id === override.team_id,
      );
      const targetIndex = override.position - 1;
      if (
        teamIndex !== -1 &&
        targetIndex >= 0 &&
        targetIndex < standings.length &&
        teamIndex !== targetIndex &&
        standings[teamIndex].points === standings[targetIndex].points
      ) {
        const [team] = standings.splice(teamIndex, 1);
        standings.splice(override.position - 1, 0, team);
      }
    });

    // Compare resulting order to the frozen target.
    const target = ordered.map((o) => o.team_id); // target[i] = team at position i+1
    const result = standings.map((s) => s.team.id);
    checked++;
    if (JSON.stringify(target) !== JSON.stringify(result)) {
      mismatches++;
      if (failures.length < 20) {
        failures.push(`${k}\n  target: ${target}\n  result: ${result}`);
      }
    }
  }

  console.log(`Checked user/group standings: ${checked}`);
  console.log(`Mismatches: ${mismatches}`);
  if (mismatches > 0) {
    console.log("\nFirst failures:");
    failures.forEach((f) => console.log(f));
    process.exit(2);
  }
  console.log("OK — overrides reproduce the frozen order under the current tiebreaker.");
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
