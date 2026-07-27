import { db } from "@/db";
import { workers, assignments, progress, workerTeams, teams } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 1. Fetch workers with their course count and team memberships
    const results = await db
      .select({
        id: workers.id,
        telegramUserId: workers.telegramUserId,
        telegramUsername: workers.telegramUsername,
        firstName: workers.firstName,
        lastName: workers.lastName,
        displayName: workers.displayName,
        phone: workers.phone,
        active: workers.active,
        deactivatedAt: workers.deactivatedAt,
        createdAt: workers.createdAt,
        updatedAt: workers.updatedAt,
        coursesAssigned: sql<number>`cast(count(distinct ${assignments.id}) as int)`,
      })
      .from(workers)
      .leftJoin(assignments, sql`${assignments.workerId} = ${workers.id}`)
      .groupBy(workers.id)
      .orderBy(desc(workers.createdAt));

    const teamMemberships = await db
      .select({ workerId: workerTeams.workerId, teamId: teams.id, teamName: teams.name })
      .from(workerTeams)
      .innerJoin(teams, eq(teams.id, workerTeams.teamId));

    const teamsByWorker = new Map<string, { id: string; name: string }[]>();
    for (const m of teamMemberships) {
      const list = teamsByWorker.get(m.workerId) ?? [];
      list.push({ id: m.teamId, name: m.teamName });
      teamsByWorker.set(m.workerId, list);
    }

    const serialized = results.map((w) => ({
      ...w,
      telegramUserId: w.telegramUserId ? w.telegramUserId.toString() : null,
      teams: teamsByWorker.get(w.id) ?? [],
    }));

    const activeWorkers = serialized.filter((w) => w.active);
    const deactivatedCount = serialized.length - activeWorkers.length;

    // 2. Active This Week count (active workers with progress updated in the last 7 days)
    const activeThisWeekResult = await db
      .select({ count: sql<number>`cast(count(distinct ${progress.workerId}) as int)` })
      .from(progress)
      .innerJoin(workers, eq(workers.id, progress.workerId))
      .where(sql`${workers.active} = true and ${progress.updatedAt} >= now() - interval '7 days'`);

    const activeThisWeek = activeThisWeekResult[0]?.count || 0;

    // 3. Pending Modules count — assignments (of active workers) that aren't completed yet.
    // A course only gets a `progress` row once the worker opens it, so this has to start
    // from `assignments` and treat a missing progress row as "not started", not skip it.
    const pendingModulesResult = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(assignments)
      .innerJoin(workers, eq(workers.id, assignments.workerId))
      .leftJoin(
        progress,
        sql`${progress.workerId} = ${assignments.workerId} and ${progress.courseId} = ${assignments.courseId}`
      )
      .where(sql`${workers.active} = true and coalesce(${progress.status}, 'not_started') != 'completed'`);

    const pendingModules = pendingModulesResult[0]?.count || 0;

    return NextResponse.json({
      workers: serialized,
      totalCount: activeWorkers.length,
      activeThisWeek,
      pendingModules,
      deactivatedCount,
    });
  } catch (error: any) {
    console.error("Error fetching workers:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

export { POST } from "../admin/workers/route";
