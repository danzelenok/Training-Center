import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { requireOrgId } from "@/lib/org";
import {
  getCourseSnapshot,
  CourseNotPublishedError,
  filterSnapshotWorkersByStatus,
  parseCourseSnapshotStatusFilter,
  type CourseSnapshotWorkerResult,
  type CourseSnapshotStatusFilter,
} from "@/lib/courseSnapshot";
import { CourseSnapshotDocument } from "@/lib/pdf/CourseSnapshotDocument";

export const dynamic = "force-dynamic";

function formatUTCDate(date: Date | null): string {
  if (!date) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function escapeCSVValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const STATUS_LABELS: Record<CourseSnapshotWorkerResult["status"], string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

const STATUS_FILTER_LABELS: Record<CourseSnapshotStatusFilter, string | null> = {
  all: null,
  not_completed: "Not Completed (Not Started + In Progress)",
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

const HEADERS = ["Worker", "Role", "Jurisdiction (current)", "Status", "Completed At", "Quiz Score"];

function toRow(w: CourseSnapshotWorkerResult): (string | number)[] {
  return [
    w.workerName,
    w.roleName ?? "Role unknown",
    w.jurisdictionName ?? "",
    STATUS_LABELS[w.status],
    formatUTCDate(w.completedAt),
    w.quizScore !== null ? `${w.quizScore}%` : "",
  ];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;
    const format = req.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "csv";
    const statusFilter = parseCourseSnapshotStatusFilter(req.nextUrl.searchParams.get("status"));

    let snapshot;
    try {
      snapshot = await getCourseSnapshot(orgId, id);
    } catch (err) {
      if (err instanceof CourseNotPublishedError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    if (!snapshot) {
      return new NextResponse("Course not found", { status: 404 });
    }

    const filteredWorkers = filterSnapshotWorkersByStatus(snapshot.workers, statusFilter);
    const safeTitle = snapshot.course.title.replace(/[^a-z0-9]+/gi, "_").slice(0, 60) || "course";

    if (format === "csv") {
      const csvRows = [HEADERS.join(",")];
      for (const w of filteredWorkers) {
        csvRows.push(toRow(w).map(escapeCSVValue).join(","));
      }
      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeTitle}_snapshot.csv"`,
        },
      });
    }

    const groupByRole = req.nextUrl.searchParams.get("groupByRole") === "1";
    const groupByJurisdiction = req.nextUrl.searchParams.get("groupByJurisdiction") === "1";
    const logoBuffer = await readFile(path.join(process.cwd(), "public", "cool-cat_logo-color.png"));

    const pdfBuffer = await renderToBuffer(
      createElement(CourseSnapshotDocument, {
        course: snapshot.course,
        workers: filteredWorkers,
        statusFilterLabel: STATUS_FILTER_LABELS[statusFilter],
        groupByRole,
        groupByJurisdiction,
        logoBuffer,
        generatedAt: new Date(),
      }) as ReactElement<DocumentProps>
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeTitle}_snapshot.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Error exporting course snapshot:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
