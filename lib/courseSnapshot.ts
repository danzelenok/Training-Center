import { db } from "@/db";
import { courses, workers, employmentEvents, jobRoles, jurisdictions, progress } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export interface CourseSnapshotWorkerResult {
  workerId: string;
  workerName: string;
  roleId: string | null;
  roleName: string | null;
  jurisdictionId: string | null;
  jurisdictionCode: string | null;
  jurisdictionName: string | null;
  status: "not_started" | "in_progress" | "completed";
  completedAt: Date | null;
  quizScore: number | null;
}

export interface CourseSnapshotResult {
  course: { id: string; title: string; publishedAt: Date };
  workers: CourseSnapshotWorkerResult[];
}

export class CourseNotPublishedError extends Error {}

/**
 * Reconstructs the active workforce as of a course's publishedAt date, using
 * employment_events as the source of truth for who was hired/active and what
 * role they held at that date. Jurisdiction is NOT reconstructed historically
 * — workers.jurisdiction_id has no versioning (same gap team had before it
 * was removed), so this always reflects the worker's CURRENT jurisdiction,
 * labeled as such by callers, never presented as "jurisdiction on date X".
 *
 * A worker with no role-bearing event (hired.newRoleId or role_changed) at or
 * before the snapshot date gets roleId/roleName = null — the caller renders
 * this as "Role unknown", not a guess and not the worker's current role.
 */
export async function getCourseSnapshot(orgId: string, courseId: string): Promise<CourseSnapshotResult | null> {
  const [course] = await db
    .select({ id: courses.id, title: courses.title, publishedAt: courses.publishedAt })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.organizationId, orgId)))
    .limit(1);

  if (!course) return null;
  if (!course.publishedAt) {
    throw new CourseNotPublishedError("Course has not been published yet — no snapshot date exists.");
  }
  const publishedAt = course.publishedAt;

  const orgWorkers = await db
    .select({
      id: workers.id,
      firstName: workers.firstName,
      lastName: workers.lastName,
      displayName: workers.displayName,
      jurisdictionId: workers.jurisdictionId,
    })
    .from(workers)
    .where(eq(workers.organizationId, orgId));

  if (orgWorkers.length === 0) {
    return { course: { id: course.id, title: course.title, publishedAt }, workers: [] };
  }

  const workerIds = orgWorkers.map((w) => w.id);

  const events = await db
    .select({
      workerId: employmentEvents.workerId,
      eventType: employmentEvents.eventType,
      eventDate: employmentEvents.eventDate,
      newRoleId: employmentEvents.newRoleId,
    })
    .from(employmentEvents)
    .where(inArray(employmentEvents.workerId, workerIds))
    .orderBy(employmentEvents.eventDate);

  const eventsByWorker = new Map<string, typeof events>();
  for (const e of events) {
    const list = eventsByWorker.get(e.workerId) ?? [];
    list.push(e);
    eventsByWorker.set(e.workerId, list);
  }

  const roleRows = await db.select({ id: jobRoles.id, name: jobRoles.name }).from(jobRoles).where(eq(jobRoles.organizationId, orgId));
  const roleNameById = new Map(roleRows.map((r) => [r.id, r.name]));

  const jurisdictionRows = await db.select({ id: jurisdictions.id, code: jurisdictions.code, name: jurisdictions.name }).from(jurisdictions);
  const jurisdictionById = new Map(jurisdictionRows.map((j) => [j.id, j]));

  const progressRows = await db
    .select({ workerId: progress.workerId, status: progress.status, completedAt: progress.completedAt, quizScore: progress.quizScore })
    .from(progress)
    .where(and(eq(progress.courseId, courseId), inArray(progress.workerId, workerIds)));
  const progressByWorker = new Map(progressRows.map((p) => [p.workerId, p]));

  const snapshotWorkers: CourseSnapshotWorkerResult[] = [];

  for (const w of orgWorkers) {
    const workerEvents = eventsByWorker.get(w.id) ?? [];

    const hiredEvent = workerEvents.find((e) => e.eventType === "hired");
    if (!hiredEvent || hiredEvent.eventDate > publishedAt) continue; // not yet hired as of the snapshot date

    const statusEventsBefore = workerEvents.filter(
      (e) => (e.eventType === "deactivated" || e.eventType === "reactivated") && e.eventDate <= publishedAt
    );
    const lastStatusEvent = statusEventsBefore[statusEventsBefore.length - 1];
    const activeAtSnapshot = !lastStatusEvent || lastStatusEvent.eventType === "reactivated";
    if (!activeAtSnapshot) continue; // deactivated by the snapshot date — not part of the workforce then

    const roleEventsBefore = workerEvents.filter(
      (e) => (e.eventType === "hired" || e.eventType === "role_changed") && e.newRoleId !== null && e.eventDate <= publishedAt
    );
    const lastRoleEvent = roleEventsBefore[roleEventsBefore.length - 1];
    const roleId = lastRoleEvent ? lastRoleEvent.newRoleId : null;

    const jurisdiction = w.jurisdictionId ? jurisdictionById.get(w.jurisdictionId) : null;
    const workerProgress = progressByWorker.get(w.id);

    snapshotWorkers.push({
      workerId: w.id,
      workerName: w.displayName || [w.firstName, w.lastName].filter(Boolean).join(" ") || "Unnamed Worker",
      roleId,
      roleName: roleId ? roleNameById.get(roleId) ?? null : null,
      jurisdictionId: w.jurisdictionId,
      jurisdictionCode: jurisdiction?.code ?? null,
      jurisdictionName: jurisdiction?.name ?? null,
      status: workerProgress?.status ?? "not_started",
      completedAt: workerProgress?.completedAt ?? null,
      quizScore: workerProgress?.quizScore ?? null,
    });
  }

  return { course: { id: course.id, title: course.title, publishedAt }, workers: snapshotWorkers };
}
