import { db } from "@/db";
import { courses, progress, assignments, courseRoles } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withTelegramAuth } from "@/lib/telegram";
import { computeAssignmentDueDate } from "@/lib/dates";
import { getLatestRunId } from "@/lib/courseRuns";

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
    const runIdByCourseId = new Map(
      (await Promise.all(eligibleCourses.map(async (c) => [c.id, await getLatestRunId(c.id)] as const)))
        .filter((entry): entry is [string, string] => entry[1] !== null)
    );
    const toInsert = eligibleCourses
      .filter((c) => runIdByCourseId.has(c.id))
      .map((c) => ({ workerId: worker.id, courseId: c.id, runId: runIdByCourseId.get(c.id)!, assignedAt, dueDate }));
    if (toInsert.length > 0) {
      await db.insert(assignments).values(toInsert).onConflictDoNothing({ target: [assignments.workerId, assignments.runId] });
    }
  }

  // A worker can have more than one assignment for the same course across
  // runs (a retaken compliance course) — for each course, only the most
  // recent assignment is what the worker currently acts on; older runs'
  // history belongs to the admin report, not this list.
  const workerAssignments = await db
    .select({ courseId: assignments.courseId, runId: assignments.runId, assignedAt: assignments.assignedAt })
    .from(assignments)
    .where(eq(assignments.workerId, worker.id));

  const latestByCourseId = new Map<string, { runId: string; assignedAt: Date }>();
  for (const a of workerAssignments) {
    const existing = latestByCourseId.get(a.courseId);
    if (!existing || a.assignedAt > existing.assignedAt) {
      latestByCourseId.set(a.courseId, { runId: a.runId, assignedAt: a.assignedAt });
    }
  }

  if (latestByCourseId.size === 0) {
    return NextResponse.json([]);
  }

  // Visibility of an already-assigned course is governed by the assignment
  // itself (latestByCourseId, above — scoped to this worker), not by whether
  // the course's owner jurisdiction still matches the worker's CURRENT
  // jurisdiction. A worker reassigned to a different state after being
  // assigned a course (e.g. a relocation) must keep seeing it — jurisdiction
  // only decides who gets assigned going forward (see the auto-assign
  // eligibility filter above), never whether an existing assignment is shown.
  const courseRows = await db
    .select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      publishedAt: courses.publishedAt,
      createdAt: courses.createdAt,
    })
    .from(courses)
    .where(and(
      inArray(courses.id, [...latestByCourseId.keys()]),
      eq(courses.status, "published"),
      eq(courses.organizationId, worker.organizationId)
    ));

  const progressRows = await db
    .select({ runId: progress.runId, status: progress.status, currentSlideIndex: progress.currentSlideIndex })
    .from(progress)
    .where(and(
      eq(progress.workerId, worker.id),
      inArray(progress.runId, [...latestByCourseId.values()].map((v) => v.runId))
    ));
  const progressByRunId = new Map(progressRows.map((p) => [p.runId, p]));

  const result = courseRows
    .map((c) => {
      const latest = latestByCourseId.get(c.id)!;
      const p = progressByRunId.get(latest.runId);
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        progressStatus: p?.status ?? "not_started",
        currentSlideIndex: p?.currentSlideIndex ?? 0,
        sortDate: c.publishedAt ?? c.createdAt,
      };
    })
    .sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())
    .map(({ sortDate, ...rest }) => rest);

  return NextResponse.json(result);
});
