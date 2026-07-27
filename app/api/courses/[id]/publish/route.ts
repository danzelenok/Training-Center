import { db } from "@/db";
import { courses, slides, workers, assignments } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sendCourseAnnouncementDMs } from "@/lib/bot";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const assignTo: "all" | "specific" = body.assignTo === "specific" ? "specific" : "all";
    const workerIds: string[] = Array.isArray(body.workerIds) ? body.workerIds : [];
    const notifyWorkers: boolean = body.notifyWorkers ?? body.notifyTelegram ?? true;

    // 1. Fetch the course
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, id))
      .limit(1);

    if (!course) {
      return new NextResponse("Course not found", { status: 404 });
    }

    // 2. Enforce slide existence before publishing
    const [countResult] = await db
      .select({ count: sql<number>`cast(count(${slides.id}) as int)` })
      .from(slides)
      .where(eq(slides.courseId, id));

    const slideCount = countResult?.count || 0;
    if (slideCount === 0) {
      return new NextResponse(
        JSON.stringify({ error: "Cannot publish a course with no slides. Please add slides first." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const isFirstPublish = course.status !== "published";

    // 3. On first publish, create assignments according to the chosen scope
    if (isFirstPublish) {
      if (assignTo === "all") {
        const allWorkers = await db.select({ id: workers.id }).from(workers);
        if (allWorkers.length > 0) {
          await db
            .insert(assignments)
            .values(allWorkers.map((w) => ({ workerId: w.id, courseId: id })))
            .onConflictDoNothing({ target: [assignments.workerId, assignments.courseId] });
        }
      } else if (workerIds.length > 0) {
        await db
          .insert(assignments)
          .values(workerIds.map((workerId) => ({ workerId, courseId: id })))
          .onConflictDoNothing({ target: [assignments.workerId, assignments.courseId] });
      }
    }

    // 4. Send direct message announcements to assigned workers if requested
    if (notifyWorkers) {
      try {
        await sendCourseAnnouncementDMs(course.id, course.title);
      } catch (botError: any) {
        console.error("Failed to send course DMs to workers:", botError);
        return new NextResponse(
          JSON.stringify({
            error: "Failed to send course direct messages to assigned workers.",
            details: botError.message,
          }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 5. Update course status in the database
    const [updatedCourse] = await db
      .update(courses)
      .set({
        status: "published",
        ...(isFirstPublish ? { publishedAt: new Date() } : {}),
        ...(isFirstPublish && assignTo === "all" ? { autoAssignNewWorkers: true } : {}),
        updatedAt: new Date(),
      })
      .where(eq(courses.id, id))
      .returning();

    return NextResponse.json({
      ...updatedCourse,
      telegramMessageId: null,
      telegramGroupId: null,
    });
  } catch (error: any) {
    console.error("Error publishing course:", error);
    return new NextResponse(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// DELETE /api/courses/[id]/publish — revoke: reset to draft
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, id))
      .limit(1);

    if (!course) {
      return new NextResponse("Course not found", { status: 404 });
    }

    const [updatedCourse] = await db
      .update(courses)
      .set({
        status: "draft",
        telegramMessageId: null,
        telegramGroupId: null,
        updatedAt: new Date(),
      })
      .where(eq(courses.id, id))
      .returning();

    return NextResponse.json({
      ...updatedCourse,
      telegramMessageId: null,
      telegramGroupId: null,
    });
  } catch (error: any) {
    console.error("Error revoking course:", error);
    return new NextResponse(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
