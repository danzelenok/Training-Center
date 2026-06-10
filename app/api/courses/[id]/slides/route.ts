import { db } from "@/db";
import { courses, slides } from "@/db/schema";
import { withTelegramAuth } from "@/lib/telegram";
import { and, eq, asc } from "drizzle-orm";
import { NextResponse } from "next/server";

async function fetchSlidesData(id: string): Promise<Response> {
  const [course] = await db
    .select({
      title: courses.title,
      themeType: courses.themeType,
      themeValue: courses.themeValue,
    })
    .from(courses)
    .where(eq(courses.id, id))
    .limit(1);

  if (!course) {
    return new NextResponse("Course not found", { status: 404 });
  }

  const courseSlides = await db
    .select()
    .from(slides)
    .where(and(eq(slides.courseId, id), eq(slides.language, "en")))
    .orderBy(asc(slides.order));

  return NextResponse.json({ course, slides: courseSlides });
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!id) {
    return new NextResponse("Missing course ID", { status: 400 });
  }

  if (req.headers.get("x-preview-mode") === "true") {
    try {
      return await fetchSlidesData(id);
    } catch (error: any) {
      console.error("GET /api/courses/[id]/slides (preview) error:", error);
      return new NextResponse(error.message || "Internal Server Error", { status: 500 });
    }
  }

  return withTelegramAuth<{ params: Promise<{ id: string }> }>(
    async (_req, { params }) => {
      try {
        const { id } = await params;
        return await fetchSlidesData(id);
      } catch (error: any) {
        console.error("GET /api/courses/[id]/slides error:", error);
        return new NextResponse(error.message || "Internal Server Error", { status: 500 });
      }
    }
  )(req, context);
}
