import { db } from "@/db";
import { assignments, workers, courses, progress, reminderLogs, reminderSettings } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { roleOrUnauthorized } from "@/lib/adminRoles";
import { eq, and, or, isNull, ne, lt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_REMINDERS_AFTER_COUNT = 1;

// Workers who are overdue, not completed, and have already received every
// configured "after" reminder — no more automatic nudges are coming, so
// this is the one case that needs a human to notice.
export async function GET(req: Request) {
  try {
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const roleResult = roleOrUnauthorized(req);
    if (roleResult instanceof Response) return roleResult;

    const [settingsRow] = await db
      .select({ remindersAfterCount: reminderSettings.remindersAfterCount })
      .from(reminderSettings)
      .where(eq(reminderSettings.organizationId, orgId))
      .limit(1);
    const remindersAfterCount = settingsRow?.remindersAfterCount ?? DEFAULT_REMINDERS_AFTER_COUNT;

    const afterCounts = db.$with("after_counts").as(
      db
        .select({
          assignmentId: reminderLogs.assignmentId,
          count: sql<number>`cast(count(*) as int)`.as("count"),
        })
        .from(reminderLogs)
        .where(eq(reminderLogs.kind, "after"))
        .groupBy(reminderLogs.assignmentId)
    );

    const rows = await db
      .with(afterCounts)
      .select({
        assignmentId: assignments.id,
        workerId: workers.id,
        displayName: workers.displayName,
        firstName: workers.firstName,
        lastName: workers.lastName,
        courseName: courses.title,
        dueDate: assignments.dueDate,
      })
      .from(assignments)
      .innerJoin(workers, and(eq(assignments.workerId, workers.id), eq(workers.organizationId, orgId), eq(workers.active, true)))
      .innerJoin(courses, eq(assignments.courseId, courses.id))
      .leftJoin(progress, and(eq(progress.workerId, assignments.workerId), eq(progress.courseId, assignments.courseId)))
      .leftJoin(afterCounts, eq(afterCounts.assignmentId, assignments.id))
      .where(and(
        or(isNull(progress.status), ne(progress.status, "completed"))!,
        lt(assignments.dueDate, new Date()),
        sql`coalesce(${afterCounts.count}, 0) >= ${remindersAfterCount}`
      ))
      .orderBy(assignments.dueDate);

    return NextResponse.json(
      rows.map((r) => {
        const nameParts = [r.firstName, r.lastName].filter(Boolean);
        return {
          assignmentId: r.assignmentId,
          workerId: r.workerId,
          workerName: r.displayName || (nameParts.length > 0 ? nameParts.join(" ") : "Unnamed Worker"),
          courseName: r.courseName,
          dueDate: r.dueDate,
        };
      })
    );
  } catch (error: any) {
    console.error("GET /api/admin/dashboard/reminders-exhausted error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
