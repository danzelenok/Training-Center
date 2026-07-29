import { db } from "@/db";
import { pollResponses, workers, courses, slides } from "@/db/schema";
import { withTelegramAuth } from "@/lib/telegram";
import { requireOrgId } from "@/lib/org";
import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// POST /api/poll-responses — called from Telegram mini-app
export const POST = withTelegramAuth(async (req, { worker }) => {
  try {
    const body = await req.json();
    const { courseId, slideIndex, rating, comment } = body;

    if (!courseId) return new NextResponse("Missing courseId", { status: 400 });
    if (slideIndex === undefined) return new NextResponse("Missing slideIndex", { status: 400 });

    // Write-time invariant: never record a poll response against a course outside the worker's organization
    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.organizationId, worker.organizationId)))
      .limit(1);
    if (!course) return new NextResponse("Course not found", { status: 404 });

    const [existing] = await db
      .select({ id: pollResponses.id })
      .from(pollResponses)
      .where(
        and(
          eq(pollResponses.workerId, worker.id),
          eq(pollResponses.courseId, courseId),
          eq(pollResponses.slideIndex, slideIndex)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(pollResponses)
        .set({ rating: rating ?? null, comment: comment ?? null, updatedAt: new Date() })
        .where(eq(pollResponses.id, existing.id));
    } else {
      await db.insert(pollResponses).values({
        workerId: worker.id,
        courseId,
        slideIndex,
        rating: rating ?? null,
        comment: comment ?? null,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("POST /api/poll-responses error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
});

// GET /api/poll-responses — admin only (Clerk auth)
// Query params: ?courseId=, ?workerId=
export async function GET(req: NextRequest) {
  try {
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const workerId = searchParams.get("workerId");

    const conditions = [eq(workers.organizationId, orgId)];
    if (courseId) conditions.push(eq(pollResponses.courseId, courseId));
    if (workerId) conditions.push(eq(pollResponses.workerId, workerId));

    const results = await db
      .select({
        id: pollResponses.id,
        slideIndex: pollResponses.slideIndex,
        rating: pollResponses.rating,
        comment: pollResponses.comment,
        createdAt: pollResponses.createdAt,
        courseId: pollResponses.courseId,
        workerId: pollResponses.workerId,
        courseName: courses.title,
        displayName: workers.displayName,
        firstName: workers.firstName,
        lastName: workers.lastName,
        question: sql<string>`cast(${slides.content}->>'heading' as text)`,
      })
      .from(pollResponses)
      .innerJoin(workers, eq(pollResponses.workerId, workers.id))
      .innerJoin(courses, eq(pollResponses.courseId, courses.id))
      .leftJoin(
        slides,
        and(
          eq(slides.courseId, pollResponses.courseId),
          eq(slides.order, pollResponses.slideIndex)
        )
      )
      .where(and(...conditions))
      .orderBy(sql`${pollResponses.createdAt} DESC`);

    return NextResponse.json(
      results.map((r) => ({
        ...r,
        workerName: r.displayName || [r.firstName, r.lastName].filter(Boolean).join(" ") || "Unnamed Worker",
      }))
    );
  } catch (error: any) {
    console.error("GET /api/poll-responses error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
