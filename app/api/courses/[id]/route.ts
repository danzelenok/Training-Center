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
    const { title, description, themeType, themeValue, slides: updatedSlides } = body;

    // 1. Update Course details
    const [updatedCourse] = await db
      .update(courses)
      .set({
        title,
        description: description || "",
        themeType: themeType !== undefined ? themeType : undefined,
        themeValue: themeValue !== undefined ? themeValue : undefined,
        updatedAt: new Date(),
      })
      .where(eq(courses.id, id))
      .returning();

    if (!updatedCourse) {
      return new NextResponse("Course not found or could not be updated", { status: 404 });
    }

    // 2. Reconcile Slides (if provided)
    if (Array.isArray(updatedSlides)) {
      // Delete existing slides for this course
      await db.delete(slides).where(eq(slides.courseId, id));

      // Insert new slides list
      if (updatedSlides.length > 0) {
        const slidesToInsert = updatedSlides.map((slide, index) => ({
          courseId: id,
          order: index + 1,
          type: slide.type || "text",
          content: slide.content || {},
        }));

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
