import { db } from "@/db";
import { workers, progress, courses, pollResponses, slides, assignments, workerTeams, teams, workerStatusEvents } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { autoAssignTeamCoursesForNewMemberships } from "@/lib/teamAutoAssign";
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

    const workerTeamsList = await db
      .select({ id: teams.id, name: teams.name })
      .from(workerTeams)
      .innerJoin(teams, eq(teams.id, workerTeams.teamId))
      .where(eq(workerTeams.workerId, id));

    const statusHistory = await db
      .select({ id: workerStatusEvents.id, status: workerStatusEvents.status, changedAt: workerStatusEvents.changedAt })
      .from(workerStatusEvents)
      .where(eq(workerStatusEvents.workerId, id))
      .orderBy(workerStatusEvents.changedAt);

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

    return NextResponse.json({
      ...worker[0],
      telegramUserId: worker[0].telegramUserId?.toString() ?? null,
      teams: workerTeamsList,
      manager,
      statusHistory,
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

    const { id } = await params;
    const [ownedWorker] = await db
      .select({ id: workers.id })
      .from(workers)
      .where(and(eq(workers.id, id), eq(workers.organizationId, orgId)))
      .limit(1);
    if (!ownedWorker) return new NextResponse("Not found", { status: 404 });

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

    const requestedTeamIds: string[] | null = Array.isArray(body.teamIds) ? body.teamIds : null;
    const teamIds: string[] | null = requestedTeamIds
      ? (
          await db
            .select({ id: teams.id })
            .from(teams)
            .where(and(inArray(teams.id, requestedTeamIds), eq(teams.organizationId, orgId)))
        ).map((t) => t.id)
      : null;

    if (Object.keys(updates).length === 0 && teamIds === null) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    let updated = null;
    if (Object.keys(updates).length > 0) {
      [updated] = await db
        .update(workers)
        .set(updates)
        .where(eq(workers.id, id))
        .returning();
      if (!updated) return new NextResponse("Not found", { status: 404 });
    } else {
      [updated] = await db.select().from(workers).where(eq(workers.id, id)).limit(1);
      if (!updated) return new NextResponse("Not found", { status: 404 });
    }

    if (statusChanged && statusChangedAt) {
      await db.insert(workerStatusEvents).values({
        workerId: id,
        status: body.active ? "active" : "deactivated",
        changedAt: statusChangedAt,
      });
    }

    if (teamIds !== null) {
      const existing = await db
        .select({ teamId: workerTeams.teamId })
        .from(workerTeams)
        .where(eq(workerTeams.workerId, id));
      const existingIds = new Set(existing.map((r) => r.teamId));

      const toAdd = teamIds.filter((tid) => !existingIds.has(tid));
      const toRemove = [...existingIds].filter((tid) => !teamIds.includes(tid));

      if (toRemove.length > 0) {
        await db
          .delete(workerTeams)
          .where(and(eq(workerTeams.workerId, id), inArray(workerTeams.teamId, toRemove)));
      }

      if (toAdd.length > 0) {
        await db
          .insert(workerTeams)
          .values(toAdd.map((teamId) => ({ workerId: id, teamId })))
          .onConflictDoNothing({ target: [workerTeams.workerId, workerTeams.teamId] });

        await autoAssignTeamCoursesForNewMemberships(
          toAdd.map((teamId) => ({ workerId: id, teamId }))
        );
      }
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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const orgId = await requireOrgId().catch(() => null);
  if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;

  await db.delete(workers).where(and(eq(workers.id, id), eq(workers.organizationId, orgId)));

  return NextResponse.json({ success: true });
}
