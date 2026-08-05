import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { progress, workers, courses, assignments } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { eq, and, or, isNull, sql } from "drizzle-orm";

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
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const status = searchParams.get("status");

    const conditions = [eq(workers.organizationId, orgId), eq(workers.active, true)];
    if (courseId) {
      conditions.push(eq(assignments.courseId, courseId));
    }
    if (status === "not_started") {
      conditions.push(or(isNull(progress.status), eq(progress.status, "not_started"))!);
    } else if (status) {
      conditions.push(eq(progress.status, status as "in_progress" | "completed"));
    }

    // Base the report on assignments (left-joined with progress) rather than
    // progress alone, so workers who were assigned a course but haven't
    // started it yet still show up here — matching what the Workers page shows.
    const results = await db
      .select({
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
      .where(and(...conditions)!)
      .orderBy(sql`${progress.completedAt} DESC NULLS LAST`);

    const headers = ["Worker", "Course", "Status", "Completed At", "Quiz Score"];
    const csvRows = [headers.join(",")];

    for (const row of results) {
      const nameParts = [row.firstName, row.lastName].filter(Boolean);
      const workerName = row.displayName || (nameParts.length > 0 ? nameParts.join(" ") : "Unnamed Worker");

      const csvRow = [
        escapeCSVValue(workerName),
        escapeCSVValue(row.courseName),
        escapeCSVValue(row.status ?? "not_started"),
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
