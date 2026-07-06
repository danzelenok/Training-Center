import { db } from "@/db";
import { courses, slides } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, asc, sql, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

// 1. GET /api/courses/[id] - Fetch a course and all its slides ordered by 'order'
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, id))
      .limit(1);

    if (!course) {
      return new NextResponse("Course not found", { status: 404 });
    }

    const courseSlides = await db
      .select()
      .from(slides)
      .where(eq(slides.courseId, id))
      .orderBy(asc(slides.order));

    const responseData = {
      ...course,
      telegramMessageId: course.telegramMessageId ? course.telegramMessageId.toString() : null,
      telegramGroupId: course.telegramGroupId ? course.telegramGroupId.toString() : null,
      slides: courseSlides,
    };

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error("Error fetching course detail:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

// 2. PATCH /api/courses/[id] - Update course details & reconcile slides
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { title, description, themeType, themeValue, slides: updatedSlides, generationStatus } = body;

    // 1. Update Course details
    const [updatedCourse] = await db
      .update(courses)
      .set({
        title,
        ...(description !== undefined ? { description } : {}),
        themeType: themeType !== undefined ? themeType : undefined,
        themeValue: themeValue !== undefined ? themeValue : undefined,
        generationStatus: generationStatus !== undefined ? generationStatus : undefined,
        updatedAt: new Date(),
      })
      .where(eq(courses.id, id))
      .returning();

    if (!updatedCourse) {
      return new NextResponse("Course not found or could not be updated", { status: 404 });
    }

    // 2. Reconcile Slides (if provided)
    if (Array.isArray(updatedSlides)) {
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      // Fields written exclusively by Inngest/HeyGen — the client must never overwrite them.
      // We achieve this by never including them in PATCH UPDATE operations: instead we use
      // a jsonb merge (`content || $clientFields`) that only applies the non-owned keys,
      // leaving whatever Inngest last wrote untouched regardless of timing.
      const SERVER_OWNED = new Set([
        'instructorVideoUrl', 'studentVideoUrl',
        'heygenInstructorJobId', 'heygenStudentJobId',
        'assetUrl', 'url', 'audioUrl', 'captions',
      ]);

      const existingSlides = await db
        .select()
        .from(slides)
        .where(eq(slides.courseId, id));

      const existingById = new Map(existingSlides.map((s) => [s.id, s]));

      // Build the set of client-side IDs so we know which DB slides to delete
      const clientIds = new Set<string>();
      for (const slide of updatedSlides) {
        if (UUID_RE.test(slide.id || "")) clientIds.add(slide.id);
      }

      // Delete slides that were removed by the client
      const toDeleteIds = existingSlides.filter((s) => !clientIds.has(s.id)).map((s) => s.id);
      if (toDeleteIds.length > 0) {
        await db.delete(slides).where(inArray(slides.id, toDeleteIds));
      }

      // Upsert: UPDATE existing slides, INSERT new ones
      const seenIds = new Set<string>();
      const slidesToInsert: any[] = [];

      for (const [index, slide] of updatedSlides.entries()) {
        const isValidUUID = UUID_RE.test(slide.id || "");
        const existingSlide = isValidUUID ? existingById.get(slide.id) : undefined;

        const clientContent = (slide.content || {}) as Record<string, any>;
        const existingContent = (existingSlide?.content || {}) as Record<string, any>;

        // Build a content patch that excludes SERVER_OWNED keys entirely.
        // For existing slides we apply this via `content || $patch::jsonb` so the DB's
        // server-owned fields are never touched — no matter when Inngest writes them.
        const clientPatch: Record<string, any> = {};
        for (const [key, value] of Object.entries(clientContent)) {
          if (value !== undefined && !SERVER_OWNED.has(key)) {
            clientPatch[key] = value;
          }
        }

        // Preserve per-slot videoUrl from DB snapshot for dialogue slots
        if (Array.isArray(clientContent.slots)) {
          const existingSlots = Array.isArray(existingContent.slots) ? existingContent.slots : [];
          clientPatch.slots = clientContent.slots.map((cs: any) => {
            const es = existingSlots.find((s: any) => s.slotIndex === cs.slotIndex);
            return { ...cs, videoUrl: (es?.videoUrl && !cs.videoUrl) ? es.videoUrl : (cs.videoUrl ?? '') };
          });
        }

        if (existingSlide) {
          // UPDATE: jsonb-merge only the non-server-owned fields.
          // assetStatus is also preserved from DB — only Inngest/regenerate route should change it.
          await db
            .update(slides)
            .set({
              order: index + 1,
              type: (slide.type || existingSlide.type) as "text" | "video" | "audio" | "quiz" | "dialogue" | "chat" | "poll",
              language: slide.language || existingSlide.language || "en",
              content: sql`content || ${JSON.stringify(clientPatch)}::jsonb`,
              updatedAt: new Date(),
            })
            .where(eq(slides.id, existingSlide.id));
        } else {
          // INSERT new slide — no existing content to protect, so clientPatch is the full content
          let resolvedId: string | undefined;
          if (isValidUUID) resolvedId = slide.id as string;
          if (resolvedId && seenIds.has(resolvedId)) resolvedId = crypto.randomUUID();
          if (resolvedId) seenIds.add(resolvedId);

          slidesToInsert.push({
            ...(resolvedId ? { id: resolvedId } : {}),
            courseId: id,
            order: index + 1,
            type: (slide.type || "text") as "text" | "video" | "audio" | "quiz" | "dialogue" | "chat" | "poll",
            content: clientPatch,
            language: slide.language || "en",
            assetStatus: (slide.assetStatus || "ready") as "pending" | "generating" | "ready" | "failed",
          });
        }
      }

      if (slidesToInsert.length > 0) {
        await db.insert(slides).values(slidesToInsert);
      }
    }

    // Fetch the updated slides to return to the client
    const finalSlides = await db
      .select()
      .from(slides)
      .where(eq(slides.courseId, id))
      .orderBy(asc(slides.order));

    const result = {
      ...updatedCourse,
      slides: finalSlides,
    };

    return NextResponse.json({
      ...result,
      telegramMessageId: result.telegramMessageId ? result.telegramMessageId.toString() : null,
      telegramGroupId: result.telegramGroupId ? result.telegramGroupId.toString() : null,
    });
  } catch (error: any) {
    console.error("Error updating course:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

// 3. DELETE /api/courses/[id] - Delete a course
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const [deletedCourse] = await db
      .delete(courses)
      .where(eq(courses.id, id))
      .returning();

    if (!deletedCourse) {
      return new NextResponse("Course not found", { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting course:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
