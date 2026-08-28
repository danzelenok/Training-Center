import { db } from "@/db";
import { jobRoles } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Role name is required." }, { status: 400 });
    }

    const [updated] = await db
      .update(jobRoles)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(jobRoles.id, id), eq(jobRoles.organizationId, orgId)))
      .returning();

    if (!updated) return new NextResponse("Not found", { status: 404 });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json({ error: "A role with this name already exists." }, { status: 400 });
    }
    console.error("Error updating job role:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const orgId = await requireOrgId().catch(() => null);
  if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;

  // workers.role_id and courses.role_id are ON DELETE SET NULL — deleting a
  // role clears the reference on any worker/course that had it, it doesn't
  // cascade-delete them.
  await db.delete(jobRoles).where(and(eq(jobRoles.id, id), eq(jobRoles.organizationId, orgId)));

  return NextResponse.json({ success: true });
}
