import { db } from "@/db";
import { courses, slides } from "@/db/schema";
import { withTelegramAuth } from "@/lib/telegram";
import { resolveCourseTheme } from "@/lib/theme-server";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";

export const GET = withTelegramAuth<{ params: Promise<{ id: string }> }>(
  async (req, { params, worker }) => {
    try {
      const { id } = await params;
      if (!id) {
        return new NextResponse("Missing course ID", { status: 400 });
      }
      if (!worker.organizationId) {
        return new NextResponse("Unauthorized", { status: 401 });
      }

      // Fetch course details, scoped to the worker's organization
      const [course] = await db
        .select({
          title: courses.title,
          themeType: courses.themeType,
          themeValue: courses.themeValue,
          themePaletteId: courses.themePaletteId,
          themeVariantId: courses.themeVariantId,
        })
        .from(courses)
        .where(and(eq(courses.id, id), eq(courses.organizationId, worker.organizationId)))
        .limit(1);

      if (!course) {
        return new NextResponse("Course not found", { status: 404 });
      }

      const { themePalette, themeVariant } = await resolveCourseTheme(course.themePaletteId, course.themeVariantId);

      // Fetch slides for the course with language = 'en', ordered by order,
      // scoped to base slides (jurisdictionId IS NULL) plus the worker's own state.
      const courseSlides = await db
        .select()
        .from(slides)
        .where(
          and(
            eq(slides.courseId, id),
            eq(slides.language, "en"),
            worker.jurisdictionId
              ? or(isNull(slides.jurisdictionId), eq(slides.jurisdictionId, worker.jurisdictionId))
              : isNull(slides.jurisdictionId)
          )
        )
        .orderBy(asc(slides.order));

      return NextResponse.json({
        course: { ...course, themePalette, themeVariant },
        slides: courseSlides,
      });
    } catch (error: any) {
      console.error("GET /api/courses/[id]/slides error:", error);
      return new NextResponse(error.message || "Internal Server Error", { status: 500 });
    }
  }
);
