import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { db } from "@/db";
import { organizations, adminRoles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Clerk sends the admin-invite's publicMetadata (role, jurisdictionId — set
 * at createOrganizationInvitation time, see the /admin/settings/team invite
 * form) forward onto the OrganizationInvitation itself, and this event's
 * payload is the one place that carries both that metadata AND the accepting
 * user's id (`user_id`) in a single JSON body — organizationMembership.created
 * carries the metadata too, but a plain org.created-by-owner membership would
 * also fire that event without ever having gone through an invite.
 *
 * Configure this endpoint's URL in the Clerk Dashboard (Webhooks) subscribed
 * to "organizationInvitation.accepted", and set CLERK_WEBHOOK_SIGNING_SECRET
 * to the signing secret Clerk generates for it.
 */
export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error("Clerk webhook signature verification failed:", err);
    return new NextResponse("Webhook verification failed", { status: 400 });
  }

  if (evt.type !== "organizationInvitation.accepted") {
    return NextResponse.json({ received: true, skipped: evt.type });
  }

  const { organization_id: clerkOrgId, user_id: clerkUserId, public_metadata } = evt.data;
  const metadata = (public_metadata ?? {}) as Record<string, unknown>;
  const role = metadata.role;
  const jurisdictionId = metadata.jurisdictionId;

  if (role !== "org_admin" && role !== "jurisdiction_admin") {
    // Not an invite created through our own /admin/settings/team form (e.g. sent
    // manually via the Clerk Dashboard) — nothing to backfill, and retrying
    // won't produce a role that was never set. Log for visibility, don't 4xx/5xx.
    console.error(
      `organizationInvitation.accepted for user ${clerkUserId} in org ${clerkOrgId} has no valid role in publicMetadata`,
      metadata
    );
    return NextResponse.json({ received: true, ignored: "missing role metadata" });
  }
  if (role === "jurisdiction_admin" && typeof jurisdictionId !== "string") {
    console.error(
      `organizationInvitation.accepted for user ${clerkUserId} in org ${clerkOrgId} is jurisdiction_admin with no jurisdictionId in publicMetadata`,
      metadata
    );
    return NextResponse.json({ received: true, ignored: "missing jurisdictionId metadata" });
  }

  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.clerkOrgId, clerkOrgId))
    .limit(1);
  if (!org) {
    console.error(`organizationInvitation.accepted for unknown Clerk organization ${clerkOrgId}`);
    return NextResponse.json({ received: true, ignored: "unknown organization" });
  }

  await db
    .insert(adminRoles)
    .values({
      organizationId: org.id,
      clerkUserId,
      role,
      jurisdictionId: role === "jurisdiction_admin" ? (jurisdictionId as string) : null,
    })
    .onConflictDoUpdate({
      target: [adminRoles.organizationId, adminRoles.clerkUserId],
      set: { role, jurisdictionId: role === "jurisdiction_admin" ? (jurisdictionId as string) : null },
    });

  return NextResponse.json({ received: true });
}
