import { db } from "@/db";
import { workers, assignments, progress } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 1. Fetch workers
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
        createdAt: workers.createdAt,
        updatedAt: workers.updatedAt,
        coursesAssigned: sql<number>`cast(count(${assignments.id}) as int)`,
      })
      .from(workers)
      .leftJoin(assignments, sql`${assignments.workerId} = ${workers.id}`)
      .groupBy(workers.id)
      .orderBy(desc(workers.createdAt));

    const serialized = results.map((w) => ({
      ...w,
      telegramUserId: w.telegramUserId ? w.telegramUserId.toString() : null,
    }));

    // 2. Fetch Active This Week count (workers with progress updated in the last 7 days)
    const activeThisWeekResult = await db
      .select({ count: sql<number>`cast(count(distinct ${progress.workerId}) as int)` })
      .from(progress)
      .where(sql`${progress.updatedAt} >= now() - interval '7 days'`);

    const activeThisWeek = activeThisWeekResult[0]?.count || 0;

    // 3. Fetch Pending Modules count (progress records that are not completed)
    const pendingModulesResult = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(progress)
      .where(sql`${progress.status} != 'completed'`);

    const pendingModules = pendingModulesResult[0]?.count || 0;

    return NextResponse.json(serialized, {
      headers: {
        "x-total-count": results.length.toString(),
        "x-active-this-week": activeThisWeek.toString(),
        "x-pending-modules": pendingModules.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error fetching workers:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

export { POST } from "../admin/workers/route";
