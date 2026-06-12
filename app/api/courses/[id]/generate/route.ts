import { db } from "@/db";
import { courses, slides } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { generateCourseStructure } from "@/lib/gemini";
import { fetchLNIContext } from "@/lib/lni-scraper";
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
    const { prompt, model, useLNI = true } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return new NextResponse("Prompt is required", { status: 400 });
    }

    // Determine target model (fast -> gemini-3.5-flash, advanced -> gemini-2.5-pro)
    const modelIdentifier = model === "fast" ? "gemini-3.5-flash" : "gemini-2.5-pro";

    // Fetch LNI context (non-blocking — generation continues if this fails)
    let lniContext: string | undefined;
    let lniDescription: string | undefined;

    if (useLNI) {
      try {
        const lni = await fetchLNIContext(prompt);
        console.log("[LNI] sources found:", lni.sources.length);
        if (lni.sources.length > 0) {
          lniContext = lni.sourcesText;
          lniDescription = lni.sourcesDescription;
          console.log("[LNI] lniDescription set:", lniDescription.slice(0, 100));
        }
      } catch (err) {
        console.warn("[LNI] Failed to fetch L&I context, proceeding without it:", err);
      }
    } else {
      console.log("[LNI] Skipped by user toggle");
    }

    // Call Gemini structure generator with selected model
    const generatedSlides = await generateCourseStructure(prompt, modelIdentifier, lniContext);

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
        (slide.type === "text" && !!(slide.content as any).visualKeywords) ||
        (slide.type === "chat" && (slide.content as any).belowType === "image" && !!(slide.content as any).visualKeywords);
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

    // 3. Update course description with LNI sources if found
    console.log("[LNI] lniDescription before DB update:", lniDescription ? lniDescription.slice(0, 100) : "undefined");
    if (lniDescription) {
      await db
        .update(courses)
        .set({ description: lniDescription, updatedAt: new Date() })
        .where(eq(courses.id, id));
      console.log("[LNI] description updated in DB");
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
