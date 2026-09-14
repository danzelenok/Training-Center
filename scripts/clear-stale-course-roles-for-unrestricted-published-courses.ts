/**
 * One-time cleanup for the "roles move from editor into publish dialog"
 * change (see app/api/courses/[id]/publish/route.ts).
 *
 * Before this change, `course_roles` was written by the course editor and
 * was NEVER what actually decided who a published course was assigned to —
 * the publish dialog's "Specific roles" option kept its own separate,
 * never-persisted role selection. So a course that was actually published
 * unrestricted (assignTo: "all", auto_assign_new_workers = true) can still
 * have leftover `course_roles` rows from whatever was picked in the editor
 * at some point, unrelated to its real publish-time audience.
 *
 * Going forward, `course_roles` is written by the publish route itself and
 * is used to scope which new hires get auto-assigned a course. Left alone,
 * those stale rows would incorrectly start restricting auto-assignment for
 * courses that were actually published to everyone. This clears
 * `course_roles` only for courses we know for certain were published
 * unrestricted — courses published role-restricted or to specific workers
 * already have auto_assign_new_workers = false, so they're unaffected
 * either way and are left untouched.
 *
 * Idempotent — safe to run more than once.
 *
 * Run with:
 *   npx tsx scripts/clear-stale-course-roles-for-unrestricted-published-courses.ts
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

async function main() {
  const affectedCourses = await sql.query(
    `SELECT c.id, c.title
     FROM courses c
     WHERE c.status = 'published' AND c.auto_assign_new_workers = true
       AND EXISTS (SELECT 1 FROM course_roles cr WHERE cr.course_id = c.id)`
  );

  if (affectedCourses.length === 0) {
    console.log("No published, unrestricted courses have stale course_roles rows. Nothing to do.");
    return;
  }

  console.log(`Found ${affectedCourses.length} published, unrestricted course(s) with stale course_roles rows:`);
  for (const course of affectedCourses) {
    console.log(`  - ${course.title} (${course.id})`);
  }

  const result = await sql.query(
    `DELETE FROM course_roles
     WHERE course_id IN (
       SELECT id FROM courses WHERE status = 'published' AND auto_assign_new_workers = true
     )
     RETURNING id`
  );

  console.log(`Deleted ${result.length} stale course_roles row(s).`);
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
