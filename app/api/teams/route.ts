import { db } from "@/db";
import { teams, workerTeams } from "@/db/schema";
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

    const results = await db
      .select({
        id: teams.id,
        name: teams.name,
        createdAt: teams.createdAt,
        updatedAt: teams.updatedAt,
        memberCount: sql<number>`cast(count(${workerTeams.id}) as int)`,
      })
      .from(teams)
      .leftJoin(workerTeams, sql`${workerTeams.teamId} = ${teams.id}`)
      .groupBy(teams.id)
      .orderBy(desc(teams.createdAt));

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("Error fetching teams:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Team name is required." }, { status: 400 });
    }

    const [team] = await db.insert(teams).values({ name }).returning();

    return NextResponse.json({ ...team, memberCount: 0 });
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json({ error: "A team with this name already exists." }, { status: 400 });
    }
    console.error("Error creating team:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
