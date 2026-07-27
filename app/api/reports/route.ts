import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { progress, workers, courses, assignments } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, and, or, isNull, sql } from "drizzle-orm";

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
      conditions.push(eq(assignments.courseId, courseId));
    }
    if (status === "not_started") {
      conditions.push(or(isNull(progress.status), eq(progress.status, "not_started")));
    } else if (status) {
      conditions.push(eq(progress.status, status as "in_progress" | "completed"));
    }

    // Base the report on assignments (left-joined with progress) rather than
    // progress alone, so workers who were assigned a course but haven't
    // started it yet still show up here — matching what the Workers page shows.
    const results = await db
      .select({
        id: assignments.id,
        workerId: workers.id,
        displayName: workers.displayName,
        firstName: workers.firstName,
        lastName: workers.lastName,
        courseName: courses.title,
        status: progress.status,
        completedAt: progress.completedAt,
        quizScore: progress.quizScore,
      })
      .from(assignments)
      .innerJoin(workers, eq(assignments.workerId, workers.id))
      .innerJoin(courses, eq(assignments.courseId, courses.id))
      .leftJoin(
        progress,
        and(eq(progress.workerId, assignments.workerId), eq(progress.courseId, assignments.courseId))
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`${progress.completedAt} DESC NULLS LAST`);

    const formatted = results.map((row) => {
      const nameParts = [row.firstName, row.lastName].filter(Boolean);
      const workerName = row.displayName || (nameParts.length > 0 ? nameParts.join(" ") : "Unnamed Worker");
      return {
        id: row.id,
        workerId: row.workerId,
        workerName,
        courseName: row.courseName,
        status: row.status ?? "not_started",
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
