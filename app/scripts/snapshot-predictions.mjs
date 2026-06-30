// Snapshot all user prediction data to an immutable, timestamped folder.
//
// Captures the raw source-of-truth tables (predictions, overrides, profiles)
// BEFORE any scoring/tiebreaker rule change, so we can audit, diff, or roll
// back. Read-only: performs only GET requests against the Supabase REST API.
//
// Usage:  node scripts/snapshot-predictions.mjs [--out <dir>]
//
// Output: <out>/<UTC-timestamp>/<table>.json  + manifest.json
// Default <out> is ./snapshots

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";

// ---- Tables to snapshot (raw source of truth) ----
const TABLES = [
  "profiles",
  "predictions",
  "group_standings_overrides",
  "third_place_overrides",
];

const PAGE_SIZE = 1000;

function loadEnv() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  return { url, key };
}

async function fetchAll(url, key, table) {
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const rows = [];
  let offset = 0;
  // Order by id for stable, deterministic pagination.
  for (;;) {
    const endpoint =
      `${url}/rest/v1/${table}?select=*&order=id.asc` +
      `&limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetch(endpoint, { headers });
    if (!res.ok) {
      throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
    }
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

function gitSha() {
  try {
    return execSync("git rev-parse HEAD", { cwd: resolve(".") })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

async function main() {
  const outArgIdx = process.argv.indexOf("--out");
  const baseOut = outArgIdx !== -1 ? process.argv[outArgIdx + 1] : "snapshots";

  const { url, key } = loadEnv();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = join(baseOut, stamp);
  mkdirSync(outDir, { recursive: true });

  console.log(`Snapshot -> ${resolve(outDir)}`);
  const manifest = {
    createdAt: new Date().toISOString(),
    gitSha: gitSha(),
    supabaseUrl: url,
    tables: {},
  };

  for (const table of TABLES) {
    process.stdout.write(`  ${table} ... `);
    const rows = await fetchAll(url, key, table);
    const file = join(outDir, `${table}.json`);
    writeFileSync(file, JSON.stringify(rows, null, 2));
    manifest.tables[table] = { count: rows.length, file: `${table}.json` };
    console.log(`${rows.length} rows`);
  }

  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("manifest.json written");
  console.log("\nSnapshot complete:");
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error("Snapshot FAILED:", err.message);
  process.exit(1);
});
