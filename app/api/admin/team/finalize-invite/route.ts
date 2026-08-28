import { db } from "@/db";
import { adminRoles, organizations } from "@/db/schema";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Called synchronously by TicketSignUpForm right after signUp.finalize(),
 * before it navigates to /admin — bootstraps this user's own admin_roles row
 * from their just-accepted invitation's metadata, instead of waiting on the
 * async organizationInvitation.accepted webhook (app/api/webhooks/clerk),
 * which otherwise races the redirect: proxy.ts's fail-closed role check can
 * 404/access-denied a brand-new admin for the second or so before the
 * webhook lands.
 *
 * Deliberately NOT gated by proxy.ts's role-header middleware (see the
 * isPublicRoute entry for this path) — the whole point is to run for a user
 * who has no admin_roles row yet, so requiring one first would be circular.
 * Auth here is just "is there an active Clerk session + organization",
 * checked directly via auth().
 *
 * Idempotent (ON CONFLICT DO NOTHING): safe to race with the webhook, or to
 * be called more than once — whichever of the two writes first wins, and
 * they'd write the same values anyway since both read the same invitation.
 */
export async function POST() {
  try {
    const { userId, orgId: clerkOrgId } = await auth();
    if (!userId || !clerkOrgId) {
      return NextResponse.json({ error: "No active session or organization." }, { status: 401 });
    }

    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.clerkOrgId, clerkOrgId))
      .limit(1);
    if (!org) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
    if (!email) {
      return NextResponse.json({ error: "No email address on this account." }, { status: 400 });
    }

    const invitations = await clerk.organizations.getOrganizationInvitationList({
      organizationId: clerkOrgId,
      status: ["accepted"],
      limit: 100,
    });
    const invitation = invitations.data.find((inv) => inv.emailAddress.toLowerCase() === email.toLowerCase());
    if (!invitation) {
      // Not every path into this org goes through our invite form (e.g. the
      // very first org_admin, added before this flow existed) — nothing to
      // bootstrap, that's fine, not an error worth surfacing to the client.
      return NextResponse.json({ skipped: "No accepted invitation found for this account." });
    }

    const metadata = (invitation.publicMetadata ?? {}) as Record<string, unknown>;
    const role = metadata.role;
    const jurisdictionId = metadata.jurisdictionId;

    if (role !== "org_admin" && role !== "jurisdiction_admin") {
      return NextResponse.json({ skipped: "Invitation has no role metadata." });
    }
    if (role === "jurisdiction_admin" && typeof jurisdictionId !== "string") {
      return NextResponse.json({ skipped: "Invitation missing jurisdictionId." });
    }

    await db
      .insert(adminRoles)
      .values({
        organizationId: org.id,
        clerkUserId: userId,
        role,
        jurisdictionId: role === "jurisdiction_admin" ? (jurisdictionId as string) : null,
      })
      .onConflictDoNothing({ target: [adminRoles.organizationId, adminRoles.clerkUserId] });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error finalizing invite:", error);
    return NextResponse.json({ error: error.message || "Failed to finalize invite" }, { status: 500 });
  }
}
