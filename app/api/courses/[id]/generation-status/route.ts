import { db } from "@/db";
import { courses, slides } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, asc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
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

    // Fetch Course
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, id))
      .limit(1);

    if (!course) {
      return new NextResponse("Course not found", { status: 404 });
    }

    // Fetch Slides ordered by order
    const courseSlides = await db
      .select()
      .from(slides)
      .where(eq(slides.courseId, id))
      .orderBy(asc(slides.order));

    // Map slides to required return schema: { id, type, heading, assetStatus }
    const mappedSlides = courseSlides.map((slide) => {
      const content = (slide.content || {}) as Record<string, any>;
      // Heading fallback hierarchy
      const heading = content.heading || content.title || content.question || "";

      return {
        id: slide.id,
        type: slide.type,
        heading,
        assetStatus: slide.assetStatus,
      };
    });

    return NextResponse.json({
      generationStatus: course.generationStatus,
      slides: mappedSlides,
    });
  } catch (error: any) {
    console.error("Error fetching course generation status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch generation status" },
      { status: 500 }
    );
  }
}
