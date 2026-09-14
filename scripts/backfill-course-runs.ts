/**
 * One-time backfill: for every published course that has no course_runs row
 * yet, creates a "run #1" retroactively — courseId + course.publishedAt +
 * createdByAdminId = Danil Shustov's Clerk id (the org_admin who published
 * all pre-course_runs courses; verified against admin_roles/Clerk, not
 * guessed), then:
 *   - copies that course's current course_roles into course_run_roles for
 *     the new run, as a frozen role-name snapshot (no FK — a role rename or
 *     delete later must never alter this history);
 *   - points every existing assignments/progress row for that courseId with
 *     a NULL run_id at the new run.
 *
 * Idempotent: a course that already has a course_runs row is skipped
 * entirely (never creates a second "run #1"), and only rows still matching
 * `run_id IS NULL` are ever touched — running it twice is a no-op the
 * second time.
 *
 * Run with:
 *   npx tsx scripts/backfill-course-runs.ts
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
import { courses, courseRuns, courseRunRoles, courseRoles, jobRoles, assignments, progress } from "../db/schema";
import { and, eq, isNull, notInArray } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

// Confirmed via Clerk Backend API + admin_roles cross-check: the sole
// org_admin in this org, who published every one of the 11 pre-course_runs
// courses.
const BACKFILL_ADMIN_ID = "user_3IVzpyqVxtclP71K9L6Q5oXm9Co";

async function main() {
  const coursesWithRuns = await db.selectDistinct({ courseId: courseRuns.courseId }).from(courseRuns);
  const courseIdsWithRuns = coursesWithRuns.map((c) => c.courseId);

  const candidateCourses = await db
    .select({ id: courses.id, title: courses.title, publishedAt: courses.publishedAt, createdAt: courses.createdAt })
    .from(courses)
    .where(
      and(
        eq(courses.status, "published"),
        courseIdsWithRuns.length > 0 ? notInArray(courses.id, courseIdsWithRuns) : undefined
      )
    );

  console.log(`Found ${candidateCourses.length} published course(s) with no course_runs row yet.`);

  for (const course of candidateCourses) {
    const publishedAt = course.publishedAt ?? course.createdAt;

    const [run] = await db
      .insert(courseRuns)
      .values({ courseId: course.id, publishedAt, createdByAdminId: BACKFILL_ADMIN_ID })
      .returning();

    const roleRows = await db
      .select({ roleName: jobRoles.name })
      .from(courseRoles)
      .innerJoin(jobRoles, eq(jobRoles.id, courseRoles.roleId))
      .where(eq(courseRoles.courseId, course.id));

    if (roleRows.length > 0) {
      await db
        .insert(courseRunRoles)
        .values(roleRows.map((r) => ({ courseRunId: run.id, roleName: r.roleName })))
        .onConflictDoNothing({ target: [courseRunRoles.courseRunId, courseRunRoles.roleName] });
    }

    const assignmentsResult = await db
      .update(assignments)
      .set({ runId: run.id, updatedAt: new Date() })
      .where(and(eq(assignments.courseId, course.id), isNull(assignments.runId)))
      .returning({ id: assignments.id });

    const progressResult = await db
      .update(progress)
      .set({ runId: run.id, updatedAt: new Date() })
      .where(and(eq(progress.courseId, course.id), isNull(progress.runId)))
      .returning({ id: progress.id });

    console.log(
      `"${course.title}" (${course.id}) -> run ${run.id}: ${roleRows.length} role(s) snapshotted, ` +
        `${assignmentsResult.length} assignment(s), ${progressResult.length} progress row(s) linked.`
    );
  }

  console.log("Backfill complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
