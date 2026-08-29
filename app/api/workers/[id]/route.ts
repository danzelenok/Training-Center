import { db } from "@/db";
import { workers, progress, courses, pollResponses, slides, assignments, employmentEvents, jobRoles, jurisdictions, organizationJurisdictions } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { roleOrUnauthorized } from "@/lib/adminRoles";
import { auth } from "@clerk/nextjs/server";
import { and, count, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { normalizePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;

    const worker = await db
      .select()
      .from(workers)
      .where(and(eq(workers.id, id), eq(workers.organizationId, orgId)))
      .limit(1);

    if (!worker[0]) return new NextResponse("Not found", { status: 404 });

    const courseProgress = await db
      .select({
        assignmentId: assignments.id,
        progressId: progress.id,
        courseId: courses.id,
        courseTitle: courses.title,
        status: progress.status,
        currentSlideIndex: progress.currentSlideIndex,
        quizScore: progress.quizScore,
        completedAt: progress.completedAt,
        assignedAt: assignments.assignedAt,
        updatedAt: sql<Date>`coalesce(${progress.updatedAt}, ${assignments.updatedAt})`,
        totalSlides: count(slides.id),
      })
      .from(assignments)
      .innerJoin(courses, eq(courses.id, assignments.courseId))
      .leftJoin(
        progress,
        and(eq(progress.workerId, assignments.workerId), eq(progress.courseId, assignments.courseId))
      )
      .leftJoin(slides, eq(slides.courseId, courses.id))
      .where(eq(assignments.workerId, id))
      .groupBy(
        assignments.id,
        progress.id,
        courses.id,
        courses.title,
        progress.status,
        progress.currentSlideIndex,
        progress.quizScore,
        progress.completedAt,
        assignments.assignedAt,
        assignments.updatedAt,
        progress.updatedAt
      )
      .orderBy(assignments.assignedAt);

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

    const employmentHistory = await db
      .select({
        id: employmentEvents.id,
        eventType: employmentEvents.eventType,
        eventDate: employmentEvents.eventDate,
        newRoleId: employmentEvents.newRoleId,
        newRoleName: jobRoles.name,
        note: employmentEvents.note,
      })
      .from(employmentEvents)
      .leftJoin(jobRoles, eq(jobRoles.id, employmentEvents.newRoleId))
      .where(eq(employmentEvents.workerId, id))
      .orderBy(employmentEvents.eventDate);

    let manager: { id: string; name: string } | null = null;
    if (worker[0].managerId) {
      const [managerRow] = await db
        .select({ id: workers.id, firstName: workers.firstName, lastName: workers.lastName, displayName: workers.displayName })
        .from(workers)
        .where(eq(workers.id, worker[0].managerId))
        .limit(1);
      if (managerRow) {
        manager = {
          id: managerRow.id,
          name: managerRow.displayName || [managerRow.firstName, managerRow.lastName].filter(Boolean).join(" ") || "Unnamed Worker",
        };
      }
    }

    let jurisdiction: { id: string; code: string; name: string } | null = null;
    if (worker[0].jurisdictionId) {
      const [jurisdictionRow] = await db
        .select({ id: jurisdictions.id, code: jurisdictions.code, name: jurisdictions.name })
        .from(jurisdictions)
        .where(eq(jurisdictions.id, worker[0].jurisdictionId))
        .limit(1);
      jurisdiction = jurisdictionRow ?? null;
    }

    let role: { id: string; name: string } | null = null;
    if (worker[0].roleId) {
      const [roleRow] = await db
        .select({ id: jobRoles.id, name: jobRoles.name })
        .from(jobRoles)
        .where(eq(jobRoles.id, worker[0].roleId))
        .limit(1);
      role = roleRow ?? null;
    }

    return NextResponse.json({
      ...worker[0],
      telegramUserId: worker[0].telegramUserId?.toString() ?? null,
      manager,
      jurisdiction,
      role,
      employmentHistory,
      courses: courseProgress.map((r) => ({
        assignmentId: r.assignmentId,
        progressId: r.progressId ?? null,
        courseId: r.courseId,
        courseTitle: r.courseTitle,
        status: r.status ?? "not_started",
        currentSlideIndex: r.currentSlideIndex ?? 0,
        quizScore: r.quizScore ?? null,
        completedAt: r.completedAt ?? null,
        assignedAt: r.assignedAt,
        updatedAt: r.updatedAt,
        totalSlides: r.totalSlides,
      })),
      pollResponses: pollResponsesList,
    });
  } catch (error: any) {
    console.error("Error fetching worker details:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

    const roleResult = roleOrUnauthorized(req);
    if (roleResult instanceof Response) return roleResult;

    const { id } = await params;
    const [ownedWorker] = await db
      .select({ id: workers.id, jurisdictionId: workers.jurisdictionId, roleId: workers.roleId })
      .from(workers)
      .where(and(eq(workers.id, id), eq(workers.organizationId, orgId)))
      .limit(1);
    if (!ownedWorker) return new NextResponse("Not found", { status: 404 });

    const { userId: actingAdminId } = await auth();

    // jurisdiction_admin can only edit workers already in their own
    // jurisdiction, and can never move a worker into a different one —
    // same invariant as worker creation (app/api/admin/workers/route.ts).
    if (roleResult.role === "jurisdiction_admin" && ownedWorker.jurisdictionId !== roleResult.jurisdictionId) {
      return NextResponse.json({ error: "You can only edit workers in your jurisdiction." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    const updates: Partial<typeof workers.$inferInsert> = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json({ error: "Name is required." }, { status: 400 });
      }
      const nameParts = name.split(/\s+/);
      updates.displayName = name;
      updates.firstName = nameParts[0] || null;
      updates.lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;
    }

    if (typeof body.phone === "string") {
      const rawPhone = body.phone.trim();
      let phone: string | null = null;
      if (rawPhone) {
        phone = normalizePhone(rawPhone);
        if (!phone) {
          return NextResponse.json(
            { error: "Please enter a valid 10-digit US phone number." },
            { status: 400 }
          );
        }
        const [existingPhone] = await db
          .select({ id: workers.id })
          .from(workers)
          .where(and(eq(workers.organizationId, orgId), eq(workers.phone, phone)))
          .limit(1);
        if (existingPhone && existingPhone.id !== id) {
          return NextResponse.json(
            { error: "A worker with this phone number already exists." },
            { status: 400 }
          );
        }
      }
      updates.phone = phone;
    }

    if ("managerId" in body) {
      if (body.managerId === null) {
        updates.managerId = null;
      } else if (typeof body.managerId === "string") {
        if (body.managerId === id) {
          return NextResponse.json({ error: "A worker cannot be their own manager." }, { status: 400 });
        }
        const [manager] = await db
          .select({ id: workers.id })
          .from(workers)
          .where(and(eq(workers.id, body.managerId), eq(workers.organizationId, orgId)))
          .limit(1);
        if (!manager) {
          return NextResponse.json({ error: "Selected manager was not found." }, { status: 400 });
        }
        updates.managerId = manager.id;
      }
    }

    if ("jurisdictionId" in body) {
      if (roleResult.role === "jurisdiction_admin") {
        // Same as create: the client-supplied value is ignored — a
        // jurisdiction_admin can't move a worker to (or out of, via null)
        // any jurisdiction other than their own.
        updates.jurisdictionId = roleResult.jurisdictionId;
      } else if (body.jurisdictionId === null) {
        updates.jurisdictionId = null;
      } else if (typeof body.jurisdictionId === "string") {
        const [jurisdiction] = await db
          .select({ id: jurisdictions.id })
          .from(organizationJurisdictions)
          .innerJoin(jurisdictions, eq(jurisdictions.id, organizationJurisdictions.jurisdictionId))
          .where(
            and(
              eq(organizationJurisdictions.organizationId, orgId),
              eq(organizationJurisdictions.jurisdictionId, body.jurisdictionId)
            )
          )
          .limit(1);
        if (!jurisdiction) {
          return NextResponse.json({ error: "Selected state was not found." }, { status: 400 });
        }
        updates.jurisdictionId = jurisdiction.id;
      }
    }

    let roleChanged = false;
    let newRoleId: string | null = null;
    if ("roleId" in body) {
      if (body.roleId === null) {
        roleChanged = ownedWorker.roleId !== null;
        newRoleId = null;
        updates.roleId = null;
      } else if (typeof body.roleId === "string") {
        const [jobRole] = await db
          .select({ id: jobRoles.id })
          .from(jobRoles)
          .where(and(eq(jobRoles.id, body.roleId), eq(jobRoles.organizationId, orgId)))
          .limit(1);
        if (!jobRole) {
          return NextResponse.json({ error: "Selected role was not found." }, { status: 400 });
        }
        roleChanged = ownedWorker.roleId !== jobRole.id;
        newRoleId = jobRole.id;
        updates.roleId = jobRole.id;
      }
    }

    let statusChanged = false;
    let statusChangedAt: Date | null = null;
    if (typeof body.active === "boolean") {
      const [current] = await db
        .select({ active: workers.active })
        .from(workers)
        .where(eq(workers.id, id))
        .limit(1);
      if (!current) return new NextResponse("Not found", { status: 404 });

      statusChanged = current.active !== body.active;
      statusChangedAt = new Date();
      updates.active = body.active;
      updates.deactivatedAt = body.active ? null : statusChangedAt;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    const [updated] = await db
      .update(workers)
      .set(updates)
      .where(eq(workers.id, id))
      .returning();
    if (!updated) return new NextResponse("Not found", { status: 404 });

    if (statusChanged && statusChangedAt) {
      await db.insert(employmentEvents).values({
        workerId: id,
        eventType: body.active ? "reactivated" : "deactivated",
        eventDate: statusChangedAt,
        createdByAdminId: actingAdminId ?? null,
      });
    }

    if (roleChanged) {
      await db.insert(employmentEvents).values({
        workerId: id,
        eventType: "role_changed",
        eventDate: new Date(),
        newRoleId,
        createdByAdminId: actingAdminId ?? null,
      });
    }

    return NextResponse.json({
      ...updated,
      telegramUserId: updated.telegramUserId?.toString() ?? null,
    });
  } catch (error: any) {
    console.error("Error updating worker:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const orgId = await requireOrgId().catch(() => null);
  if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

  const roleResult = roleOrUnauthorized(req);
  if (roleResult instanceof Response) return roleResult;

  const { id } = await params;

  const [targetWorker] = await db
    .select({ id: workers.id, jurisdictionId: workers.jurisdictionId })
    .from(workers)
    .where(and(eq(workers.id, id), eq(workers.organizationId, orgId)))
    .limit(1);
  if (!targetWorker) return new NextResponse("Not found", { status: 404 });
  if (roleResult.role === "jurisdiction_admin" && targetWorker.jurisdictionId !== roleResult.jurisdictionId) {
    return NextResponse.json({ error: "You can only delete workers in your jurisdiction." }, { status: 403 });
  }

  await db.delete(workers).where(and(eq(workers.id, id), eq(workers.organizationId, orgId)));

  return NextResponse.json({ success: true });
}
