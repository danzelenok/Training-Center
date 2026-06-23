import { db } from "@/db";
import { progress, courses } from "@/db/schema";
import { withTelegramAuth } from "@/lib/telegram";
import { notifyAdminCompletion } from "@/lib/bot";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET /api/progress?courseId=<uuid>
export const GET = withTelegramAuth(async (req, { worker }) => {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    if (!courseId) {
      return new NextResponse("Missing courseId parameter", { status: 400 });
    }

    const [prog] = await db
      .select()
      .from(progress)
      .where(
        and(
          eq(progress.workerId, worker.id),
          eq(progress.courseId, courseId)
        )
      )
      .limit(1);

    if (!prog) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      currentSlideIndex: prog.currentSlideIndex,
      status: prog.status,
      courseId: prog.courseId,
      quizScore: prog.quizScore,
      completedAt: prog.completedAt,
    });
  } catch (error: any) {
    console.error("GET /api/progress error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
});

// POST /api/progress
export const POST = withTelegramAuth(async (req, { worker }) => {
  try {
    const body = await req.json();
    const { courseId, currentSlideIndex, status, quizScore } = body;

    if (!courseId) {
      return new NextResponse("Missing courseId parameter", { status: 400 });
    }
    if (currentSlideIndex === undefined) {
      return new NextResponse("Missing currentSlideIndex parameter", { status: 400 });
    }
    if (!status) {
      return new NextResponse("Missing status parameter", { status: 400 });
    }

    // Check if progress already exists
    const [existing] = await db
      .select()
      .from(progress)
      .where(
        and(
          eq(progress.workerId, worker.id),
          eq(progress.courseId, courseId)
        )
      )
      .limit(1);

    const isCompleted = status === "completed";
    const completedAtVal = isCompleted ? new Date() : null;

    let updatedProgress;

    if (existing) {
      // Check transition to completed
      const wasCompleted = existing.status === "completed";

      // Never downgrade a completed course — once done, always done
      const effectiveStatus = wasCompleted ? "completed" : status;
      const effectiveIsCompleted = effectiveStatus === "completed";

      const [updated] = await db
        .update(progress)
        .set({
          currentSlideIndex,
          status: effectiveStatus,
          quizScore: quizScore !== undefined ? quizScore : existing.quizScore,
          completedAt: effectiveIsCompleted ? (existing.completedAt || completedAtVal) : existing.completedAt,
          updatedAt: new Date(),
        })
        .where(eq(progress.id, existing.id))
        .returning();

      updatedProgress = updated;

      // Notify admin if transitioned to completed
      if (isCompleted && !wasCompleted) {
        try {
          const [course] = await db
            .select({ title: courses.title })
            .from(courses)
            .where(eq(courses.id, courseId))
            .limit(1);

          const courseTitle = course?.title || "Unknown Course";
          const workerName = [worker.firstName, worker.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() || worker.telegramUsername || `Worker ID ${worker.telegramUserId}`;

          await notifyAdminCompletion(workerName, courseTitle);
        } catch (botErr) {
          console.error("Failed to send telegram completion notification:", botErr);
        }
      }
    } else {
      const [inserted] = await db
        .insert(progress)
        .values({
          workerId: worker.id,
          courseId,
          currentSlideIndex,
          status,
          quizScore: quizScore !== undefined ? quizScore : null,
          completedAt: completedAtVal,
        })
        .returning();

      updatedProgress = inserted;

      if (isCompleted) {
        try {
          const [course] = await db
            .select({ title: courses.title })
            .from(courses)
            .where(eq(courses.id, courseId))
            .limit(1);

          const courseTitle = course?.title || "Unknown Course";
          const workerName = [worker.firstName, worker.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() || worker.telegramUsername || `Worker ID ${worker.telegramUserId}`;

          await notifyAdminCompletion(workerName, courseTitle);
        } catch (botErr) {
          console.error("Failed to send telegram completion notification:", botErr);
        }
      }
    }

    return NextResponse.json(updatedProgress);
  } catch (error: any) {
    console.error("POST /api/progress error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
});
