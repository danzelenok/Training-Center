import { db } from "@/db";
import { workers, progress, courses } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
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
    })
    .from(progress)
    .innerJoin(courses, eq(progress.courseId, courses.id))
    .where(eq(progress.workerId, id))
    .orderBy(progress.createdAt);

  return NextResponse.json({
    ...worker[0],
    telegramUserId: worker[0].telegramUserId?.toString() ?? null,
    courses: courseProgress,
  });
}
