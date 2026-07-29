import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { env } from "@/env";

export class UnauthorizedOrgError extends Error {}

/**
 * Resolves the caller's Clerk org into our internal `organizations.id`.
 * Throws UnauthorizedOrgError if there's no active Clerk org or it isn't
 * registered in our DB (mirrors the /access-denied case in proxy.ts).
 *
 * In development, MOCK_ORG_ID bypasses the Clerk lookup entirely so the
 * admin API can be exercised without a real Clerk organization.
 */
export async function requireOrgId(): Promise<string> {
  if (env.NODE_ENV === "development" && env.MOCK_ORG_ID) {
    return env.MOCK_ORG_ID;
  }

  const { orgId } = await auth();
  if (!orgId) throw new UnauthorizedOrgError("No active organization");

  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.clerkOrgId, orgId))
    .limit(1);

  if (!org) throw new UnauthorizedOrgError("Organization not found");

  return org.id;
}

/**
 * Decodes the Clerk __session cookie without verifying its signature, to
 * read the userId (sub) and active org (org_id) claims. Only for the small
 * set of Pages Router routes that bypass proxy.ts/clerkMiddleware entirely
 * (large-upload routes with bodyParser disabled) and so never get a verified
 * `auth()` context. Signature verification already happened when Clerk's own
 * client-side SDK obtained this cookie; we're just reading claims here, the
 * same way these routes already did for `sub` before this change.
 */
export function decodeClerkSessionCookie(cookieHeader: string): {
  userId: string | null;
  clerkOrgId: string | null;
} {
  const sessionCookie = cookieHeader
    .split(";")
    .find((c) => c.trim().startsWith("__session="))
    ?.split("=")[1];

  if (!sessionCookie) return { userId: null, clerkOrgId: null };

  try {
    const payloadBase64 = sessionCookie.split(".")[1];
    const payload = JSON.parse(Buffer.from(payloadBase64, "base64").toString());
    return { userId: payload.sub || null, clerkOrgId: payload.org_id || null };
  } catch {
    return { userId: null, clerkOrgId: null };
  }
}

/** Resolves a Clerk org id (as read from a session cookie/claim) to our internal organizations.id. */
export async function resolveOrgId(clerkOrgId: string | null): Promise<string | null> {
  if (env.NODE_ENV === "development" && env.MOCK_ORG_ID) {
    return env.MOCK_ORG_ID;
  }
  if (!clerkOrgId) return null;

  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.clerkOrgId, clerkOrgId))
    .limit(1);

  return org?.id ?? null;
}
