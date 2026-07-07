import { db } from "@/db";
import { courses, progress, assignments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withTelegramAuth } from "@/lib/telegram";

export const GET = withTelegramAuth(async (_req, { worker }) => {
  // Idempotently assign any courses marked autoAssignNewWorkers=true.
  // For existing workers this is a no-op (ON CONFLICT DO NOTHING).
  const autoAssignCourses = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.autoAssignNewWorkers, true), eq(courses.status, "published")));

  if (autoAssignCourses.length > 0) {
    await db
      .insert(assignments)
      .values(autoAssignCourses.map((c) => ({ workerId: worker.id, courseId: c.id })))
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
    .where(eq(assignments.workerId, worker.id));

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
