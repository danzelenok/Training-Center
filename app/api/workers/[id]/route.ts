import { db } from "@/db";
import { workers, progress, courses, pollResponses, slides } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, count, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      progressId: progress.id,
      courseId: courses.id,
      courseTitle: courses.title,
      status: progress.status,
      currentSlideIndex: progress.currentSlideIndex,
      quizScore: progress.quizScore,
      completedAt: progress.completedAt,
      assignedAt: progress.createdAt,
      updatedAt: progress.updatedAt,
      totalSlides: count(slides.id),
    })
    .from(progress)
    .innerJoin(courses, eq(progress.courseId, courses.id))
    .leftJoin(slides, eq(slides.courseId, courses.id))
    .where(eq(progress.workerId, id))
    .groupBy(
      progress.id,
      courses.id,
      courses.title,
      progress.status,
      progress.currentSlideIndex,
      progress.quizScore,
      progress.completedAt,
      progress.createdAt,
      progress.updatedAt
    )
    .orderBy(progress.createdAt);

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
    courses: courseProgress,
    pollResponses: pollResponsesList,
  });
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
