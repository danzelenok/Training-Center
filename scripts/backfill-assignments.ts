/**
 * One-time backfill: marks "Know Your PPE" and "Nail Guns" as auto-assigned
 * and creates an `assignments` row for every current worker on each course,
 * so they keep seeing these two courses after the publish flow switches
 * from implicit (all published courses visible) to explicit assignments.
 *
 * Idempotent — safe to run more than once (assignment inserts are
 * ON CONFLICT (worker_id, course_id) DO NOTHING).
 *
 * Run with:
 *   npx tsx scripts/backfill-assignments.ts
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

const COURSE_TITLES = ["Know Your PPE", "Nail Guns"];

async function main() {
  const courses = await sql.query(
    `SELECT id, title FROM courses WHERE status = 'published' AND title ILIKE ANY($1)`,
    [COURSE_TITLES]
  );

  if (courses.length === 0) {
    console.log("No matching published courses found:", COURSE_TITLES);
    return;
  }

  const workers = await sql.query(`SELECT id FROM workers`);
  console.log(`Found ${courses.length} course(s) and ${workers.length} worker(s).`);

  for (const course of courses) {
    await sql.query(
      `UPDATE courses SET auto_assign_new_workers = true WHERE id = $1`,
      [course.id]
    );

    let created = 0;
    for (const worker of workers) {
      const result = await sql.query(
        `INSERT INTO assignments (worker_id, course_id)
         VALUES ($1, $2)
         ON CONFLICT (worker_id, course_id) DO NOTHING
         RETURNING id`,
        [worker.id, course.id]
      );
      if (result.length > 0) created++;
    }

    console.log(`"${course.title}": auto_assign_new_workers=true, ${created} new assignment(s) created (${workers.length - created} already existed).`);
  }

  console.log("Backfill complete.");
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
