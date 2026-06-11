import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { progress, workers, courses } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, and, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const status = searchParams.get("status");

    const conditions = [];
    if (courseId) {
      conditions.push(eq(progress.courseId, courseId));
    }
    if (status) {
      conditions.push(eq(progress.status, status as "not_started" | "in_progress" | "completed"));
    }

    const results = await db
      .select({
        id: progress.id,
        firstName: workers.firstName,
        lastName: workers.lastName,
        telegramUsername: workers.telegramUsername,
        courseName: courses.title,
        status: progress.status,
        completedAt: progress.completedAt,
        quizScore: progress.quizScore,
      })
      .from(progress)
      .innerJoin(workers, eq(progress.workerId, workers.id))
      .innerJoin(courses, eq(progress.courseId, courses.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`${progress.completedAt} DESC NULLS LAST`);

    const formatted = results.map((row) => {
      const nameParts = [row.firstName, row.lastName].filter(Boolean);
      const workerName = nameParts.length > 0 ? nameParts.join(" ") : "Unknown";
      return {
        id: row.id,
        workerName,
        telegramUsername: row.telegramUsername,
        courseName: row.courseName,
        status: row.status,
        completedAt: row.completedAt,
        quizScore: row.quizScore,
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("Error fetching reports:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
