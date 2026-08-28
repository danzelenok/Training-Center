import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { progress, assignments, workers } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { roleOrUnauthorized } from "@/lib/adminRoles";
import { and, eq } from "drizzle-orm";

// PATCH /api/reports/[id] — mark as completed.
// id can be a progress.id (fast path) or an assignments.id (upsert path, for not-yet-started courses).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

    const roleResult = roleOrUnauthorized(req);
    if (roleResult instanceof Response) return roleResult;

    const { id } = await params;

    const [existingProgress] = await db
      .select({ progress, workerJurisdictionId: workers.jurisdictionId })
      .from(progress)
      .innerJoin(workers, and(eq(workers.id, progress.workerId), eq(workers.organizationId, orgId)))
      .where(eq(progress.id, id))
      .limit(1)
      .then((rows) => rows.map((r) => ({ ...r.progress, workerJurisdictionId: r.workerJurisdictionId })));

    if (existingProgress && roleResult.role === "jurisdiction_admin" && existingProgress.workerJurisdictionId !== roleResult.jurisdictionId) {
      return NextResponse.json({ error: "You can only manage workers in your jurisdiction." }, { status: 403 });
    }

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
    const [assignment] = await db
      .select({ assignments, workerJurisdictionId: workers.jurisdictionId })
      .from(assignments)
      .innerJoin(workers, and(eq(workers.id, assignments.workerId), eq(workers.organizationId, orgId)))
      .where(eq(assignments.id, id))
      .limit(1)
      .then((rows) => rows.map((r) => ({ ...r.assignments, workerJurisdictionId: r.workerJurisdictionId })));
    if (!assignment) return new NextResponse("Not found", { status: 404 });
    if (roleResult.role === "jurisdiction_admin" && assignment.workerJurisdictionId !== roleResult.jurisdictionId) {
      return NextResponse.json({ error: "You can only manage workers in your jurisdiction." }, { status: 403 });
    }

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
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

    const roleResult = roleOrUnauthorized(req);
    if (roleResult instanceof Response) return roleResult;

    const { id } = await params;

    const [ownedAssignment] = await db
      .select({ id: assignments.id, workerJurisdictionId: workers.jurisdictionId })
      .from(assignments)
      .innerJoin(workers, and(eq(workers.id, assignments.workerId), eq(workers.organizationId, orgId)))
      .where(eq(assignments.id, id))
      .limit(1);
    if (!ownedAssignment) return new NextResponse("Not found", { status: 404 });
    if (roleResult.role === "jurisdiction_admin" && ownedAssignment.workerJurisdictionId !== roleResult.jurisdictionId) {
      return NextResponse.json({ error: "You can only manage workers in your jurisdiction." }, { status: 403 });
    }

    await db.delete(assignments).where(eq(assignments.id, id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error removing assignment:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
