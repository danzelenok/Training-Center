import { db } from "@/db";
import { courses, slides, jurisdictions, organizationJurisdictions } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { roleOrUnauthorized } from "@/lib/adminRoles";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// POST /api/courses/[id]/clone — full, independent copy of a course + all its
// slides (base and jurisdiction addenda alike — slide-level jurisdictionId is
// left untouched, it's course-internal variability, not ownership) under a
// new owning jurisdiction. Not a live link: sourceOfCloneId is audit-only.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const roleResult = roleOrUnauthorized(req);
    if (roleResult instanceof Response) return roleResult;

    const [sourceCourse] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, id), eq(courses.organizationId, orgId)))
      .limit(1);
    if (!sourceCourse) {
      return new NextResponse("Course not found", { status: 404 });
    }

    // jurisdiction_admin always clones into their own jurisdiction; org_admin
    // (who has none of their own) must say which one in the body.
    let targetJurisdictionId: string;
    if (roleResult.role === "jurisdiction_admin") {
      if (!roleResult.jurisdictionId) {
        return NextResponse.json({ error: "Your admin role has no jurisdiction assigned." }, { status: 403 });
      }
      targetJurisdictionId = roleResult.jurisdictionId;
    } else {
      const body = await req.json().catch(() => ({}));
      if (typeof body.jurisdictionId !== "string" || !body.jurisdictionId) {
        return NextResponse.json({ error: "jurisdictionId is required." }, { status: 400 });
      }
      const [jurisdiction] = await db
        .select({ id: jurisdictions.id })
        .from(organizationJurisdictions)
        .innerJoin(jurisdictions, eq(jurisdictions.id, organizationJurisdictions.jurisdictionId))
        .where(and(eq(organizationJurisdictions.organizationId, orgId), eq(organizationJurisdictions.jurisdictionId, body.jurisdictionId)))
        .limit(1);
      if (!jurisdiction) {
        return NextResponse.json({ error: "Selected state was not found for this organization." }, { status: 400 });
      }
      targetJurisdictionId = jurisdiction.id;
    }

    const sourceSlides = await db.select().from(slides).where(eq(slides.courseId, id));

    const [newCourse] = await db
      .insert(courses)
      .values({
        organizationId: orgId,
        ownerJurisdictionId: targetJurisdictionId,
        sourceOfCloneId: sourceCourse.id,
        title: sourceCourse.title,
        description: sourceCourse.description,
        status: "draft",
        themeType: sourceCourse.themeType,
        themeValue: sourceCourse.themeValue,
        themePaletteId: sourceCourse.themePaletteId,
        themeVariantId: sourceCourse.themeVariantId,
        generationStatus: "ready",
      })
      .returning();

    if (sourceSlides.length > 0) {
      await db.insert(slides).values(
        sourceSlides.map((s) => ({
          courseId: newCourse.id,
          order: s.order,
          type: s.type,
          content: s.content,
          language: s.language,
          assetStatus: s.assetStatus,
          jurisdictionId: s.jurisdictionId, // internal per-slide variability, not ownership — copied as-is
        }))
      );
    }

    return NextResponse.json({
      ...newCourse,
      telegramMessageId: null,
      telegramGroupId: null,
    });
  } catch (error: any) {
    console.error("Error cloning course:", error);
    return NextResponse.json({ error: error.message || "Failed to clone course" }, { status: 500 });
  }
}
