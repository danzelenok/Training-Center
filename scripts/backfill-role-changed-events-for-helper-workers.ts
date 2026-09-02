/**
 * One-time backfill: writes a `role_changed` employment_events row for every
 * worker who has no employment_events row with newRoleId set at all.
 *
 * Why: scripts/backfill-worker-role-id-to-helper.ts set workers.role_id
 * directly for every NULL-role worker, deliberately without an
 * employment_events row (see that script's docstring). That leaves
 * courseSnapshot.ts's role reconstruction — which reads only
 * employment_events — unable to find a role for any of those workers as of
 * a course's publishedAt, even for courses published well after that
 * backfill, when the role was in fact already stable. This is not
 * inventing a role-change date we don't know; the date recorded here is
 * exactly when the system first learned the worker's role (the backfill
 * script's own UPDATE), so it is honest and technically correct — a data
 * hole being closed, not history being rewritten.
 *
 * BACKFILL_DATE is 2026-08-29T03:58:48.748Z: 59 of the 70 affected workers
 * share this exact workers.updated_at value to the millisecond (one
 * `UPDATE ... SET updated_at = new Date()` statement in that script,
 * confirmed against org "Cool Cat Training" only having one org row, so
 * one UPDATE call). The remaining 11 have a later updated_at because of
 * unrelated edits since (deactivation/reactivation, jurisdiction changes,
 * etc.) but were all created before this timestamp — they were part of the
 * same original mass update, we just no longer have their original
 * updated_at once something else touched the row. Cross-checked against
 * git log for that script (committed 2026-08-28T21:02:14Z, ~7h earlier,
 * same evening) as a sanity check, not as the source of truth.
 *
 * Scope: only workers with zero role-bearing employment_events rows.
 * Workers who already have one (manually moved helper -> foreman via the
 * admin UI, which does write a role_changed event) are left untouched —
 * their history is already correct.
 *
 * Idempotency: the worker selection itself is self-limiting — once a
 * worker has this backfilled role_changed row, they have a role-bearing
 * event and no longer match the "zero role-bearing events" selection on a
 * second run. On top of that, each insert is still guarded by an explicit
 * existence check on (workerId, eventType, eventDate), matching the
 * pattern in migrate-worker-status-events-to-employment-events.ts.
 *
 * Run with:
 *   npx tsx scripts/backfill-role-changed-events-for-helper-workers.ts
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
import { workers, employmentEvents } from "../db/schema";
import { and, eq, isNotNull, notInArray } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const BACKFILL_DATE = new Date("2026-08-29T03:58:48.748Z");

async function alreadyExists(workerId: string, eventDate: Date) {
  const [row] = await db
    .select({ id: employmentEvents.id })
    .from(employmentEvents)
    .where(
      and(
        eq(employmentEvents.workerId, workerId),
        eq(employmentEvents.eventType, "role_changed"),
        eq(employmentEvents.eventDate, eventDate)
      )
    )
    .limit(1);
  return !!row;
}

async function main() {
  const workersWithRoleEvent = await db
    .selectDistinct({ workerId: employmentEvents.workerId })
    .from(employmentEvents)
    .where(isNotNull(employmentEvents.newRoleId));

  const excludedIds = workersWithRoleEvent.map((w) => w.workerId);

  const candidates = await db
    .select({ id: workers.id, roleId: workers.roleId })
    .from(workers)
    .where(excludedIds.length > 0 ? notInArray(workers.id, excludedIds) : undefined);

  let inserted = 0;
  let skippedExisting = 0;
  let skippedNoRole = 0;

  for (const w of candidates) {
    if (!w.roleId) {
      console.log(`Worker ${w.id}: no role_id set — skipping (nothing to record).`);
      skippedNoRole++;
      continue;
    }

    if (await alreadyExists(w.id, BACKFILL_DATE)) {
      skippedExisting++;
      continue;
    }

    await db.insert(employmentEvents).values({
      workerId: w.id,
      eventType: "role_changed",
      eventDate: BACKFILL_DATE,
      newRoleId: w.roleId,
      createdByAdminId: null,
      note: "Backfilled: role established via scripts/backfill-worker-role-id-to-helper.ts; eventDate is that script's execution time, not a real role-change date.",
    });
    inserted++;
  }

  console.log(`role_changed backfill: ${inserted} inserted, ${skippedExisting} already present, ${skippedNoRole} skipped (no role_id).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
