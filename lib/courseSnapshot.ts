import { db } from "@/db";
import { courses, workers, employmentEvents, jobRoles, jurisdictions, progress, assignments, courseRuns } from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";

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
  runId: string;
  workers: CourseSnapshotWorkerResult[];
}

export interface CourseRunSummary {
  id: string;
  publishedAt: Date;
}

export class CourseNotPublishedError extends Error {}

export type CourseSnapshotStatusFilter = "all" | "not_completed" | "not_started" | "in_progress" | "completed";

const VALID_STATUS_FILTERS = new Set<CourseSnapshotStatusFilter>([
  "all",
  "not_completed",
  "not_started",
  "in_progress",
  "completed",
]);

export function parseCourseSnapshotStatusFilter(raw: string | null): CourseSnapshotStatusFilter {
  return raw && VALID_STATUS_FILTERS.has(raw as CourseSnapshotStatusFilter) ? (raw as CourseSnapshotStatusFilter) : "all";
}

/** "not_completed" covers not_started + in_progress — the common "who hasn't finished yet" view. */
export function filterSnapshotWorkersByStatus(
  workersList: CourseSnapshotWorkerResult[],
  status: CourseSnapshotStatusFilter
): CourseSnapshotWorkerResult[] {
  if (status === "all") return workersList;
  if (status === "not_completed") return workersList.filter((w) => w.status !== "completed");
  return workersList.filter((w) => w.status === status);
}

/**
 * All runs of a course, newest first — for a run-picker in the report UI.
 * Empty for a course that's never been published (or hasn't gone through
 * the course_runs backfill yet).
 */
export async function listCourseRuns(orgId: string, courseId: string): Promise<CourseRunSummary[]> {
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.organizationId, orgId)))
    .limit(1);
  if (!course) return [];

  return db
    .select({ id: courseRuns.id, publishedAt: courseRuns.publishedAt })
    .from(courseRuns)
    .where(eq(courseRuns.courseId, courseId))
    .orderBy(desc(courseRuns.publishedAt));
}

/**
 * Reconstructs, for workers actually assigned ONE specific run of this
 * course (an assignments row for this runId — via publish-time targeting or
 * auto-assign of new hires into that run), the workforce as of that run's
 * publishedAt date, using employment_events as the source of truth for who
 * was hired/active and what role they held at that date. A worker with no
 * assignment for this run never appears here, regardless of
 * activity/jurisdiction/role — including a worker who only took an earlier
 * or later run of the same course.
 *
 * `runId` selects which run to snapshot; omitted (or null), it defaults to
 * the course's most recently published run. Passing a runId that doesn't
 * belong to this course is treated as "no such run" (returns null), same as
 * an unknown courseId.
 *
 * Jurisdiction is NOT reconstructed historically — workers.jurisdiction_id
 * has no versioning (same gap team had before it was removed), so this
 * always reflects the worker's CURRENT jurisdiction,
 * labeled as such by callers, never presented as "jurisdiction on date X".
 *
 * A worker with no role-bearing event (hired.newRoleId or role_changed) at or
 * before the snapshot date gets roleId/roleName = null — the caller renders
 * this as "Role unknown", not a guess and not the worker's current role.
 */
export async function getCourseSnapshot(orgId: string, courseId: string, runId?: string | null): Promise<CourseSnapshotResult | null> {
  const [course] = await db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.organizationId, orgId)))
    .limit(1);

  if (!course) return null;

  const [run] = runId
    ? await db
        .select({ id: courseRuns.id, publishedAt: courseRuns.publishedAt })
        .from(courseRuns)
        .where(and(eq(courseRuns.id, runId), eq(courseRuns.courseId, courseId)))
        .limit(1)
    : await db
        .select({ id: courseRuns.id, publishedAt: courseRuns.publishedAt })
        .from(courseRuns)
        .where(eq(courseRuns.courseId, courseId))
        .orderBy(desc(courseRuns.publishedAt))
        .limit(1);

  if (runId && !run) return null;
  if (!run) {
    throw new CourseNotPublishedError("Course has not been published yet — no snapshot date exists.");
  }
  const publishedAt = run.publishedAt;

  const allOrgWorkers = await db
    .select({
      id: workers.id,
      firstName: workers.firstName,
      lastName: workers.lastName,
      displayName: workers.displayName,
      jurisdictionId: workers.jurisdictionId,
    })
    .from(workers)
    .where(eq(workers.organizationId, orgId));

  if (allOrgWorkers.length === 0) {
    return { course: { id: course.id, title: course.title, publishedAt }, runId: run.id, workers: [] };
  }

  // Only workers actually assigned THIS RUN (via "all in jurisdiction",
  // "specific roles", "specific workers" picked when this run was
  // published, or auto-assign of new hires into it) belong in the snapshot —
  // everyone else has no assignments row for this runId and would otherwise
  // show up as a misleading "Not Started" despite never having been asked to
  // take this particular run (they may still have taken a different run of
  // the same course — that's a separate snapshot).
  const assignmentRows = await db
    .select({ workerId: assignments.workerId })
    .from(assignments)
    .where(
      and(
        eq(assignments.runId, run.id),
        inArray(assignments.workerId, allOrgWorkers.map((w) => w.id))
      )
    );
  const assignedWorkerIds = new Set(assignmentRows.map((a) => a.workerId));
  const orgWorkers = allOrgWorkers.filter((w) => assignedWorkerIds.has(w.id));

  if (orgWorkers.length === 0) {
    return { course: { id: course.id, title: course.title, publishedAt }, runId: run.id, workers: [] };
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
    .where(and(eq(progress.runId, run.id), inArray(progress.workerId, workerIds)));
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

  return { course: { id: course.id, title: course.title, publishedAt }, runId: run.id, workers: snapshotWorkers };
}
