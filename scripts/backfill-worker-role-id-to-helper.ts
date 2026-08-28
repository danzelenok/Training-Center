/**
 * One-time backfill: sets workers.role_id = the 'helper' job role for every
 * worker that currently has no role (role_id IS NULL).
 *
 * Does NOT write an employment_events row — this is a data backfill for
 * existing workers, not a real hiring/role-change event. Each worker already
 * has a synthesized 'hired' event from the earlier worker_status_events
 * migration; that is left untouched.
 *
 * Idempotency / safety: the UPDATE's WHERE clause only ever matches rows
 * still at role_id IS NULL. After this runs, Danil will manually move ~25
 * workers from helper to foreman via the WorkerDetailSheet role-selector in
 * the admin UI (which does write a role_changed event, as normal). Running
 * this script again afterward is safe and a no-op for those workers — once
 * a worker has any role_id set, this WHERE clause no longer matches them,
 * so a second run can never revert a manual foreman reassignment back to
 * helper.
 *
 * Run with:
 *   npx tsx scripts/backfill-worker-role-id-to-helper.ts
 */

import fs from "fs";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";
import { organizations, workers, jobRoles } from "../db/schema";
import { and, eq, isNull } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function main() {
  const allOrgs = await db.select({ id: organizations.id, name: organizations.name }).from(organizations);

  for (const org of allOrgs) {
    const [helperRole] = await db
      .select({ id: jobRoles.id })
      .from(jobRoles)
      .where(and(eq(jobRoles.organizationId, org.id), eq(jobRoles.name, "helper")))
      .limit(1);

    if (!helperRole) {
      console.log(`${org.name}: no 'helper' role found — skipping (not creating one, per script scope).`);
      continue;
    }

    const updated = await db
      .update(workers)
      .set({ roleId: helperRole.id, updatedAt: new Date() })
      .where(and(eq(workers.organizationId, org.id), isNull(workers.roleId)))
      .returning({ id: workers.id });

    console.log(`${org.name}: ${updated.length} worker(s) set to 'helper' (role_id was NULL).`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
