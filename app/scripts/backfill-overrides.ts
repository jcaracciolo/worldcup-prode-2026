// Backfill group_standings_overrides for ALL teams, freezing each user's
// CURRENT predicted standings (old tiebreaker + their existing overrides).
//
// Why: before switching to the FIFA-2026 tiebreaker, we capture every user's
// current per-group order as explicit overrides so their predicted standings
// do not silently change when the auto-tiebreaker rule changes.
//
// Uses the REAL app standings function (calculateStandingsFromPredictions) and
// replicates the exact override-application logic from
// prediction-bracket-resolver.ts so positions match the app byte-for-byte.
//
// Read source data from a snapshot folder (locked predictions). Group fixtures
// come from the production /api/matches endpoint.
//
// Usage:
//   node --import tsx scripts/backfill-overrides.ts --snapshot <dir>          (dry run)
//   node --import tsx scripts/backfill-overrides.ts --snapshot <dir> --write  (writes DB)

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  calculateStandingsFromPredictions,
  groupMatchesByGroup,
} from "../src/lib/standings.ts";
import type { Match, CalculatedStanding } from "../src/types/football.ts";
import type {
  LocalPrediction,
  GroupStandingsOverride,
} from "../src/types/database.ts";

const PROD_MATCHES_URL = "https://worldcupprode.azurewebsites.net/api/matches";

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

function loadEnv() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    key: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

// Exact replica of prediction-bracket-resolver.ts computePredictedStandings
// (per-group path with overrides applied). Keeps positions identical to the app.
function standingsForUser(
  matches: Match[],
  predictionMap: Map<number, LocalPrediction>,
  groupOverrides: GroupStandingsOverride[],
): Map<string, CalculatedStanding[]> {
  const groups = groupMatchesByGroup(matches);
  const all = new Map<string, CalculatedStanding[]>();

  groups.forEach((groupMatches, groupName) => {
    const standings = calculateStandingsFromPredictions(
      groupMatches,
      predictionMap,
    );

    const overridesForGroup = groupOverrides.filter(
      (o) => o.group_name === groupName,
    );
    if (overridesForGroup.length > 0) {
      overridesForGroup.forEach((override) => {
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
      standings.forEach((s, i) => {
        s.position = i + 1;
      });
    }

    all.set(groupName, standings);
  });

  return all;
}

async function main() {
  const args = process.argv.slice(2);
  const snapIdx = args.indexOf("--snapshot");
  if (snapIdx === -1) throw new Error("--snapshot <dir> is required");
  const snapDir = args[snapIdx + 1];
  const doWrite = args.includes("--write");

  const { url, key } = loadEnv();
  if (!url || !key) throw new Error("Missing Supabase env vars");

  // 1. Group fixtures from production.
  const res = await fetch(PROD_MATCHES_URL);
  const { matches } = (await res.json()) as { matches: Match[] };
  const groupMatches = matches.filter((m) => m.stage === "GROUP_STAGE");
  console.log(`Group-stage fixtures: ${groupMatches.length}`);

  // 2. Source data from snapshot (locked).
  const predictions: PredictionRow[] = JSON.parse(
    readFileSync(join(snapDir, "predictions.json"), "utf8"),
  );
  const overrides: GroupStandingsOverride[] = JSON.parse(
    readFileSync(join(snapDir, "group_standings_overrides.json"), "utf8"),
  );

  const predsByUser = new Map<string, PredictionRow[]>();
  for (const p of predictions) {
    if (!predsByUser.has(p.user_id)) predsByUser.set(p.user_id, []);
    predsByUser.get(p.user_id)!.push(p);
  }
  const ovrByUser = new Map<string, GroupStandingsOverride[]>();
  for (const o of overrides) {
    if (!ovrByUser.has(o.user_id)) ovrByUser.set(o.user_id, []);
    ovrByUser.get(o.user_id)!.push(o);
  }

  // 3. Compute frozen positions per user/group.
  const out: OverrideRow[] = [];
  const skipped: { user_id: string; group_name: string; reason: string }[] = [];
  let usersProcessed = 0;

  for (const [userId, userPreds] of predsByUser) {
    usersProcessed++;
    const predictionMap = new Map<number, LocalPrediction>();
    for (const p of userPreds) {
      predictionMap.set(p.match_id, {
        match_id: p.match_id,
        home_goals: p.home_goals,
        away_goals: p.away_goals,
        penalty_winner: p.penalty_winner,
      } as LocalPrediction);
    }
    const userOverrides = ovrByUser.get(userId) ?? [];

    const standings = standingsForUser(groupMatches, predictionMap, userOverrides);

    standings.forEach((teams, groupName) => {
      // Only freeze groups where the user actually predicted >=1 match,
      // otherwise the order is arbitrary (all teams 0 pts).
      const groupMatchIds = groupMatches
        .filter((m) => m.group === groupName)
        .map((m) => m.id as number);
      const predictedCount = groupMatchIds.filter((id) =>
        predictionMap.has(id),
      ).length;
      if (predictedCount === 0) {
        skipped.push({ user_id: userId, group_name: groupName, reason: "no predictions" });
        return;
      }
      teams.forEach((s, i) => {
        out.push({
          user_id: userId,
          group_name: groupName,
          team_id: s.team.id,
          position: i + 1,
        });
      });
    });
  }

  console.log(`Users processed: ${usersProcessed}`);
  console.log(`Override rows computed: ${out.length}`);
  console.log(`Skipped (no predictions) groups: ${skipped.length}`);

  // Save computed rows for review.
  const outFile = join(snapDir, "computed-overrides.json");
  writeFileSync(outFile, JSON.stringify({ rows: out, skipped }, null, 2));
  console.log(`Wrote ${outFile}`);

  // Sample
  console.log("\nSample (first user, GROUP_A):");
  const sampleUser = out[0]?.user_id;
  console.table(
    out.filter((r) => r.user_id === sampleUser && r.group_name === "GROUP_A"),
  );

  if (!doWrite) {
    console.log("\nDRY RUN — no DB changes. Re-run with --write to apply.");
    return;
  }

  // 4. WRITE: replace overrides for every backfilled user, then bulk insert.
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };
  const userIds = [...new Set(out.map((r) => r.user_id))];
  console.log(`\nWRITING: deleting existing overrides for ${userIds.length} users...`);
  // Delete in chunks to keep URLs short.
  for (let i = 0; i < userIds.length; i += 25) {
    const chunk = userIds.slice(i, i + 25);
    const inList = chunk.map((id) => `"${id}"`).join(",");
    const del = await fetch(
      `${url}/rest/v1/group_standings_overrides?user_id=in.(${inList})`,
      { method: "DELETE", headers },
    );
    if (!del.ok) throw new Error(`DELETE failed: ${del.status} ${await del.text()}`);
  }

  console.log(`Inserting ${out.length} override rows...`);
  for (let i = 0; i < out.length; i += 500) {
    const batch = out.slice(i, i + 500);
    const ins = await fetch(`${url}/rest/v1/group_standings_overrides`, {
      method: "POST",
      headers,
      body: JSON.stringify(batch),
    });
    if (!ins.ok) throw new Error(`INSERT failed: ${ins.status} ${await ins.text()}`);
    process.stdout.write(`  inserted ${Math.min(i + 500, out.length)}/${out.length}\r`);
  }
  console.log("\nBackfill written.");
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
