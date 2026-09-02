import { db } from "@/db";
import { courses, slides, workers, assignments, courseRoles } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { roleOrUnauthorized, canWriteCourse } from "@/lib/adminRoles";
import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sendCourseAnnouncementDMs } from "@/lib/bot";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const roleResult = roleOrUnauthorized(req);
    if (roleResult instanceof Response) return roleResult;

    const body = await req.json().catch(() => ({}));
    const assignTo: "all" | "specific" | "roles" =
      body.assignTo === "specific" ? "specific" : body.assignTo === "roles" ? "roles" : "all";
    const requestedWorkerIds: string[] = Array.isArray(body.workerIds) ? body.workerIds : [];
    const requestedRoleIds: string[] = Array.isArray(body.roleIds) ? body.roleIds : [];
    const notifyWorkers: boolean = body.notifyWorkers ?? body.notifyTelegram ?? true;

    // 1. Fetch the course, scoped to this organization
    const [course] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, id), eq(courses.organizationId, orgId)))
      .limit(1);

    if (!course) {
      return new NextResponse("Course not found", { status: 404 });
    }
    if (!canWriteCourse(roleResult, course.ownerJurisdictionId)) {
      return NextResponse.json({ error: "You can only publish courses owned by your jurisdiction." }, { status: 403 });
    }

    // Write-time invariant: only ever assign workers that belong to the
    // same organization as the course, even if the client passed foreign ids.
    const workerIds = requestedWorkerIds.length
      ? (
          await db
            .select({ id: workers.id })
            .from(workers)
            .where(and(inArray(workers.id, requestedWorkerIds), eq(workers.organizationId, orgId)))
        ).map((w) => w.id)
      : [];

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

    // A course must target at least one job role before it can go live —
    // there's no DB-level way to express "at least one row in course_roles
    // per course" (it's a many-to-many join table), so this is enforced here.
    const [roleCountResult] = await db
      .select({ count: sql<number>`cast(count(${courseRoles.id}) as int)` })
      .from(courseRoles)
      .where(eq(courseRoles.courseId, id));

    if ((roleCountResult?.count || 0) === 0) {
      return new NextResponse(
        JSON.stringify({ error: "Cannot publish a course with no role assigned. Please select at least one role first." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const isFirstPublish = course.status !== "published";

    // 3. On first publish, create assignments according to the chosen scope
    if (isFirstPublish) {
      if (assignTo === "all") {
        const allWorkers = await db
          .select({ id: workers.id })
          .from(workers)
          .where(and(
            eq(workers.organizationId, orgId),
            eq(workers.jurisdictionId, course.ownerJurisdictionId),
            eq(workers.active, true)
          ));
        if (allWorkers.length > 0) {
          await db
            .insert(assignments)
            .values(allWorkers.map((w) => ({ workerId: w.id, courseId: id })))
            .onConflictDoNothing({ target: [assignments.workerId, assignments.courseId] });
        }
      } else if (assignTo === "roles" && requestedRoleIds.length > 0) {
        const roleWorkers = await db
          .select({ id: workers.id })
          .from(workers)
          .where(and(
            eq(workers.organizationId, orgId),
            eq(workers.jurisdictionId, course.ownerJurisdictionId),
            eq(workers.active, true),
            inArray(workers.roleId, requestedRoleIds)
          ));
        if (roleWorkers.length > 0) {
          await db
            .insert(assignments)
            .values(roleWorkers.map((w) => ({ workerId: w.id, courseId: id })))
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
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const roleResult = roleOrUnauthorized(_req);
    if (roleResult instanceof Response) return roleResult;

    const [course] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, id), eq(courses.organizationId, orgId)))
      .limit(1);

    if (!course) {
      return new NextResponse("Course not found", { status: 404 });
    }
    if (!canWriteCourse(roleResult, course.ownerJurisdictionId)) {
      return NextResponse.json({ error: "You can only revoke courses owned by your jurisdiction." }, { status: 403 });
    }

    const [updatedCourse] = await db
      .update(courses)
      .set({
        status: "draft",
        telegramMessageId: null,
        telegramGroupId: null,
        updatedAt: new Date(),
      })
      .where(and(eq(courses.id, id), eq(courses.organizationId, orgId)))
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
