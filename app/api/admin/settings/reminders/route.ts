import { db } from "@/db";
import { reminderSettings } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { roleOrUnauthorized } from "@/lib/adminRoles";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Reminder cadence is org-wide config, same restriction rationale as team
// management (app/api/admin/team/route.ts) — jurisdiction_admin can manage
// courses/workers in their own jurisdiction, but not org-wide settings.
function requireOrgAdmin(req: Request): Response | null {
  const roleResult = roleOrUnauthorized(req);
  if (roleResult instanceof Response) return roleResult;
  if (roleResult.role !== "org_admin") {
    return NextResponse.json({ error: "Only an org admin can change reminder settings." }, { status: 403 });
  }
  return null;
}

const DEFAULTS = { remindersBeforeCount: 2, remindersAfterCount: 1 };

export async function GET(req: Request) {
  try {
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const roleResult = roleOrUnauthorized(req);
    if (roleResult instanceof Response) return roleResult;

    const [row] = await db
      .select({
        remindersBeforeCount: reminderSettings.remindersBeforeCount,
        remindersAfterCount: reminderSettings.remindersAfterCount,
      })
      .from(reminderSettings)
      .where(eq(reminderSettings.organizationId, orgId))
      .limit(1);

    return NextResponse.json(row ?? DEFAULTS);
  } catch (error: any) {
    console.error("GET /api/admin/settings/reminders error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const forbidden = requireOrgAdmin(req);
    if (forbidden) return forbidden;

    const body = await req.json().catch(() => ({}));
    const remindersBeforeCount = body.remindersBeforeCount;
    const remindersAfterCount = body.remindersAfterCount;

    if (
      !Number.isInteger(remindersBeforeCount) || remindersBeforeCount < 0 ||
      !Number.isInteger(remindersAfterCount) || remindersAfterCount < 0
    ) {
      return NextResponse.json(
        { error: "remindersBeforeCount and remindersAfterCount must be non-negative integers." },
        { status: 400 }
      );
    }

    const [updated] = await db
      .insert(reminderSettings)
      .values({ organizationId: orgId, remindersBeforeCount, remindersAfterCount })
      .onConflictDoUpdate({
        target: reminderSettings.organizationId,
        set: { remindersBeforeCount, remindersAfterCount, updatedAt: new Date() },
      })
      .returning({
        remindersBeforeCount: reminderSettings.remindersBeforeCount,
        remindersAfterCount: reminderSettings.remindersAfterCount,
      });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PATCH /api/admin/settings/reminders error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
