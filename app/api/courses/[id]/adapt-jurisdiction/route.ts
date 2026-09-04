import { db } from "@/db";
import { courses, slides, jurisdictions } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { roleOrUnauthorized, canWriteCourse } from "@/lib/adminRoles";
import { and, asc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { adaptCourseToJurisdiction, slideNeedsGeneratedAsset, type SlideInput } from "@/lib/gemini";
import { fetchRegulatoryContext } from "@/lib/regulatory-scraper";
import { inngest } from "@/lib/inngest";

// Fields written exclusively by the async asset pipeline (HeyGen/media) —
// mirrors the SERVER_OWNED set in app/api/courses/[id]/route.ts's slide-
// reconcile PATCH (kept as its own literal here rather than importing from
// that route module, which doesn't export it). Never sent to Gemini, never
// modified by this route — rewriting is text-only.
const SERVER_OWNED = new Set([
  "instructorVideoUrl", "studentVideoUrl",
  "heygenInstructorJobId", "heygenStudentJobId",
  "assetUrl", "url", "audioUrl", "captions",
]);

function stripServerOwned(content: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(content)) {
    if (!SERVER_OWNED.has(key)) clean[key] = value;
  }
  return clean;
}

// Order-independent structural stringify — object keys are sorted
// recursively before serializing (array element order is preserved, since
// that's semantically meaningful: quiz option order, dialogue line order,
// etc.). Plain JSON.stringify is key-order-sensitive, which produced false
// positives here: Gemini's JSON output re-serializes object keys in
// whatever order it lands on (observed: matching the field order shown in
// the slideTypeCatalog few-shot examples) rather than preserving the DB's
// stored key order, even when every value is byte-identical to the input —
// confirmed empirically during DAN-19 testing (an audio slide with
// unchanged heading/body/audioScript still tripped a naive JSON.stringify
// diff). Comparing structurally, not textually, is required for an
// accurate "did this slide's content actually change" check.
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

// POST /api/courses/[id]/adapt-jurisdiction — rewrites a cloned course's
// existing base slides (language "en", jurisdictionId IS NULL — the
// per-slide jurisdictionId variant mechanism is unrelated and untouched) in
// place, adapting jurisdiction-specific content (norms, temperatures,
// regulator references, terminology) from the course it was cloned from to
// its current ownerJurisdictionId. Replaces the old addendum flow, which
// only ever added new slides and never rewrote existing ones.
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

    const [course] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, id), eq(courses.organizationId, orgId)))
      .limit(1);

    if (!course) {
      return new NextResponse("Course not found", { status: 404 });
    }
    if (!canWriteCourse(roleResult, course.ownerJurisdictionId)) {
      return NextResponse.json({ error: "You can only adapt courses owned by your jurisdiction." }, { status: 403 });
    }

    // Target is always the course's current owner jurisdiction — set at
    // clone time (or by reassigning ownership afterward), never a separate
    // picker (see Sidebar.tsx's "Adapt to Jurisdiction" button).
    const [targetJurisdiction] = await db
      .select()
      .from(jurisdictions)
      .where(eq(jurisdictions.id, course.ownerJurisdictionId))
      .limit(1);
    if (!targetJurisdiction) {
      return new NextResponse("Target jurisdiction not found", { status: 400 });
    }

    // Source is the course this one was cloned from — adapting only makes
    // sense for a clone whose ownerJurisdictionId has since diverged from
    // where its content was originally written.
    if (!course.sourceOfCloneId) {
      return NextResponse.json(
        { error: "This course has no clone lineage — nothing to adapt from." },
        { status: 400 }
      );
    }
    const [sourceCourse] = await db
      .select({ ownerJurisdictionId: courses.ownerJurisdictionId })
      .from(courses)
      .where(eq(courses.id, course.sourceOfCloneId))
      .limit(1);
    if (!sourceCourse) {
      return NextResponse.json(
        { error: "The original course this was cloned from no longer exists." },
        { status: 400 }
      );
    }
    const [sourceJurisdiction] = await db
      .select()
      .from(jurisdictions)
      .where(eq(jurisdictions.id, sourceCourse.ownerJurisdictionId))
      .limit(1);
    if (!sourceJurisdiction) {
      return new NextResponse("Source jurisdiction not found", { status: 400 });
    }
    if (sourceJurisdiction.id === targetJurisdiction.id) {
      return NextResponse.json(
        { error: "This course is still in its original jurisdiction — nothing to adapt." },
        { status: 400 }
      );
    }

    // Only base slides (jurisdictionId IS NULL) — the per-slide jurisdiction
    // variant mechanism (slides.jurisdictionId, "null = base slide, shown to
    // all") is a separate, unrelated concern this route doesn't touch.
    const existingSlideRows = await db
      .select()
      .from(slides)
      .where(and(eq(slides.courseId, id), eq(slides.language, "en"), isNull(slides.jurisdictionId)))
      .orderBy(asc(slides.order));

    if (existingSlideRows.length === 0) {
      return new NextResponse("Course has no base slides to adapt.", { status: 400 });
    }

    const cleanSlides: SlideInput[] = existingSlideRows.map((s) => ({
      type: s.type,
      content: stripServerOwned(s.content as Record<string, unknown>),
    })) as SlideInput[];

    const domain = new URL(targetJurisdiction.baseSourceUrl).hostname;
    const regContext = await fetchRegulatoryContext(course.title, domain, targetJurisdiction.regulatorName);

    const rewrittenSlides = await adaptCourseToJurisdiction(
      cleanSlides,
      sourceJurisdiction.name,
      targetJurisdiction.name,
      regContext.sourcesText
    );

    // Defensive: the system prompt requires the model to preserve count,
    // order, and type — but nothing forces it to. Abort rather than write a
    // structurally-broken deck if it didn't comply.
    if (rewrittenSlides.length !== existingSlideRows.length) {
      return NextResponse.json(
        { error: "AI returned a different number of slides than expected — adaptation aborted, nothing was changed." },
        { status: 502 }
      );
    }
    for (let i = 0; i < existingSlideRows.length; i++) {
      if (rewrittenSlides[i].type !== existingSlideRows[i].type) {
        return NextResponse.json(
          { error: "AI changed a slide's type — adaptation aborted, nothing was changed." },
          { status: 502 }
        );
      }
    }

    // Update each slide in place — id, order, type untouched, only content
    // replaces the non-server-owned fields. assetStatus flips to "pending"
    // only for slides whose text actually changed AND whose type needs a
    // generated asset — the existing video/audio is now stale. Each such
    // slide is also enqueued for regeneration below (same "slide/regenerate"
    // event as retry-assets/route.ts), so a changed slide's asset actually
    // gets rebuilt instead of sitting at "pending" indefinitely.
    let changedCount = 0;
    const slidesToRegenerate: { slideId: string; assetType: "audio" | "video" | "photo" }[] = [];
    for (let i = 0; i < existingSlideRows.length; i++) {
      const existing = existingSlideRows[i];
      const rewritten = rewrittenSlides[i];
      const existingClean = stripServerOwned(existing.content as Record<string, unknown>);
      const textChanged = stableStringify(existingClean) !== stableStringify(rewritten.content);
      if (!textChanged) continue;

      changedCount++;
      const mergedContent = { ...(existing.content as Record<string, unknown>), ...rewritten.content };
      const needsAsset = slideNeedsGeneratedAsset({ type: existing.type, content: mergedContent });

      await db
        .update(slides)
        .set({
          content: mergedContent,
          assetStatus: needsAsset ? "pending" : existing.assetStatus,
          updatedAt: new Date(),
        })
        .where(eq(slides.id, existing.id));

      if (needsAsset) {
        const assetType: "audio" | "video" | "photo" =
          existing.type === "audio" ? "audio" : existing.type === "video" || existing.type === "dialogue" ? "video" : "photo";
        slidesToRegenerate.push({ slideId: existing.id, assetType });
      }
    }

    if (slidesToRegenerate.length > 0) {
      await db
        .update(courses)
        .set({ generationStatus: "generating", updatedAt: new Date() })
        .where(eq(courses.id, id));

      await inngest.send(
        slidesToRegenerate.map(({ slideId, assetType }) => ({
          name: "slide/regenerate" as const,
          data: { slideId, assetType, courseId: id, organizationId: orgId },
        }))
      );
    }

    return NextResponse.json({
      totalSlides: existingSlideRows.length,
      changedCount,
      sourceJurisdiction: sourceJurisdiction.code,
      targetJurisdiction: targetJurisdiction.code,
    });
  } catch (error: any) {
    console.error("Error adapting course to jurisdiction:", error);
    return NextResponse.json(
      { error: error.message || "Failed to adapt course to jurisdiction" },
      { status: 500 }
    );
  }
}
