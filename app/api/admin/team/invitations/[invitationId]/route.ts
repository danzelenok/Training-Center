import { requireOrgContext } from "@/lib/org";
import { roleOrUnauthorized } from "@/lib/adminRoles";
import { clerkClient, auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Managing admins (inviting, changing role, removing, and now revoking a
// still-pending invite) is org_admin-only — same rule as the rest of
// app/api/admin/team/*.
function requireOrgAdmin(req: Request): Response | null {
  const roleResult = roleOrUnauthorized(req);
  if (roleResult instanceof Response) return roleResult;
  if (roleResult.role !== "org_admin") {
    return NextResponse.json({ error: "Only an org admin can manage team members." }, { status: 403 });
  }
  return null;
}

// DELETE /api/admin/team/invitations/[invitationId] — revoke a pending invite.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  try {
    const forbidden = requireOrgAdmin(req);
    if (forbidden) return forbidden;

    const { clerkOrgId } = await requireOrgContext().catch(() => ({ clerkOrgId: null }));
    if (!clerkOrgId) return new NextResponse("Unauthorized", { status: 401 });

    const { invitationId } = await params;
    const { userId } = await auth();

    const clerk = await clerkClient();
    await clerk.organizations.revokeOrganizationInvitation({
      organizationId: clerkOrgId,
      invitationId,
      requestingUserId: userId ?? undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error revoking invitation:", error);
    return NextResponse.json({ error: error.errors?.[0]?.message || error.message || "Failed to revoke invitation" }, { status: 500 });
  }
}
