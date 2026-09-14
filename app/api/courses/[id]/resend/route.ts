import { db } from "@/db";
import { courses } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { roleOrUnauthorized, canWriteCourse } from "@/lib/adminRoles";
import { getLatestRunId } from "@/lib/courseRuns";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sendCourseAnnouncementDMs } from "@/lib/bot";

// POST /api/courses/[id]/resend — "Resend Announcement": re-sends
// the Telegram DM announcement to whoever is assigned the course's CURRENT
// (latest) run. Deliberately makes no data changes — no new course_runs row,
// no new assignments, no new due dates. This is the old "Resend to
// Telegram" behavior, split out from publish/route.ts's now-run-creating
// POST so the two are no longer the same action wearing different labels.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const roleResult = roleOrUnauthorized(req);
    if (roleResult instanceof Response) return roleResult;

    const [course] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, id), eq(courses.organizationId, orgId)))
      .limit(1);

    if (!course) {
      return new NextResponse("Course not found", { status: 404 });
    }
    if (!canWriteCourse(roleResult, course.ownerJurisdictionId)) {
      return NextResponse.json({ error: "You can only manage courses owned by your jurisdiction." }, { status: 403 });
    }
    if (course.status !== "published") {
      return new NextResponse("Course is not published yet — nothing to resend.", { status: 400 });
    }

    const runId = await getLatestRunId(course.id);
    if (!runId) {
      return new NextResponse("This course has no runs to resend yet.", { status: 400 });
    }

    try {
      await sendCourseAnnouncementDMs(course.id, course.title, runId);
    } catch (botError: any) {
      console.error("Failed to resend course DMs to workers:", botError);
      return new NextResponse(
        JSON.stringify({
          error: "Failed to resend course direct messages to assigned workers.",
          details: botError.message,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return NextResponse.json({ ok: true, runId });
  } catch (error: any) {
    console.error("Error resending course announcement:", error);
    return new NextResponse(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
