import { db } from "@/db";
import { courseRuns, assignments } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

/**
 * The run new activity (auto-assign sweeps, manual "Assign course") should
 * attach to for a given course — always the most recently published run.
 * Every published course has at least one course_runs row once the
 * course_runs backfill (scripts/backfill-course-runs.ts) has run; callers on
 * a course that somehow has none should skip it rather than insert a
 * runId-less row.
 */
export async function getLatestRunId(courseId: string): Promise<string | null> {
  const [run] = await db
    .select({ id: courseRuns.id })
    .from(courseRuns)
    .where(eq(courseRuns.courseId, courseId))
    .orderBy(desc(courseRuns.publishedAt))
    .limit(1);
  return run?.id ?? null;
}

/**
 * Which run a specific worker is actually acting on for a course — their
 * most recently assigned run for it, which is normally the course's latest
 * run but can lag it if the worker was assigned before a newer run was
 * published. Used to route progress (slide position, quiz answers,
 * completion) to the correct run instead of the course's current one, so a
 * worker mid-way through an older run doesn't have their progress attributed
 * to a run they were never assigned into. Null if the worker has no
 * assignment for this course at all.
 */
export async function getWorkerActiveRunId(workerId: string, courseId: string): Promise<string | null> {
  const [row] = await db
    .select({ runId: assignments.runId })
    .from(assignments)
    .where(and(eq(assignments.workerId, workerId), eq(assignments.courseId, courseId)))
    .orderBy(desc(assignments.assignedAt))
    .limit(1);
  return row?.runId ?? null;
}
