import { db } from "@/db";
import { courses, slides } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

// 1. GET /api/courses - List all courses with slide count
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Fetch courses with slide counts using SQL count to avoid fetching all slides
    const results = await db
      .select({
        id: courses.id,
        title: courses.title,
        description: courses.description,
        status: courses.status,
        telegramMessageId: courses.telegramMessageId,
        telegramGroupId: courses.telegramGroupId,
        createdAt: courses.createdAt,
        updatedAt: courses.updatedAt,
        slideCount: sql<number>`cast(count(${slides.id}) as int)`,
      })
      .from(courses)
      .leftJoin(slides, sql`${slides.courseId} = ${courses.id}`)
      .groupBy(courses.id)
      .orderBy(desc(courses.createdAt));

    // Convert bigints to strings/numbers to avoid JSON serialization errors
    const serializedResults = results.map(row => ({
      ...row,
      telegramMessageId: row.telegramMessageId ? row.telegramMessageId.toString() : null,
      telegramGroupId: row.telegramGroupId ? row.telegramGroupId.toString() : null,
    }));

    return NextResponse.json(serializedResults);
  } catch (error: any) {
    console.error("Error fetching courses:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

// 2. POST /api/courses - Create a new draft course
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { title, description } = body;

    if (!title) {
      return new NextResponse("Title is required", { status: 400 });
    }

    const [newCourse] = await db
      .insert(courses)
      .values({
        title,
        description: description || "",
        status: "draft",
      })
      .returning();

    return NextResponse.json({
      ...newCourse,
      telegramMessageId: newCourse.telegramMessageId ? newCourse.telegramMessageId.toString() : null,
      telegramGroupId: newCourse.telegramGroupId ? newCourse.telegramGroupId.toString() : null,
    });
  } catch (error: any) {
    console.error("Error creating course:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
