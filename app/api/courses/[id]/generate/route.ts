import { db } from "@/db";
import { courses, slides, jurisdictions, courseSources } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { roleOrUnauthorized, canWriteCourse } from "@/lib/adminRoles";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { generateCourseStructure, slideNeedsGeneratedAsset } from "@/lib/gemini";
import { fetchRegulatoryContext } from "@/lib/regulatory-scraper";
import { inngest } from "@/lib/inngest";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth Check
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const roleResult = roleOrUnauthorized(req);
    if (roleResult instanceof Response) return roleResult;

    // Verify course exists and belongs to this organization
    const [course] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, id), eq(courses.organizationId, orgId)))
      .limit(1);

    if (!course) {
      return new NextResponse("Course not found", { status: 404 });
    }
    if (!canWriteCourse(roleResult, course.ownerJurisdictionId)) {
      return NextResponse.json({ error: "You can only generate content for courses owned by your jurisdiction." }, { status: 403 });
    }

    if (course.generationStatus === "generating") {
      return new NextResponse("Generation already in progress", { status: 409 });
    }

    // Parse request body
    const body = await req.json();
    const { prompt, model, useLNI = true, jurisdictionId } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return new NextResponse("Prompt is required", { status: 400 });
    }

    // Determine target model (fast -> gemini-3.5-flash, advanced -> gemini-2.5-pro)
    const modelIdentifier = model === "fast" ? "gemini-3.5-flash" : "gemini-2.5-pro";

    // Resolve which regulator's site to ground the base generation on. Defaults
    // to the federal OSHA record — the two-step flow (Ticket 5) generates the
    // base course from federal materials, then layers state-specific addenda
    // on top via /generate-addendum. Passing jurisdictionId here still lets a
    // caller ground the base directly on one state when there's no need for
    // an intermediate federal base.
    const [jurisdiction] =
      typeof jurisdictionId === "string" && jurisdictionId
        ? await db.select().from(jurisdictions).where(eq(jurisdictions.id, jurisdictionId)).limit(1)
        : await db.select().from(jurisdictions).where(eq(jurisdictions.code, "FEDERAL")).limit(1);

    if (!jurisdiction) {
      return new NextResponse("Jurisdiction not found", { status: 400 });
    }

    // Fetch regulatory context (non-blocking — generation continues if this fails)
    let regulatoryContext: string | undefined;
    let sourcesDescription: string | undefined;

    if (useLNI) {
      try {
        const domain = new URL(jurisdiction.baseSourceUrl).hostname;
        const reg = await fetchRegulatoryContext(prompt, domain, jurisdiction.regulatorName);
        console.log("[Regulatory] sources found:", reg.sources.length);
        if (reg.sources.length > 0) {
          regulatoryContext = reg.sourcesText;
          sourcesDescription = reg.sourcesDescription;
          console.log("[Regulatory] sourcesDescription set:", sourcesDescription.slice(0, 100));
        }
      } catch (err) {
        console.warn("[Regulatory] Failed to fetch context, proceeding without it:", err);
      }
    } else {
      console.log("[Regulatory] Skipped by user toggle");
    }

    // Call Gemini structure generator with selected model
    const generatedSlides = await generateCourseStructure(prompt, modelIdentifier, regulatoryContext, jurisdiction.regulatorName);

    // 1. Delete all existing EN slides for this course
    await db
      .delete(slides)
      .where(
        and(
          eq(slides.courseId, id),
          eq(slides.language, "en")
        )
      );

    // 2. Prepare slide inserts
    const slidesToInsert = generatedSlides.map((slide, index) => ({
      courseId: id,
      order: index + 1,
      type: slide.type,
      content: slide.content,
      language: "en",
      assetStatus: (slideNeedsGeneratedAsset(slide) ? "pending" : "ready") as "pending" | "ready",
    }));

    let finalSlides: any[] = [];
    if (slidesToInsert.length > 0) {
      finalSlides = await db
        .insert(slides)
        .values(slidesToInsert)
        .returning();
    }

    // 3. Update course description with regulatory sources if found
    console.log("[Regulatory] sourcesDescription before DB update:", sourcesDescription ? sourcesDescription.slice(0, 100) : "undefined");
    if (sourcesDescription) {
      await db
        .update(courses)
        .set({ description: sourcesDescription, updatedAt: new Date() })
        .where(eq(courses.id, id));
      console.log("[Regulatory] description updated in DB");

      // Record the base course source (jurisdictionId null). Nullable columns
      // don't participate in the (courseId, jurisdictionId) unique constraint's
      // conflict detection in Postgres, so upsert manually instead of relying
      // on onConflictDoUpdate.
      const [existingBaseSource] = await db
        .select({ id: courseSources.id })
        .from(courseSources)
        .where(and(eq(courseSources.courseId, id), isNull(courseSources.jurisdictionId)))
        .limit(1);

      if (existingBaseSource) {
        await db
          .update(courseSources)
          .set({ sourceUrl: jurisdiction.baseSourceUrl, retrievedAt: new Date() })
          .where(eq(courseSources.id, existingBaseSource.id));
      } else {
        await db.insert(courseSources).values({
          courseId: id,
          jurisdictionId: null,
          sourceUrl: jurisdiction.baseSourceUrl,
        });
      }
    }

    // 4. Set courses.generationStatus = generating
    await db
      .update(courses)
      .set({
        generationStatus: "generating",
        updatedAt: new Date(),
      })
      .where(eq(courses.id, id));

    // 4. Trigger background asset generation event
    await inngest.send({
      name: "course/generate.assets",
      data: { courseId: id, organizationId: orgId },
    });

    return NextResponse.json(finalSlides);
  } catch (error: any) {
    console.error("Error generating AI slide structure:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate slide structure" },
      { status: 500 }
    );
  }
}
