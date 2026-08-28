/**
 * One-time backfill from `worker_status_events` into `employment_events`:
 *   - every worker gets a synthesized `hired` event at their `created_at`
 *     (no real hire event exists today — the old table only tracked
 *     active/deactivated toggles, never creation)
 *   - every `worker_status_events` row becomes a `deactivated` (status was
 *     'deactivated') or `reactivated` (status was 'active') event at the
 *     same `changed_at`
 *
 * All backfilled rows get newRoleId = null and createdByAdminId = null —
 * there's no role data or admin attribution to recover for historical rows.
 *
 * Idempotent: before each insert, checks whether an employment_events row
 * with the same (workerId, eventType, eventDate) already exists and skips
 * it if so. This is an application-level check, not a DB constraint —
 * employment_events is intentionally an unconstrained append-only log.
 *
 * Run with:
 *   npx tsx scripts/migrate-worker-status-events-to-employment-events.ts
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

// Import the neon/drizzle client directly rather than "../db" — that module
// pulls in "@/env", whose validation runs at import time via a hoisted
// `import`, before the loadEnvFile() calls above would ever take effect.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";
import { workers, workerStatusEvents, employmentEvents } from "../db/schema";
import { and, eq } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function alreadyExists(workerId: string, eventType: "hired" | "deactivated" | "reactivated", eventDate: Date) {
  const [row] = await db
    .select({ id: employmentEvents.id })
    .from(employmentEvents)
    .where(
      and(
        eq(employmentEvents.workerId, workerId),
        eq(employmentEvents.eventType, eventType),
        eq(employmentEvents.eventDate, eventDate)
      )
    )
    .limit(1);
  return !!row;
}

async function main() {
  const allWorkers = await db.select({ id: workers.id, createdAt: workers.createdAt }).from(workers);

  let hiredInserted = 0;
  let hiredSkipped = 0;
  for (const w of allWorkers) {
    if (await alreadyExists(w.id, "hired", w.createdAt)) {
      hiredSkipped++;
      continue;
    }
    await db.insert(employmentEvents).values({
      workerId: w.id,
      eventType: "hired",
      eventDate: w.createdAt,
      newRoleId: null,
      createdByAdminId: null,
      note: "Backfilled from workers.created_at during employment_events migration",
    });
    hiredInserted++;
  }

  const statusEvents = await db
    .select({ workerId: workerStatusEvents.workerId, status: workerStatusEvents.status, changedAt: workerStatusEvents.changedAt })
    .from(workerStatusEvents);

  let statusInserted = 0;
  let statusSkipped = 0;
  for (const e of statusEvents) {
    const eventType = e.status === "active" ? "reactivated" : "deactivated";
    if (await alreadyExists(e.workerId, eventType, e.changedAt)) {
      statusSkipped++;
      continue;
    }
    await db.insert(employmentEvents).values({
      workerId: e.workerId,
      eventType,
      eventDate: e.changedAt,
      newRoleId: null,
      createdByAdminId: null,
      note: "Backfilled from worker_status_events during employment_events migration",
    });
    statusInserted++;
  }

  console.log(`hired: ${hiredInserted} inserted, ${hiredSkipped} already present`);
  console.log(`deactivated/reactivated: ${statusInserted} inserted, ${statusSkipped} already present`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
