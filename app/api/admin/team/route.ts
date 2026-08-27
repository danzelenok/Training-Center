import { db } from "@/db";
import { adminRoles, jurisdictions, organizationJurisdictions } from "@/db/schema";
import { requireOrgContext } from "@/lib/org";
import { roleOrUnauthorized } from "@/lib/adminRoles";
import { clerkClient } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { env } from "@/env";

export const dynamic = "force-dynamic";

// Managing admins (inviting, changing role, removing) is org_admin-only —
// jurisdiction_admin can manage courses/workers in their own jurisdiction,
// but never who else has admin access. See task decision log.
function requireOrgAdmin(req: Request): Response | null {
  const roleResult = roleOrUnauthorized(req);
  if (roleResult instanceof Response) return roleResult;
  if (roleResult.role !== "org_admin") {
    return NextResponse.json({ error: "Only an org admin can manage team members." }, { status: 403 });
  }
  return null;
}

// GET /api/admin/team — current members (Clerk membership + our admin_roles,
// left-joined so a member with no role row yet still shows up) + pending invitations.
export async function GET(req: Request) {
  try {
    const forbidden = requireOrgAdmin(req);
    if (forbidden) return forbidden;

    const { id: orgId, clerkOrgId } = await requireOrgContext().catch(() => ({ id: null, clerkOrgId: null }));
    if (!orgId || !clerkOrgId) return new NextResponse("Unauthorized", { status: 401 });

    const clerk = await clerkClient();
    const [membershipList, invitationList, roleRows, jurisdictionRows] = await Promise.all([
      clerk.organizations.getOrganizationMembershipList({ organizationId: clerkOrgId, limit: 100 }),
      clerk.organizations.getOrganizationInvitationList({ organizationId: clerkOrgId, status: ["pending"], limit: 100 }),
      db.select().from(adminRoles).where(eq(adminRoles.organizationId, orgId)),
      db.select({ id: jurisdictions.id, code: jurisdictions.code, name: jurisdictions.name }).from(jurisdictions),
    ]);

    const rolesByUser = new Map(roleRows.map((r) => [r.clerkUserId, r]));
    const jurisdictionsById = new Map(jurisdictionRows.map((j) => [j.id, j]));

    const members = membershipList.data.map((m) => {
      const clerkUserId = m.publicUserData?.userId ?? "";
      const roleRow = rolesByUser.get(clerkUserId);
      return {
        clerkUserId,
        identifier: m.publicUserData?.identifier ?? "",
        firstName: m.publicUserData?.firstName ?? null,
        lastName: m.publicUserData?.lastName ?? null,
        role: roleRow?.role ?? null, // null = "role not set" (Clerk member, no admin_roles row)
        jurisdiction: roleRow?.jurisdictionId ? jurisdictionsById.get(roleRow.jurisdictionId) ?? null : null,
      };
    });

    const pendingInvitations = invitationList.data.map((inv) => {
      const metadata = (inv.publicMetadata ?? {}) as Record<string, unknown>;
      const jurisdictionId = typeof metadata.jurisdictionId === "string" ? metadata.jurisdictionId : null;
      return {
        id: inv.id,
        email: inv.emailAddress,
        requestedRole: metadata.role === "org_admin" || metadata.role === "jurisdiction_admin" ? metadata.role : null,
        jurisdiction: jurisdictionId ? jurisdictionsById.get(jurisdictionId) ?? null : null,
      };
    });

    return NextResponse.json({ members, pendingInvitations });
  } catch (error: any) {
    console.error("Error fetching team:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

// POST /api/admin/team — invite a new admin with a role + (for jurisdiction_admin) a jurisdiction.
export async function POST(req: Request) {
  try {
    const forbidden = requireOrgAdmin(req);
    if (forbidden) return forbidden;

    const { id: orgId, clerkOrgId } = await requireOrgContext().catch(() => ({ id: null, clerkOrgId: null }));
    if (!orgId || !clerkOrgId) return new NextResponse("Unauthorized", { status: 401 });

    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const role = body.role;

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }
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

    // Without redirectUrl, Clerk lands the invitee on its own Account Portal
    // ("Development mode... cannot redirect to your application") instead of
    // /invite, which is where proxy.ts and <OrganizationList> expect them —
    // same target the existing pending-invitation redirect in proxy.ts uses.
    // NEXT_PUBLIC_APP_URL is the deployment's canonical URL; fall back to the
    // request's own origin (matches app/api/bot/setup/route.ts's precedent)
    // so this still works if that env var isn't set on a given deployment.
    const baseAppUrl = env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const redirectUrl = `${baseAppUrl}/invite`;

    const clerk = await clerkClient();
    const invitation = await clerk.organizations.createOrganizationInvitation({
      organizationId: clerkOrgId,
      emailAddress: email,
      role: role === "org_admin" ? "org:admin" : "org:member",
      publicMetadata: { role, jurisdictionId },
      redirectUrl,
    });

    return NextResponse.json({ id: invitation.id, email: invitation.emailAddress });
  } catch (error: any) {
    console.error("Error inviting admin:", error);
    return NextResponse.json({ error: error.errors?.[0]?.message || error.message || "Failed to send invite" }, { status: 500 });
  }
}
