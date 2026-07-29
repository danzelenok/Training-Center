/**
 * One-time backfill for multi-tenancy: creates the Clerk organization for the
 * current (single) tenant, grants the admin membership, creates the matching
 * `organizations` row, and backfills `organization_id` on every existing
 * workers/courses/teams/media_files row.
 *
 * Idempotent — if an `organizations` row already exists, no new Clerk
 * organization is created; the script only re-runs the row backfill
 * (guarded on `organization_id IS NULL`).
 *
 * Requires SEED_CLERK_ADMIN_USER_ID (Clerk user id to grant org:admin to) in
 * the environment. Does not hardcode or resolve any manually-created org.
 *
 * Run with:
 *   npx tsx scripts/backfill-organizations.ts
 */

import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";
import { createClerkClient } from "@clerk/backend";

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
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const SEED_CLERK_ADMIN_USER_ID = process.env.SEED_CLERK_ADMIN_USER_ID;
const ORG_NAME = process.env.SEED_ORG_NAME || "Cool Cat Training";

if (!DATABASE_URL) {
  console.error("DATABASE_URL not found in environment.");
  process.exit(1);
}
if (!CLERK_SECRET_KEY) {
  console.error("CLERK_SECRET_KEY not found in environment.");
  process.exit(1);
}
if (!SEED_CLERK_ADMIN_USER_ID) {
  console.error("SEED_CLERK_ADMIN_USER_ID not found in environment.");
  process.exit(1);
}
const adminUserId: string = SEED_CLERK_ADMIN_USER_ID;

const sql = neon(DATABASE_URL);
const clerkClient = createClerkClient({ secretKey: CLERK_SECRET_KEY });

async function main() {
  const [existing] = await sql.query(`SELECT id, clerk_org_id, name FROM organizations LIMIT 1`);

  let orgId: string;
  let clerkOrgId: string;

  if (existing) {
    orgId = existing.id;
    clerkOrgId = existing.clerk_org_id;
    console.log(`Organization already exists: ${existing.name} (${orgId}, clerk: ${clerkOrgId}). Skipping Clerk creation.`);
  } else {
    const clerkOrg = await clerkClient.organizations.createOrganization({ name: ORG_NAME });
    clerkOrgId = clerkOrg.id;
    console.log(`Created Clerk organization "${ORG_NAME}" (${clerkOrgId}).`);

    await clerkClient.organizations.createOrganizationMembership({
      organizationId: clerkOrgId,
      userId: adminUserId,
      role: "org:admin",
    });
    console.log(`Granted org:admin membership to ${adminUserId}.`);

    const [row] = await sql.query(
      `INSERT INTO organizations (clerk_org_id, name) VALUES ($1, $2) RETURNING id`,
      [clerkOrgId, ORG_NAME]
    );
    orgId = row.id;
    console.log(`Created organizations row (${orgId}).`);
  }

  const tables = ["workers", "courses", "teams", "media_files"];
  for (const table of tables) {
    const result = await sql.query(
      `UPDATE ${table} SET organization_id = $1 WHERE organization_id IS NULL RETURNING id`,
      [orgId]
    );
    console.log(`${table}: backfilled ${result.length} row(s).`);
  }

  console.log("Backfill complete.");
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
