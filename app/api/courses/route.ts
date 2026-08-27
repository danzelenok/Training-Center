import { db } from "@/db";
import { courses, slides, jurisdictions, organizationJurisdictions } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { roleOrUnauthorized } from "@/lib/adminRoles";
import { and, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

// 1. GET /api/courses - List all courses with slide count
export async function GET() {
  try {
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Fetch courses with slide counts using SQL count to avoid fetching all slides
    const results = await db
      .select({
        id: courses.id,
        title: courses.title,
        description: courses.description,
        status: courses.status,
        ownerJurisdictionId: courses.ownerJurisdictionId,
        telegramMessageId: courses.telegramMessageId,
        telegramGroupId: courses.telegramGroupId,
        createdAt: courses.createdAt,
        updatedAt: courses.updatedAt,
        slideCount: sql<number>`cast(count(${slides.id}) as int)`,
      })
      .from(courses)
      .leftJoin(slides, sql`${slides.courseId} = ${courses.id}`)
      .where(eq(courses.organizationId, orgId))
      .groupBy(courses.id)
      .orderBy(desc(courses.createdAt));

    // Convert bigints to strings/numbers to avoid JSON serialization errors
    const serializedResults = results.map(row => ({
      ...row,
      telegramMessageId: row.telegramMessageId ? row.telegramMessageId.toString() : null,
      telegramGroupId: row.telegramGroupId ? row.telegramGroupId.toString() : null,
    }));

    return NextResponse.json(serializedResults);
  } catch (error: any) {
    console.error("Error fetching courses:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

// 2. POST /api/courses - Create a new draft course
export async function POST(req: Request) {
  try {
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const roleResult = roleOrUnauthorized(req);
    if (roleResult instanceof Response) return roleResult;

    const body = await req.json();
    const { title, description } = body;

    if (!title) {
      return new NextResponse("Title is required", { status: 400 });
    }

    // A new course always needs an owning jurisdiction. jurisdiction_admin
    // can only ever create courses in their own jurisdiction (the client-
    // supplied value, if any, is ignored). org_admin has no jurisdiction of
    // their own, so they must pick one explicitly.
    let ownerJurisdictionId: string;
    if (roleResult.role === "jurisdiction_admin") {
      if (!roleResult.jurisdictionId) {
        return new NextResponse("Your admin role has no jurisdiction assigned.", { status: 403 });
      }
      ownerJurisdictionId = roleResult.jurisdictionId;
    } else {
      if (typeof body.jurisdictionId !== "string" || !body.jurisdictionId) {
        return NextResponse.json({ error: "jurisdictionId is required." }, { status: 400 });
      }
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
        return NextResponse.json({ error: "Selected state was not found for this organization." }, { status: 400 });
      }
      ownerJurisdictionId = jurisdiction.id;
    }

    const [newCourse] = await db
      .insert(courses)
      .values({
        organizationId: orgId,
        ownerJurisdictionId,
        title,
        description: description || "",
        status: "draft",
      })
      .returning();

    return NextResponse.json({
      ...newCourse,
      telegramMessageId: newCourse.telegramMessageId ? newCourse.telegramMessageId.toString() : null,
      telegramGroupId: newCourse.telegramGroupId ? newCourse.telegramGroupId.toString() : null,
    });
  } catch (error: any) {
    console.error("Error creating course:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
