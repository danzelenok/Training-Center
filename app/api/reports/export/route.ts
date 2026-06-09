import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { progress, workers, courses } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, and, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function formatUTCDate(date: Date | null | string): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function escapeCSVValue(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

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

    const headers = ["Worker", "Telegram", "Course", "Status", "Completed At", "Quiz Score"];
    const csvRows = [headers.join(",")];

    for (const row of results) {
      const nameParts = [row.firstName, row.lastName].filter(Boolean);
      const workerName = nameParts.length > 0 ? nameParts.join(" ") : "Unknown";

      const telegramUsername = row.telegramUsername
        ? (row.telegramUsername.startsWith("@") ? row.telegramUsername : `@${row.telegramUsername}`)
        : "";

      const csvRow = [
        escapeCSVValue(workerName),
        escapeCSVValue(telegramUsername),
        escapeCSVValue(row.courseName),
        escapeCSVValue(row.status),
        escapeCSVValue(row.completedAt ? formatUTCDate(row.completedAt) : ""),
        escapeCSVValue(row.quizScore !== null ? `${row.quizScore}%` : ""),
      ];
      csvRows.push(csvRow.join(","));
    }

    const csvContent = csvRows.join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="report.csv"',
      },
    });
  } catch (error: any) {
    console.error("Error exporting reports:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
