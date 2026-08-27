import { db } from "@/db";
import { courses, slides } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { roleOrUnauthorized, canWriteCourse } from "@/lib/adminRoles";
import { eq, and, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const orgId = await requireOrgId().catch(() => null);
  if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

  const roleResult = roleOrUnauthorized(_req);
  if (roleResult instanceof Response) return roleResult;

  const [course] = await db.select().from(courses).where(and(eq(courses.id, id), eq(courses.organizationId, orgId))).limit(1);
  if (!course) return new NextResponse("Course not found", { status: 404 });
  if (!canWriteCourse(roleResult, course.ownerJurisdictionId)) {
    return NextResponse.json({ error: "You can only retry assets for courses owned by your jurisdiction." }, { status: 403 });
  }

  // Find all slides that are not yet finished
  const stuckSlides = await db
    .select()
    .from(slides)
    .where(
      and(
        eq(slides.courseId, id),
        eq(slides.language, "en"),
        inArray(slides.assetStatus, ["generating", "pending", "failed"])
      )
    );

  if (stuckSlides.length === 0) {
    return NextResponse.json({ success: true, retried: 0 });
  }

  // Reset all stuck slides to "generating" and mark course as generating
  await db
    .update(slides)
    .set({ assetStatus: "generating", updatedAt: new Date() })
    .where(
      and(
        eq(slides.courseId, id),
        eq(slides.language, "en"),
        inArray(slides.assetStatus, ["generating", "pending", "failed"])
      )
    );

  await db
    .update(courses)
    .set({ generationStatus: "generating", updatedAt: new Date() })
    .where(eq(courses.id, id));

  // Send a slide/regenerate event for each stuck slide
  const events = stuckSlides.map((slide) => {
    const content = (slide.content || {}) as Record<string, any>;
    let assetType: "audio" | "video" | "photo";

    if (slide.type === "audio") {
      assetType = "audio";
    } else if (slide.type === "video" || slide.type === "dialogue") {
      assetType = "video";
    } else {
      // text or chat slide with visualKeywords
      assetType = "photo";
    }

    return {
      name: "slide/regenerate" as const,
      data: { slideId: slide.id, assetType, courseId: id, organizationId: orgId },
    };
  });

  await inngest.send(events);

  return NextResponse.json({ success: true, retried: stuckSlides.length });
}
