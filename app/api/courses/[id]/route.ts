import { db } from "@/db";
import { courses, slides } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, asc } from "drizzle-orm";
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

      await db.transaction(async (tx) => {
        const existingSlides = await tx
          .select()
          .from(slides)
          .where(eq(slides.courseId, id));

        await tx.delete(slides).where(eq(slides.courseId, id));

        if (updatedSlides.length > 0) {
          // Detect duplicate IDs in the client payload and assign fresh UUIDs to avoid
          // a PK violation that would otherwise leave the course with no slides after the delete.
          const seenIds = new Set<string>();
          const slidesToInsert = updatedSlides.map((slide, index) => {
            const existingSlide = UUID_RE.test(slide.id || "")
              ? existingSlides.find((es) => es.id === slide.id)
              : undefined;

            const existingContent = (existingSlide?.content || {}) as Record<string, any>;
            const clientContent = (slide.content || {}) as Record<string, any>;

            // Fields set server-side (Inngest/HeyGen) that the client must never clear once populated.
            // Auto-save fires with stale client state and would wipe freshly-saved video URLs
            // before the frontend polling has a chance to pick them up.
            const SERVER_OWNED = new Set([
              'instructorVideoUrl', 'studentVideoUrl',
              'heygenInstructorJobId', 'heygenStudentJobId',
              'assetUrl', 'url', 'audioUrl', 'captions',
            ]);

            const mergedContent = { ...existingContent };
            for (const key of Object.keys(clientContent)) {
              if (clientContent[key] !== undefined) {
                // Never let client clear a value that the server already set
                if (SERVER_OWNED.has(key) && existingContent[key] && !clientContent[key]) continue;
                mergedContent[key] = clientContent[key];
              }
            }

            // For dialogue slots: preserve server-set videoUrl per slot even if client sends empty
            if (Array.isArray(clientContent.slots) && Array.isArray(existingContent.slots)) {
              mergedContent.slots = clientContent.slots.map((cs: any) => {
                const es = existingContent.slots.find((s: any) => s.slotIndex === cs.slotIndex);
                return { ...cs, videoUrl: (es?.videoUrl && !cs.videoUrl) ? es.videoUrl : (cs.videoUrl ?? '') };
              });
            }

            const mergedAssetStatus = existingSlide ? existingSlide.assetStatus : (slide.assetStatus || "ready");

            // Determine ID: prefer preserved existing UUID, fall back to client UUID,
            // but deduplicate — a repeated UUID gets a fresh one to prevent PK conflicts.
            let resolvedId: string | undefined;
            if (existingSlide) {
              resolvedId = existingSlide.id;
            } else if (UUID_RE.test(slide.id || "")) {
              resolvedId = slide.id as string;
            }
            if (resolvedId && seenIds.has(resolvedId)) {
              resolvedId = crypto.randomUUID();
            }
            if (resolvedId) seenIds.add(resolvedId);

            return {
              ...(resolvedId ? { id: resolvedId } : {}),
              courseId: id,
              order: index + 1,
              type: (slide.type || "text") as "text" | "video" | "audio" | "quiz" | "dialogue" | "chat" | "poll",
              content: mergedContent,
              language: slide.language || "en",
              assetStatus: mergedAssetStatus as "pending" | "generating" | "ready" | "failed",
            };
          });

          await tx.insert(slides).values(slidesToInsert);
        }
      });
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
