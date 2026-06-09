import { db } from "@/db";
import { progress, workers } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id: workerId } = await params;
    const body = await req.json();
    const { courseId } = body;

    if (!courseId) {
      return new NextResponse("Course ID is required", { status: 400 });
    }

    // 1. Verify worker exists
    const [worker] = await db
      .select()
      .from(workers)
      .where(eq(workers.id, workerId))
      .limit(1);

    if (!worker) {
      return new NextResponse("Worker not found", { status: 404 });
    }

    // 2. Check for existing progress
    const [existingProgress] = await db
      .select()
      .from(progress)
      .where(
        and(
          eq(progress.workerId, workerId),
          eq(progress.courseId, courseId)
        )
      )
      .limit(1);

    if (existingProgress) {
      return NextResponse.json({
        ...existingProgress,
        isNew: false
      });
    }

    // 3. Insert new progress record
    const [newProgress] = await db
      .insert(progress)
      .values({
        workerId,
        courseId,
        status: "not_started",
        currentSlideIndex: 0,
      })
      .returning();

    return NextResponse.json({
      ...newProgress,
      isNew: true
    });
  } catch (error: any) {
    console.error("Error assigning course to worker:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
