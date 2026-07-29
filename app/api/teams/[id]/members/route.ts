import { db } from "@/db";
import { workerTeams, teams, workers } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { and, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { autoAssignTeamCoursesForNewMemberships } from "@/lib/teamAutoAssign";

export const dynamic = "force-dynamic";

// Replaces a team's full worker roster. Removed members keep any assignments
// they already have — course removal stays a separate, explicit action.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

    const { id: teamId } = await params;

    const [team] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.organizationId, orgId)))
      .limit(1);
    if (!team) return new NextResponse("Not found", { status: 404 });

    const body = await req.json().catch(() => ({}));
    const requestedWorkerIds: string[] = Array.isArray(body.workerIds) ? body.workerIds : [];
    // Write-time invariant: only ever add workers that belong to this organization.
    const workerIds = requestedWorkerIds.length
      ? (
          await db
            .select({ id: workers.id })
            .from(workers)
            .where(and(inArray(workers.id, requestedWorkerIds), eq(workers.organizationId, orgId)))
        ).map((w) => w.id)
      : [];

    const existing = await db
      .select({ workerId: workerTeams.workerId })
      .from(workerTeams)
      .where(eq(workerTeams.teamId, teamId));
    const existingIds = new Set(existing.map((r) => r.workerId));

    const toAdd = workerIds.filter((wid) => !existingIds.has(wid));
    const toRemove = [...existingIds].filter((wid) => !workerIds.includes(wid));

    if (toRemove.length > 0) {
      await db
        .delete(workerTeams)
        .where(and(eq(workerTeams.teamId, teamId), inArray(workerTeams.workerId, toRemove)));
    }

    if (toAdd.length > 0) {
      await db
        .insert(workerTeams)
        .values(toAdd.map((workerId) => ({ workerId, teamId })))
        .onConflictDoNothing({ target: [workerTeams.workerId, workerTeams.teamId] });

      await autoAssignTeamCoursesForNewMemberships(
        toAdd.map((workerId) => ({ workerId, teamId }))
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating team roster:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
