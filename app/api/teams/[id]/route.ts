import { db } from "@/db";
import { teams, workerTeams, workers } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;

    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) return new NextResponse("Not found", { status: 404 });

    const members = await db
      .select({
        id: workers.id,
        displayName: workers.displayName,
        firstName: workers.firstName,
        lastName: workers.lastName,
        active: workers.active,
      })
      .from(workerTeams)
      .innerJoin(workers, eq(workers.id, workerTeams.workerId))
      .where(eq(workerTeams.teamId, id));

    return NextResponse.json({ ...team, members });
  } catch (error: any) {
    console.error("Error fetching team:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Team name is required." }, { status: 400 });
    }

    const [updated] = await db
      .update(teams)
      .set({ name, updatedAt: new Date() })
      .where(eq(teams.id, id))
      .returning();

    if (!updated) return new NextResponse("Not found", { status: 404 });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json({ error: "A team with this name already exists." }, { status: 400 });
    }
    console.error("Error updating team:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;

  // Cascades worker_teams / course_auto_assign_teams rows only — assignments
  // and progress history for former members are untouched.
  await db.delete(teams).where(eq(teams.id, id));

  return NextResponse.json({ success: true });
}
