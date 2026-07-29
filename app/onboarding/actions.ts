"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Registers a Clerk organization (already created client-side via
 * useOrganizationList().createOrganization) in our own `organizations` table.
 * The Clerk org is the source of truth for membership/auth; this just links
 * it to our tenant id.
 */
export async function registerOrganization(clerkOrgId: string, name: string) {
  const { userId, orgId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  if (orgId !== clerkOrgId) throw new Error("Organization is not active for this session");

  const [existing] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.clerkOrgId, clerkOrgId))
    .limit(1);

  if (existing) return existing;

  const [org] = await db
    .insert(organizations)
    .values({ clerkOrgId, name })
    .returning();

  return org;
}
