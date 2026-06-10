import { db } from "@/db";
import { courses, slides } from "@/db/schema";
import { withTelegramAuth } from "@/lib/telegram";
import { and, eq, asc } from "drizzle-orm";
import { NextResponse } from "next/server";

export const GET = withTelegramAuth<{ params: Promise<{ id: string }> }>(
  async (req, { params }) => {
    try {
      const { id } = await params;
      if (!id) {
        return new NextResponse("Missing course ID", { status: 400 });
      }

      // Fetch course details
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

      // Fetch slides for the course with language = 'en' ordered by order
      const courseSlides = await db
        .select()
        .from(slides)
        .where(
          and(
            eq(slides.courseId, id),
            eq(slides.language, "en")
          )
        )
        .orderBy(asc(slides.order));

      return NextResponse.json({
        course,
        slides: courseSlides,
      });
    } catch (error: any) {
      console.error("GET /api/courses/[id]/slides error:", error);
      return new NextResponse(error.message || "Internal Server Error", { status: 500 });
    }
  }
);
