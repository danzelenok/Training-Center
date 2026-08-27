import { db } from "@/db";
import { adminRoles, jurisdictions, organizationJurisdictions } from "@/db/schema";
import { requireOrgContext } from "@/lib/org";
import { roleOrUnauthorized } from "@/lib/adminRoles";
import { clerkClient } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

function requireOrgAdmin(req: Request): Response | null {
  const roleResult = roleOrUnauthorized(req);
  if (roleResult instanceof Response) return roleResult;
  if (roleResult.role !== "org_admin") {
    return NextResponse.json({ error: "Only an org admin can manage team members." }, { status: 403 });
  }
  return null;
}

// PATCH /api/admin/team/[clerkUserId] — role-change fallback. Updates admin_roles
// only; does not touch Clerk. This exists for when the invite-accept webhook
// never ran or failed — the primary way a role gets set is still the invite
// flow (see app/api/admin/team/route.ts POST + app/api/webhooks/clerk).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ clerkUserId: string }> }
) {
  try {
    const forbidden = requireOrgAdmin(req);
    if (forbidden) return forbidden;

    const { id: orgId } = await requireOrgContext().catch(() => ({ id: null }));
    if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

    const { clerkUserId } = await params;
    const body = await req.json().catch(() => ({}));
    const role = body.role;

    if (role !== "org_admin" && role !== "jurisdiction_admin") {
      return NextResponse.json({ error: "Role must be org_admin or jurisdiction_admin." }, { status: 400 });
    }

    let jurisdictionId: string | null = null;
    if (role === "jurisdiction_admin") {
      if (typeof body.jurisdictionId !== "string" || !body.jurisdictionId) {
        return NextResponse.json({ error: "jurisdictionId is required for a jurisdiction_admin." }, { status: 400 });
      }
      const [jurisdiction] = await db
        .select({ id: jurisdictions.id })
        .from(organizationJurisdictions)
        .innerJoin(jurisdictions, eq(jurisdictions.id, organizationJurisdictions.jurisdictionId))
        .where(
          and(
            eq(organizationJurisdictions.organizationId, orgId),
            eq(organizationJurisdictions.jurisdictionId, body.jurisdictionId)
          )
        )
        .limit(1);
      if (!jurisdiction) {
        return NextResponse.json({ error: "Selected state was not found for this organization." }, { status: 400 });
      }
      jurisdictionId = jurisdiction.id;
    }

    await db
      .insert(adminRoles)
      .values({ organizationId: orgId, clerkUserId, role, jurisdictionId })
      .onConflictDoUpdate({
        target: [adminRoles.organizationId, adminRoles.clerkUserId],
        set: { role, jurisdictionId },
      });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error changing admin role:", error);
    return NextResponse.json({ error: error.message || "Failed to change role" }, { status: 500 });
  }
}

// DELETE /api/admin/team/[clerkUserId] — remove an admin: drop the admin_roles
// row first (fail-closed direction if the Clerk call below then fails — the
// member keeps their Clerk membership but loses admin access, never the
// reverse), then remove the Clerk organization membership itself.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ clerkUserId: string }> }
) {
  try {
    const forbidden = requireOrgAdmin(req);
    if (forbidden) return forbidden;

    const { id: orgId, clerkOrgId } = await requireOrgContext().catch(() => ({ id: null, clerkOrgId: null }));
    if (!orgId || !clerkOrgId) return new NextResponse("Unauthorized", { status: 401 });

    const { clerkUserId } = await params;

    await db
      .delete(adminRoles)
      .where(and(eq(adminRoles.organizationId, orgId), eq(adminRoles.clerkUserId, clerkUserId)));

    const clerk = await clerkClient();
    await clerk.organizations.deleteOrganizationMembership({ organizationId: clerkOrgId, userId: clerkUserId });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error removing admin:", error);
    return NextResponse.json(
      { error: error.errors?.[0]?.message || error.message || "Removed the admin role, but failed to remove Clerk organization membership — please retry." },
      { status: 500 }
    );
  }
}
