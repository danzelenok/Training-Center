import { db } from "@/db";
import { workers, progress, courses, pollResponses, slides, assignments } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, count, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;

    const worker = await db
      .select()
      .from(workers)
      .where(eq(workers.id, id))
      .limit(1);

    if (!worker[0]) return new NextResponse("Not found", { status: 404 });

    const courseProgress = await db
      .select({
        assignmentId: assignments.id,
        progressId: progress.id,
        courseId: courses.id,
        courseTitle: courses.title,
        status: progress.status,
        currentSlideIndex: progress.currentSlideIndex,
        quizScore: progress.quizScore,
        completedAt: progress.completedAt,
        assignedAt: assignments.assignedAt,
        updatedAt: sql<Date>`coalesce(${progress.updatedAt}, ${assignments.updatedAt})`,
        totalSlides: count(slides.id),
      })
      .from(assignments)
      .innerJoin(courses, eq(courses.id, assignments.courseId))
      .leftJoin(
        progress,
        and(eq(progress.workerId, assignments.workerId), eq(progress.courseId, assignments.courseId))
      )
      .leftJoin(slides, eq(slides.courseId, courses.id))
      .where(eq(assignments.workerId, id))
      .groupBy(
        assignments.id,
        progress.id,
        courses.id,
        courses.title,
        progress.status,
        progress.currentSlideIndex,
        progress.quizScore,
        progress.completedAt,
        assignments.assignedAt,
        assignments.updatedAt,
        progress.updatedAt
      )
      .orderBy(assignments.assignedAt);

    const pollResponsesList = await db
      .select({
        id: pollResponses.id,
        courseId: pollResponses.courseId,
        slideIndex: pollResponses.slideIndex,
        rating: pollResponses.rating,
        comment: pollResponses.comment,
        createdAt: pollResponses.createdAt,
        question: sql<string>`cast(${slides.content}->>'heading' as text)`,
      })
      .from(pollResponses)
      .leftJoin(
        slides,
        and(
          eq(slides.courseId, pollResponses.courseId),
          eq(slides.order, pollResponses.slideIndex)
        )
      )
      .where(eq(pollResponses.workerId, id))
      .orderBy(pollResponses.courseId, pollResponses.slideIndex);

    return NextResponse.json({
      ...worker[0],
      telegramUserId: worker[0].telegramUserId?.toString() ?? null,
      courses: courseProgress.map((r) => ({
        assignmentId: r.assignmentId,
        progressId: r.progressId ?? null,
        courseId: r.courseId,
        courseTitle: r.courseTitle,
        status: r.status ?? "not_started",
        currentSlideIndex: r.currentSlideIndex ?? 0,
        quizScore: r.quizScore ?? null,
        completedAt: r.completedAt ?? null,
        assignedAt: r.assignedAt,
        updatedAt: r.updatedAt,
        totalSlides: r.totalSlides,
      })),
      pollResponses: pollResponsesList,
    });
  } catch (error: any) {
    console.error("Error fetching worker details:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const updates: Partial<typeof workers.$inferInsert> = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json({ error: "Name is required." }, { status: 400 });
      }
      const nameParts = name.split(/\s+/);
      updates.displayName = name;
      updates.firstName = nameParts[0] || null;
      updates.lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;
    }

    if (typeof body.phone === "string") {
      const phone = body.phone.trim();
      if (phone) {
        const [existingPhone] = await db
          .select({ id: workers.id })
          .from(workers)
          .where(eq(workers.phone, phone))
          .limit(1);
        if (existingPhone && existingPhone.id !== id) {
          return NextResponse.json(
            { error: "A worker with this phone number already exists." },
            { status: 400 }
          );
        }
      }
      updates.phone = phone || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    const [updated] = await db
      .update(workers)
      .set(updates)
      .where(eq(workers.id, id))
      .returning();

    if (!updated) return new NextResponse("Not found", { status: 404 });

    return NextResponse.json({
      ...updated,
      telegramUserId: updated.telegramUserId?.toString() ?? null,
    });
  } catch (error: any) {
    console.error("Error updating worker:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;

  await db.delete(workers).where(eq(workers.id, id));

  return NextResponse.json({ success: true });
}
