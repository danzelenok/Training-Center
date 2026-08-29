import { NextResponse } from "next/server";
import { db } from "@/db";
import { courses } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const results = await db
      .select({
        id: courses.id,
        title: courses.title,
        status: courses.status,
        publishedAt: courses.publishedAt,
      })
      .from(courses)
      .where(eq(courses.organizationId, orgId))
      .orderBy(desc(courses.createdAt));

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("Error fetching report courses:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
