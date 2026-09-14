import { db } from "@/db";
import { courses, slides, workers, assignments, courseRoles, courseRuns, courseRunRoles, jobRoles } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { roleOrUnauthorized, canWriteCourse } from "@/lib/adminRoles";
import { computeAssignmentDueDate } from "@/lib/dates";
import { auth } from "@clerk/nextjs/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sendCourseAnnouncementDMs } from "@/lib/bot";

// POST /api/courses/[id]/publish — always creates a new course_runs row:
// the first Go Live for a draft course (run #1) AND every subsequent
// "Запустить повторно" (run #2, #3, ...) go through this same handler and
// the same audience picker. A plain re-notification of the CURRENT run with
// no new run/assignments is a different action — see
// app/api/courses/[id]/resend/route.ts.
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

    const { userId: actingAdminId } = await auth();
    if (!actingAdminId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

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

    // 3. Every publish — first Go Live or a later "Запустить повторно" —
    //    creates a new course_runs row and a fresh set of assignments for
    //    it, scoped by the audience picked in this dialog. Old runs' own
    //    assignments/progress are never touched, so past completions stay
    //    intact and visible separately (see lib/courseSnapshot.ts).
    const [run] = await db
      .insert(courseRuns)
      .values({ courseId: id, publishedAt: new Date(), createdByAdminId: actingAdminId })
      .returning();

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
          .values(jurisdictionWorkers.map((w) => ({ workerId: w.id, courseId: id, runId: run.id, assignedAt, dueDate })))
          .onConflictDoNothing({ target: [assignments.workerId, assignments.runId] });
      }

      // Reconcile course_roles — the *current* effective scope used for
      // eligibility/auto-assign of new workers going forward — to exactly
      // the roles picked here. This is now the only writer of course_roles
      // (the editor no longer picks roles; see
      // components/admin/course-editor/Sidebar.tsx history). Distinct from
      // course_run_roles below, which is this run's own frozen snapshot and
      // is never reconciled/overwritten once written.
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

      if (requestedRoleIds.length > 0) {
        const requestedRoles = await db
          .select({ name: jobRoles.name })
          .from(jobRoles)
          .where(inArray(jobRoles.id, requestedRoleIds));
        await db
          .insert(courseRunRoles)
          .values(requestedRoles.map((r) => ({ courseRunId: run.id, roleName: r.name })))
          .onConflictDoNothing({ target: [courseRunRoles.courseRunId, courseRunRoles.roleName] });
      }
    } else if (workerIds.length > 0) {
      await db
        .insert(assignments)
        .values(workerIds.map((workerId) => ({ workerId, courseId: id, runId: run.id, assignedAt, dueDate })))
        .onConflictDoNothing({ target: [assignments.workerId, assignments.runId] });
    }

    // 4. Send direct message announcements to this run's assignees if requested
    if (notifyWorkers) {
      try {
        await sendCourseAnnouncementDMs(course.id, course.title, run.id);
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

    // 5. Update course status in the database. publishedAt is deliberately
    //    left untouched on a relaunch — it still means "first published on",
    //    per-run dates live on course_runs.publishedAt instead (see
    //    lib/courseSnapshot.ts and the courses-list "last run" sort/filter).
    const [updatedCourse] = await db
      .update(courses)
      .set({
        status: "published",
        ...(isFirstPublish ? { publishedAt: new Date() } : {}),
        ...(assignTo === "all" ? { autoAssignNewWorkers: true } : {}),
        updatedAt: new Date(),
      })
      .where(eq(courses.id, id))
      .returning();

    return NextResponse.json({
      ...updatedCourse,
      runId: run.id,
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
