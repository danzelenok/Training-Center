import { db } from "@/db";
import { courses, slides } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { generateCourseStructure } from "@/lib/gemini";
import { inngest } from "@/lib/inngest";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Auth Check
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Verify course exists
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, id))
      .limit(1);

    if (!course) {
      return new NextResponse("Course not found", { status: 404 });
    }

    if (course.generationStatus === "generating") {
      return new NextResponse("Generation already in progress", { status: 409 });
    }

    // Parse request body
    const body = await req.json();
    const { prompt, model } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return new NextResponse("Prompt is required", { status: 400 });
    }

    // Determine target model (fast -> gemini-3.5-flash, advanced -> gemini-2.5-pro)
    const modelIdentifier = model === "fast" ? "gemini-3.5-flash" : "gemini-2.5-pro";

    // Call Gemini structure generator with selected model
    const generatedSlides = await generateCourseStructure(prompt, modelIdentifier);

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
    const slidesToInsert = generatedSlides.map((slide, index) => {
      const needsAsset =
        slide.type === "audio" ||
        slide.type === "dialogue" ||
        slide.type === "video" ||
        (slide.type === "text" && !!(slide.content as any).visualKeywords);
      return {
        courseId: id,
        order: index + 1,
        type: slide.type,
        content: slide.content,
        language: "en",
        assetStatus: (needsAsset ? "pending" : "ready") as "pending" | "ready",
      };
    });

    let finalSlides: any[] = [];
    if (slidesToInsert.length > 0) {
      finalSlides = await db
        .insert(slides)
        .values(slidesToInsert)
        .returning();
    }

    // 3. Set courses.generationStatus = generating
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
      data: { courseId: id },
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
