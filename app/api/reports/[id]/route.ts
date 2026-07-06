import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { progress, assignments } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";

// PATCH /api/reports/[id] — mark as completed.
// id can be a progress.id (fast path) or an assignments.id (upsert path, for not-yet-started courses).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;

    const [existingProgress] = await db.select().from(progress).where(eq(progress.id, id)).limit(1);

    if (existingProgress) {
      const [updated] = await db
        .update(progress)
        .set({
          status: "completed",
          completedAt: existingProgress.completedAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(progress.id, id))
        .returning();
      return NextResponse.json(updated);
    }

    // No progress row — id must be an assignmentId; upsert progress as completed
    const [assignment] = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1);
    if (!assignment) return new NextResponse("Not found", { status: 404 });

    // Check if a progress row already exists for this worker+course (via a different path)
    const [existingForPair] = await db
      .select()
      .from(progress)
      .where(and(eq(progress.workerId, assignment.workerId), eq(progress.courseId, assignment.courseId)))
      .limit(1);

    if (existingForPair) {
      const [updated] = await db
        .update(progress)
        .set({ status: "completed", completedAt: existingForPair.completedAt ?? new Date(), updatedAt: new Date() })
        .where(eq(progress.id, existingForPair.id))
        .returning();
      return NextResponse.json(updated);
    }

    const [inserted] = await db
      .insert(progress)
      .values({ workerId: assignment.workerId, courseId: assignment.courseId, currentSlideIndex: 0, status: "completed", completedAt: new Date() })
      .returning();
    return NextResponse.json(inserted);
  } catch (error: any) {
    console.error("Error marking report as completed:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

// DELETE /api/reports/[id] — remove a course assignment (id = assignments.id).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;

    await db.delete(assignments).where(eq(assignments.id, id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error removing assignment:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
