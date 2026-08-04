import { db } from "@/db";
import { courses, slides, jurisdictions, courseSources } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { generateJurisdictionAddendum, slideNeedsGeneratedAsset, type SlideInput } from "@/lib/gemini";
import { fetchRegulatoryContext } from "@/lib/regulatory-scraper";
import { inngest } from "@/lib/inngest";

interface JurisdictionResult {
  jurisdictionId: string;
  code: string;
  status: "ok" | "error";
  slideCount?: number;
  error?: string;
}

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

    const [course] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, id), eq(courses.organizationId, orgId)))
      .limit(1);

    if (!course) {
      return new NextResponse("Course not found", { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const jurisdictionIds: unknown = body.jurisdictionIds;
    if (!Array.isArray(jurisdictionIds) || jurisdictionIds.length === 0 || !jurisdictionIds.every((j) => typeof j === "string")) {
      return new NextResponse("jurisdictionIds (non-empty array of strings) is required", { status: 400 });
    }

    // Base slides give the addendum model context on what's already covered,
    // so it doesn't repeat it.
    const baseSlideRows = await db
      .select()
      .from(slides)
      .where(and(eq(slides.courseId, id), eq(slides.language, "en"), isNull(slides.jurisdictionId)))
      .orderBy(asc(slides.order));

    if (baseSlideRows.length === 0) {
      return new NextResponse("Course has no base slides yet — generate the base course first.", { status: 400 });
    }

    const baseSlides = baseSlideRows.map((s) => ({ type: s.type, content: s.content })) as unknown as SlideInput[];

    const results: JurisdictionResult[] = [];
    const allPendingSlideIds: { slideId: string; assetType: "audio" | "video" | "photo" }[] = [];

    // Sequential on purpose — running 3 states in parallel would fan out into
    // 3x the Gemini + Brave calls at once and risk hitting rate limits.
    for (const jurisdictionId of jurisdictionIds) {
      try {
        const [jurisdiction] = await db.select().from(jurisdictions).where(eq(jurisdictions.id, jurisdictionId)).limit(1);
        if (!jurisdiction) {
          results.push({ jurisdictionId, code: "?", status: "error", error: "Jurisdiction not found" });
          continue;
        }

        const domain = new URL(jurisdiction.baseSourceUrl).hostname;
        const regContext = await fetchRegulatoryContext(course.title, domain, jurisdiction.regulatorName);

        const addendumSlides = await generateJurisdictionAddendum(
          baseSlides,
          jurisdiction.name,
          regContext.sourcesText,
          course.title
        );

        const [maxOrderRow] = await db
          .select({ maxOrder: sql<number>`coalesce(max(${slides.order}), 0)` })
          .from(slides)
          .where(eq(slides.courseId, id));
        let nextOrder = maxOrderRow.maxOrder + 1;

        const rowsToInsert = addendumSlides.map((slide) => ({
          courseId: id,
          order: nextOrder++,
          type: slide.type,
          content: slide.content,
          language: "en",
          jurisdictionId: jurisdiction.id,
          assetStatus: (slideNeedsGeneratedAsset(slide) ? "pending" : "ready") as "pending" | "ready",
        }));

        const insertedSlides = await db.insert(slides).values(rowsToInsert).returning();

        // course_sources for this (course, jurisdiction) pair — jurisdictionId
        // is non-null here so, unlike the base/null row, Postgres's normal
        // ON CONFLICT detection applies.
        await db
          .insert(courseSources)
          .values({ courseId: id, jurisdictionId: jurisdiction.id, sourceUrl: jurisdiction.baseSourceUrl })
          .onConflictDoUpdate({
            target: [courseSources.courseId, courseSources.jurisdictionId],
            set: { sourceUrl: jurisdiction.baseSourceUrl, retrievedAt: new Date() },
          });

        for (const slide of insertedSlides) {
          if (slide.assetStatus !== "pending") continue;
          let assetType: "audio" | "video" | "photo";
          if (slide.type === "audio") assetType = "audio";
          else if (slide.type === "video" || slide.type === "dialogue") assetType = "video";
          else assetType = "photo";
          allPendingSlideIds.push({ slideId: slide.id, assetType });
        }

        results.push({ jurisdictionId: jurisdiction.id, code: jurisdiction.code, status: "ok", slideCount: insertedSlides.length });
      } catch (err: any) {
        console.error(`Addendum generation failed for jurisdiction ${jurisdictionId}:`, err);
        results.push({ jurisdictionId, code: "?", status: "error", error: err.message || "Unknown error" });
      }
    }

    // Kick off asset generation only for the newly-inserted addendum slides
    // that need one — not the whole course's `course/generate.assets` event,
    // which would blindly reprocess every already-ready base slide too.
    if (allPendingSlideIds.length > 0) {
      await db.update(courses).set({ generationStatus: "generating", updatedAt: new Date() }).where(eq(courses.id, id));
      await inngest.send(
        allPendingSlideIds.map(({ slideId, assetType }) => ({
          name: "slide/regenerate" as const,
          data: { slideId, assetType, courseId: id, organizationId: orgId },
        }))
      );
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("Error generating jurisdiction addendum:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate jurisdiction addendum" },
      { status: 500 }
    );
  }
}
