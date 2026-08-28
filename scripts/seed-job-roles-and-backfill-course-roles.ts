/**
 * One-time seed + backfill for job_roles / course_roles:
 *   - ensures every organization has 'helper' and 'foreman' job roles
 *     (the only two roles confirmed to exist today — not invented, per
 *     the task spec)
 *   - links every existing course (published AND draft — confirmed: a
 *     draft course also needs a role before it can eventually be
 *     published) to both roles
 *
 * Idempotent: role creation uses onConflictDoNothing on the
 * (organizationId, name) unique constraint; course_roles inserts use
 * onConflictDoNothing on the (courseId, roleId) unique constraint.
 *
 * Run with:
 *   npx tsx scripts/seed-job-roles-and-backfill-course-roles.ts
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
import { organizations, courses, jobRoles, courseRoles } from "../db/schema";
import { eq } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const ROLE_NAMES = ["helper", "foreman"] as const;

async function main() {
  const allOrgs = await db.select({ id: organizations.id, name: organizations.name }).from(organizations);

  for (const org of allOrgs) {
    for (const name of ROLE_NAMES) {
      await db
        .insert(jobRoles)
        .values({ organizationId: org.id, name })
        .onConflictDoNothing({ target: [jobRoles.organizationId, jobRoles.name] });
    }

    // Fetch by name rather than trusting the inserts above, so this covers
    // both the just-inserted and the already-existing case uniformly.
    const orgRoles = await db
      .select({ id: jobRoles.id, name: jobRoles.name })
      .from(jobRoles)
      .where(eq(jobRoles.organizationId, org.id));
    const roleIdByName = new Map(orgRoles.map((r) => [r.name, r.id]));

    const targetRoleIds = ROLE_NAMES.map((n) => roleIdByName.get(n)).filter((id): id is string => !!id);

    const orgCourses = await db.select({ id: courses.id }).from(courses).where(eq(courses.organizationId, org.id));

    let linksInserted = 0;
    for (const course of orgCourses) {
      for (const roleId of targetRoleIds) {
        const [inserted] = await db
          .insert(courseRoles)
          .values({ courseId: course.id, roleId })
          .onConflictDoNothing({ target: [courseRoles.courseId, courseRoles.roleId] })
          .returning({ id: courseRoles.id });
        if (inserted) linksInserted++;
      }
    }

    console.log(
      `${org.name}: roles ensured [${ROLE_NAMES.join(", ")}], ${orgCourses.length} courses, ${linksInserted} new course-role links inserted`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
