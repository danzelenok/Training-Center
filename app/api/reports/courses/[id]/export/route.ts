import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireOrgId } from "@/lib/org";
import { getCourseSnapshot, CourseNotPublishedError, type CourseSnapshotWorkerResult } from "@/lib/courseSnapshot";

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
    const format = req.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

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

    const safeTitle = snapshot.course.title.replace(/[^a-z0-9]+/gi, "_").slice(0, 60) || "course";

    if (format === "csv") {
      const csvRows = [HEADERS.join(",")];
      for (const w of snapshot.workers) {
        csvRows.push(toRow(w).map(escapeCSVValue).join(","));
      }
      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeTitle}_snapshot.csv"`,
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Snapshot");
    sheet.addRow(HEADERS);
    sheet.getRow(1).font = { bold: true };
    for (const w of snapshot.workers) {
      sheet.addRow(toRow(w));
    }
    sheet.columns.forEach((col) => {
      col.width = 22;
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeTitle}_snapshot.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Error exporting course snapshot:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
