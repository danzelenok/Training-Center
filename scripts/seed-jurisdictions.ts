/**
 * One-time seed + backfill for multi-jurisdiction support:
 *   - inserts WA/OR/CA/FEDERAL into `jurisdictions` (FEDERAL is the only
 *     is_state_plan = false record — a base source, not an assignable state)
 *   - links every existing organization to the three state-plan jurisdictions
 *     in `organization_jurisdictions` (FEDERAL is never linked — orgs don't
 *     "operate in" the federal jurisdiction, it's just a grounding source)
 *   - backfills `workers.jurisdiction_id` to WA for any worker missing it
 *
 * Idempotent — safe to run more than once (jurisdiction insert is ON CONFLICT (code)
 * DO NOTHING, org links are ON CONFLICT (organization_id, jurisdiction_id) DO NOTHING,
 * worker backfill only touches rows WHERE jurisdiction_id IS NULL).
 *
 * Run with:
 *   npx tsx scripts/seed-jurisdictions.ts
 */

import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";

// ─── Load .env.local ─────────────────────────────────────────────────────────
function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const root = path.resolve(process.cwd());
loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not found in environment.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const JURISDICTIONS = [
  {
    code: "WA",
    name: "Washington L&I",
    regulatorName: "Washington State L&I",
    baseSourceUrl: "https://www.lni.wa.gov",
    isStatePlan: true,
  },
  {
    code: "OR",
    name: "Oregon OSHA",
    regulatorName: "Oregon OSHA",
    baseSourceUrl: "https://osha.oregon.gov",
    isStatePlan: true,
  },
  {
    code: "CA",
    name: "Cal/OSHA",
    regulatorName: "Cal/OSHA",
    baseSourceUrl: "https://www.dir.ca.gov/dosh",
    isStatePlan: true,
  },
  {
    code: "FEDERAL",
    name: "Federal OSHA",
    regulatorName: "Occupational Safety and Health Administration",
    baseSourceUrl: "https://www.osha.gov",
    isStatePlan: false,
  },
] as const;

async function main() {
  // 1. Seed jurisdictions
  const jurisdictionIds: Record<string, string> = {};
  for (const j of JURISDICTIONS) {
    const [row] = await sql.query(
      `INSERT INTO jurisdictions (code, name, regulator_name, base_source_url, is_state_plan)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (code) DO UPDATE SET is_state_plan = EXCLUDED.is_state_plan
       RETURNING id`,
      [j.code, j.name, j.regulatorName, j.baseSourceUrl, j.isStatePlan]
    );
    jurisdictionIds[j.code] = row.id;
    console.log(`Jurisdiction ${j.code}: ${row.id}`);
  }

  // 2. Link every existing organization to the state-plan jurisdictions only
  // (FEDERAL is a base source, not a state an org "operates in")
  const organizations = await sql.query(`SELECT id, name FROM organizations`);
  console.log(`Found ${organizations.length} organization(s).`);

  const statePlanCodes = JURISDICTIONS.filter((j) => j.isStatePlan).map((j) => j.code);

  for (const org of organizations) {
    let linked = 0;
    for (const code of statePlanCodes) {
      const result = await sql.query(
        `INSERT INTO organization_jurisdictions (organization_id, jurisdiction_id)
         VALUES ($1, $2)
         ON CONFLICT (organization_id, jurisdiction_id) DO NOTHING
         RETURNING id`,
        [org.id, jurisdictionIds[code]]
      );
      if (result.length > 0) linked++;
    }
    console.log(`Organization "${org.name}": ${linked} new jurisdiction link(s) created.`);
  }

  // 3. Backfill existing workers to WA
  const backfillResult = await sql.query(
    `UPDATE workers SET jurisdiction_id = $1 WHERE jurisdiction_id IS NULL RETURNING id`,
    [jurisdictionIds["WA"]]
  );
  console.log(`Backfilled ${backfillResult.length} worker(s) to WA.`);

  const [{ count }] = await sql.query(`SELECT count(*) FROM workers WHERE jurisdiction_id IS NULL`);
  console.log(`Workers still missing jurisdiction_id: ${count}`);

  console.log("Seed complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
