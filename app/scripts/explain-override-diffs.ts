// Prove the 16 "diff" overrides were no-ops the app ignored: for each, the
// overridden team and the team at the override's target position are NOT tied
// on points in the user's pure (no-override) predicted standings — so the app
// never applied the swap, and freezing to the displayed position is correct.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  calculateStandingsFromPredictions,
  groupMatchesByGroup,
} from "../src/lib/standings.ts";
import type { Match } from "../src/types/football.ts";
import type { LocalPrediction } from "../src/types/database.ts";

const PROD = "https://worldcupprode.azurewebsites.net/api/matches";

async function main() {
  const snapDir = process.argv[process.argv.indexOf("--snapshot") + 1];
  const { matches } = (await (await fetch(PROD)).json()) as { matches: Match[] };
  const groupMatches = matches.filter((m) => m.stage === "GROUP_STAGE");

  const preds = JSON.parse(readFileSync(join(snapDir, "predictions.json"), "utf8"));
  const orig = JSON.parse(
    readFileSync(join(snapDir, "group_standings_overrides.json"), "utf8"),
  );
  const computed = JSON.parse(
    readFileSync(join(snapDir, "computed-overrides.json"), "utf8"),
  ).rows;

  const predsByUser = new Map<string, any[]>();
  for (const p of preds) {
    if (!predsByUser.has(p.user_id)) predsByUser.set(p.user_id, []);
    predsByUser.get(p.user_id)!.push(p);
  }
  const newPos = new Map<string, number>();
  for (const r of computed)
    newPos.set(`${r.user_id}|${r.group_name}|${r.team_id}`, r.position);

  const groups = groupMatchesByGroup(groupMatches);

  let activeButChanged = 0;
  for (const o of orig) {
    const k = `${o.user_id}|${o.group_name}|${o.team_id}`;
    const np = newPos.get(k);
    if (np === o.position) continue; // unchanged, fine

    // Compute PURE standings (no overrides) for this user's group.
    const pm = new Map<number, LocalPrediction>();
    for (const p of predsByUser.get(o.user_id) ?? [])
      pm.set(p.match_id, p as LocalPrediction);
    const standings = calculateStandingsFromPredictions(
      groups.get(o.group_name)!,
      pm,
    );
    const movedTeam = standings.find((s) => s.team.id === o.team_id)!;
    const targetTeam = standings[o.position - 1]; // team the app would compare against
    const tied = movedTeam.points === targetTeam.points;
    console.log(
      `${o.group_name} team ${o.team_id}: wantedPos ${o.position} -> frozenPos ${np} | ` +
        `movedPts ${movedTeam.points} vs targetPts ${targetTeam.points} | ` +
        `tied=${tied} ${tied ? "<-- UNEXPECTED (override was valid!)" : "(no-op, correctly ignored)"}`,
    );
    if (tied) activeButChanged++;
  }
  console.log(
    `\nValid-but-changed overrides (should be 0): ${activeButChanged}`,
  );
}
main().catch((e) => { console.error(e); process.exit(1); });
