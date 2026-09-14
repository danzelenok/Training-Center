import { db } from "@/db";
import { courses, progress, assignments, courseRoles } from "@/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withTelegramAuth } from "@/lib/telegram";
import { computeAssignmentDueDate } from "@/lib/dates";

// A course only counts as "this week's training" for a brand-new worker if it
// was published within a week of the worker's hire date in either direction.
// Older courses are picked up later through a regular re-assignment cycle instead.
const AUTO_ASSIGN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const GET = withTelegramAuth(async (_req, { worker }) => {
  // Idempotently assign any courses marked autoAssignNewWorkers=true that were
  // published close to this worker's hire date. For existing workers, or
  // courses published long before/after they were hired, this is a no-op.
  const autoAssignCourses = await db
    .select({ id: courses.id, publishedAt: courses.publishedAt, createdAt: courses.createdAt, ownerJurisdictionId: courses.ownerJurisdictionId })
    .from(courses)
    .where(
      and(
        eq(courses.organizationId, worker.organizationId),
        eq(courses.autoAssignNewWorkers, true),
        eq(courses.status, "published")
      )
    );

  const dateEligibleCourses = autoAssignCourses.filter((c) => {
    if (c.ownerJurisdictionId !== worker.jurisdictionId) return false;
    const publishDate = c.publishedAt ?? c.createdAt;
    return Math.abs(worker.createdAt.getTime() - new Date(publishDate).getTime()) <= AUTO_ASSIGN_WINDOW_MS;
  });

  // A course scoped to specific roles at publish time (course_roles rows
  // present) should only auto-assign new hires matching one of those roles;
  // a course with no course_roles rows is unrestricted.
  const scopedRoleRows = dateEligibleCourses.length > 0
    ? await db
        .select({ courseId: courseRoles.courseId, roleId: courseRoles.roleId })
        .from(courseRoles)
        .where(inArray(courseRoles.courseId, dateEligibleCourses.map((c) => c.id)))
    : [];
  const scopedRoleIdsByCourse = new Map<string, string[]>();
  for (const row of scopedRoleRows) {
    const list = scopedRoleIdsByCourse.get(row.courseId) ?? [];
    list.push(row.roleId);
    scopedRoleIdsByCourse.set(row.courseId, list);
  }
  const eligibleCourses = dateEligibleCourses.filter((c) => {
    const scopedRoleIds = scopedRoleIdsByCourse.get(c.id);
    if (!scopedRoleIds || scopedRoleIds.length === 0) return true;
    return !!worker.roleId && scopedRoleIds.includes(worker.roleId);
  });

  if (eligibleCourses.length > 0) {
    const assignedAt = new Date();
    const dueDate = computeAssignmentDueDate(assignedAt);
    await db
      .insert(assignments)
      .values(eligibleCourses.map((c) => ({ workerId: worker.id, courseId: c.id, assignedAt, dueDate })))
      .onConflictDoNothing();
  }

  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      progressStatus: progress.status,
      currentSlideIndex: progress.currentSlideIndex,
    })
    .from(assignments)
    .innerJoin(
      courses,
      and(
        eq(courses.id, assignments.courseId),
        eq(courses.status, "published"),
        eq(courses.organizationId, worker.organizationId),
        eq(courses.ownerJurisdictionId, worker.jurisdictionId)
      )
    )
    .leftJoin(
      progress,
      and(eq(progress.courseId, assignments.courseId), eq(progress.workerId, worker.id))
    )
    .where(eq(assignments.workerId, worker.id))
    .orderBy(desc(sql`coalesce(${courses.publishedAt}, ${courses.createdAt})`));

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      progressStatus: r.progressStatus ?? "not_started",
      currentSlideIndex: r.currentSlideIndex ?? 0,
    }))
  );
});
