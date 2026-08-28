import { db } from "@/db";
import { jobRoles } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const results = await db
      .select({
        id: jobRoles.id,
        name: jobRoles.name,
        createdAt: jobRoles.createdAt,
        updatedAt: jobRoles.updatedAt,
      })
      .from(jobRoles)
      .where(eq(jobRoles.organizationId, orgId))
      .orderBy(desc(jobRoles.createdAt));

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("Error fetching job roles:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Role name is required." }, { status: 400 });
    }

    const [role] = await db.insert(jobRoles).values({ organizationId: orgId, name }).returning();

    return NextResponse.json(role);
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json({ error: "A role with this name already exists." }, { status: 400 });
    }
    console.error("Error creating job role:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
