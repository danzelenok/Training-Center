import { db } from "@/db";
import { courses, progress, assignments } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withTelegramAuth } from "@/lib/telegram";

// A course only counts as "this week's training" for a brand-new worker if it
// was published within a week of the worker's hire date in either direction.
// Older courses are picked up later through a regular re-assignment cycle instead.
const AUTO_ASSIGN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const GET = withTelegramAuth(async (_req, { worker }) => {
  // Idempotently assign any courses marked autoAssignNewWorkers=true that were
  // published close to this worker's hire date. For existing workers, or
  // courses published long before/after they were hired, this is a no-op.
  const autoAssignCourses = await db
    .select({ id: courses.id, publishedAt: courses.publishedAt, createdAt: courses.createdAt })
    .from(courses)
    .where(and(eq(courses.autoAssignNewWorkers, true), eq(courses.status, "published")));

  const eligibleCourses = autoAssignCourses.filter((c) => {
    const publishDate = c.publishedAt ?? c.createdAt;
    return Math.abs(worker.createdAt.getTime() - new Date(publishDate).getTime()) <= AUTO_ASSIGN_WINDOW_MS;
  });

  if (eligibleCourses.length > 0) {
    await db
      .insert(assignments)
      .values(eligibleCourses.map((c) => ({ workerId: worker.id, courseId: c.id })))
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
    .innerJoin(courses, and(eq(courses.id, assignments.courseId), eq(courses.status, "published")))
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
