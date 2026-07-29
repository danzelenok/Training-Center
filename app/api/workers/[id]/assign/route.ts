import { db } from "@/db";
import { assignments, workers, courses } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id: workerId } = await params;
    const body = await req.json();
    const { courseId } = body;

    if (!courseId) {
      return new NextResponse("Course ID is required", { status: 400 });
    }

    // 1. Verify worker and course both exist and belong to this organization
    // (write-time invariant: never create an assignment across organizations)
    const [worker] = await db
      .select()
      .from(workers)
      .where(and(eq(workers.id, workerId), eq(workers.organizationId, orgId)))
      .limit(1);

    if (!worker) {
      return new NextResponse("Worker not found", { status: 404 });
    }

    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.organizationId, orgId)))
      .limit(1);

    if (!course) {
      return new NextResponse("Course not found", { status: 404 });
    }

    // 2. Insert the assignment; no-op if this worker/course pair already exists
    const [inserted] = await db
      .insert(assignments)
      .values({ workerId, courseId })
      .onConflictDoNothing({ target: [assignments.workerId, assignments.courseId] })
      .returning();

    if (inserted) {
      return NextResponse.json({ ...inserted, isNew: true });
    }

    const [existingAssignment] = await db
      .select()
      .from(assignments)
      .where(and(eq(assignments.workerId, workerId), eq(assignments.courseId, courseId)))
      .limit(1);

    return NextResponse.json({ ...existingAssignment, isNew: false });
  } catch (error: any) {
    console.error("Error assigning course to worker:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
