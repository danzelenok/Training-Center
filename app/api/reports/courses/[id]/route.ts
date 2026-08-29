import { NextResponse } from "next/server";
import { requireOrgId } from "@/lib/org";
import { getCourseSnapshot, CourseNotPublishedError } from "@/lib/courseSnapshot";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;

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

    return NextResponse.json(snapshot);
  } catch (error: any) {
    console.error("Error building course snapshot:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
