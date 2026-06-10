import { db } from "@/db";
import { courses, slides } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sendCourseAnnouncement, deleteTelegramMessage } from "@/lib/bot";
import { env } from "@/env";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 1. Fetch the course
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, id))
      .limit(1);

    if (!course) {
      return new NextResponse("Course not found", { status: 404 });
    }

    // 2. Enforce slide existence before publishing
    const [countResult] = await db
      .select({ count: sql<number>`cast(count(${slides.id}) as int)` })
      .from(slides)
      .where(eq(slides.courseId, id));

    const slideCount = countResult?.count || 0;
    if (slideCount === 0) {
      return new NextResponse(
        JSON.stringify({ error: "Cannot publish a course with no slides. Please add slides first." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Delete previous Telegram message if republishing
    if (course.telegramMessageId && course.telegramGroupId) {
      await deleteTelegramMessage(course.telegramMessageId, course.telegramGroupId);
    }

    // 4. Send new Telegram Announcement
    let telegramMessageId: bigint | null = null;
    let telegramGroupId: bigint | null = null;

    try {
      const messageId = await sendCourseAnnouncement(course.id, course.title);
      telegramMessageId = BigInt(messageId);

      const groupIdStr = env.TELEGRAM_GROUP_ID || process.env.TELEGRAM_GROUP_ID;
      if (groupIdStr) {
        telegramGroupId = BigInt(groupIdStr);
      }
    } catch (botError: any) {
      console.error("Failed to post course announcement on Telegram bot:", botError);
      return new NextResponse(
        JSON.stringify({
          error: "Failed to broadcast course announcement to Telegram. Check bot configuration & group permissions.",
          details: botError.message,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // 5. Update status and message details in the database
    const [updatedCourse] = await db
      .update(courses)
      .set({
        status: "published",
        telegramMessageId,
        telegramGroupId,
        updatedAt: new Date(),
      })
      .where(eq(courses.id, id))
      .returning();

    return NextResponse.json({
      ...updatedCourse,
      telegramMessageId: updatedCourse.telegramMessageId ? updatedCourse.telegramMessageId.toString() : null,
      telegramGroupId: updatedCourse.telegramGroupId ? updatedCourse.telegramGroupId.toString() : null,
    });
  } catch (error: any) {
    console.error("Error publishing course:", error);
    return new NextResponse(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// DELETE /api/courses/[id]/publish — revoke: delete Telegram message and reset to draft
export async function DELETE(
  _req: Request,
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

    if (course.telegramMessageId && course.telegramGroupId) {
      await deleteTelegramMessage(course.telegramMessageId, course.telegramGroupId);
    }

    const [updatedCourse] = await db
      .update(courses)
      .set({
        status: "draft",
        telegramMessageId: null,
        telegramGroupId: null,
        updatedAt: new Date(),
      })
      .where(eq(courses.id, id))
      .returning();

    return NextResponse.json({
      ...updatedCourse,
      telegramMessageId: null,
      telegramGroupId: null,
    });
  } catch (error: any) {
    console.error("Error revoking course:", error);
    return new NextResponse(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
