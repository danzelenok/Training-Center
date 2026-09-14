import { db } from "@/db";
import { courses, slides, workers, assignments, courseRoles, jobRoles } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { roleOrUnauthorized, canWriteCourse } from "@/lib/adminRoles";
import { computeAssignmentDueDate } from "@/lib/dates";
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
    const assignTo: "all" | "specific" =
      body.assignTo === "specific" ? "specific" : "all";
    const requestedWorkerIds: string[] = Array.isArray(body.workerIds) ? body.workerIds : [];
    const rawRoleIds: string[] = Array.isArray(body.roleIds) ? body.roleIds : [];
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

    // Write-time invariant: only ever scope by roles that belong to this organization.
    const requestedRoleIds = rawRoleIds.length
      ? (
          await db
            .select({ id: jobRoles.id })
            .from(jobRoles)
            .where(and(inArray(jobRoles.id, rawRoleIds), eq(jobRoles.organizationId, orgId)))
        ).map((r) => r.id)
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

    const isFirstPublish = course.status !== "published";

    // 3. On first publish, create assignments according to the chosen scope
    //    and record the role scope itself in course_roles (empty = every
    //    role, i.e. unrestricted within the jurisdiction).
    if (isFirstPublish) {
      const assignedAt = new Date();
      const dueDate = computeAssignmentDueDate(assignedAt);
      if (assignTo === "all") {
        const jurisdictionWorkers = requestedRoleIds.length > 0
          ? await db
              .select({ id: workers.id })
              .from(workers)
              .where(and(
                eq(workers.organizationId, orgId),
                eq(workers.jurisdictionId, course.ownerJurisdictionId),
                eq(workers.active, true),
                inArray(workers.roleId, requestedRoleIds)
              ))
          : await db
              .select({ id: workers.id })
              .from(workers)
              .where(and(
                eq(workers.organizationId, orgId),
                eq(workers.jurisdictionId, course.ownerJurisdictionId),
                eq(workers.active, true)
              ));
        if (jurisdictionWorkers.length > 0) {
          await db
            .insert(assignments)
            .values(jurisdictionWorkers.map((w) => ({ workerId: w.id, courseId: id, assignedAt, dueDate })))
            .onConflictDoNothing({ target: [assignments.workerId, assignments.courseId] });
        }

        // Reconcile course_roles to exactly the roles picked here — this is
        // now the only writer of course_roles (the editor no longer picks
        // roles; see components/admin/course-editor/Sidebar.tsx history).
        const existingRoles = await db
          .select({ roleId: courseRoles.roleId })
          .from(courseRoles)
          .where(eq(courseRoles.courseId, id));
        const existingRoleIds = new Set(existingRoles.map((r) => r.roleId));
        const toAdd = requestedRoleIds.filter((rid) => !existingRoleIds.has(rid));
        const toRemove = [...existingRoleIds].filter((rid) => !requestedRoleIds.includes(rid));
        if (toRemove.length > 0) {
          await db
            .delete(courseRoles)
            .where(and(eq(courseRoles.courseId, id), inArray(courseRoles.roleId, toRemove)));
        }
        if (toAdd.length > 0) {
          await db
            .insert(courseRoles)
            .values(toAdd.map((roleId) => ({ courseId: id, roleId })))
            .onConflictDoNothing({ target: [courseRoles.courseId, courseRoles.roleId] });
        }
      } else if (workerIds.length > 0) {
        await db
          .insert(assignments)
          .values(workerIds.map((workerId) => ({ workerId, courseId: id, assignedAt, dueDate })))
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
