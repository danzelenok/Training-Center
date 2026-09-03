/**
 * One-time backfill: sets assignments.due_date = addBusinessDays(assigned_at, 5)
 * for every assignments row where due_date IS NULL — i.e. every assignment
 * created before this feature's migration added the column.
 *
 * Idempotent: only ever touches rows still matching `due_date IS NULL`;
 * running it twice is a no-op the second time.
 *
 * Run with:
 *   npx tsx scripts/backfill-assignment-due-dates.ts
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
import { assignments } from "../db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { computeAssignmentDueDate } from "../lib/dates";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function main() {
  const rows = await db
    .select({ id: assignments.id, assignedAt: assignments.assignedAt })
    .from(assignments)
    .where(isNull(assignments.dueDate));

  console.log(`Found ${rows.length} assignment(s) with NULL due_date.`);

  let updated = 0;
  for (const row of rows) {
    await db
      .update(assignments)
      .set({ dueDate: computeAssignmentDueDate(row.assignedAt), updatedAt: new Date() })
      .where(and(eq(assignments.id, row.id), isNull(assignments.dueDate)));
    updated++;
  }

  console.log(`Backfill complete: ${updated} row(s) updated.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
