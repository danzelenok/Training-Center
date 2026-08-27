import { auth, getAuth } from "@clerk/nextjs/server";
import type { NextApiRequest } from "next";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { env } from "@/env";

export class UnauthorizedOrgError extends Error {}

/** Looks up our internal `organizations.id` for a verified Clerk org id, throwing if unknown. */
async function lookupOrgId(clerkOrgId: string): Promise<string> {
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.clerkOrgId, clerkOrgId))
    .limit(1);

  if (!org) throw new UnauthorizedOrgError("Organization not found");

  return org.id;
}

/**
 * Resolves the caller's Clerk org into our internal `organizations.id`.
 * Throws UnauthorizedOrgError if there's no active Clerk org or it isn't
 * registered in our DB (mirrors the /access-denied case in proxy.ts).
 *
 * In development, MOCK_ORG_ID bypasses the Clerk lookup entirely so the
 * admin API can be exercised without a real Clerk organization.
 *
 * App Router only — relies on `auth()`, which reads from Next.js's
 * request-scoped async context. Pages Router API routes don't have that
 * context; use `requireOrgIdFromApiRequest()` there instead.
 */
export async function requireOrgId(): Promise<string> {
  if (env.NODE_ENV === "development" && env.MOCK_ORG_ID) {
    return env.MOCK_ORG_ID;
  }

  const { orgId } = await auth();
  if (!orgId) throw new UnauthorizedOrgError("No active organization");

  return lookupOrgId(orgId);
}

/**
 * Pages Router equivalent of `requireOrgId()`, for `NextApiRequest` handlers.
 * Uses `getAuth(req)`, the officially supported Clerk helper for Pages
 * Router, which returns the same version-independent `orgId` regardless of
 * the underlying Clerk session-token format (see decodeClerkSessionCookie
 * for why that matters).
 *
 * IMPORTANT: `getAuth(req)` requires `clerkMiddleware` to have run on this
 * request (it reads an auth-status marker the middleware sets); it throws
 * otherwise. Routes that proxy.ts deliberately bypasses clerkMiddleware for
 * (currently `/api/media/upload` and `/api/courses/[id]/upload`, both for
 * request-body-size reasons) cannot use this — they still need
 * `decodeClerkSessionCookie()` below.
 */
export async function requireOrgIdFromApiRequest(req: NextApiRequest): Promise<string> {
  if (env.NODE_ENV === "development" && env.MOCK_ORG_ID) {
    return env.MOCK_ORG_ID;
  }

  const { orgId } = getAuth(req);
  if (!orgId) throw new UnauthorizedOrgError("No active organization");

  return lookupOrgId(orgId);
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
    // Clerk's v2 session token format nests active-org data under `o.id`
    // instead of the flat `org_id` claim used by v1 tokens.
    const clerkOrgId = payload.org_id || payload.o?.id || null;
    return { userId: payload.sub || null, clerkOrgId };
  } catch {
    return { userId: null, clerkOrgId: null };
  }
}

/**
 * Like requireOrgId(), but also returns the raw Clerk org id — needed by any
 * route that has to call the Clerk Backend API directly (organization
 * membership/invitation management), which only understands Clerk's own id,
 * not our internal `organizations.id`.
 *
 * Has no MOCK_ORG_ID dev bypass: there's no real Clerk organization behind a
 * mocked org id, so nothing that calls the Clerk API can be exercised in that
 * mode.
 */
export async function requireOrgContext(): Promise<{ id: string; clerkOrgId: string }> {
  const { orgId } = await auth();
  if (!orgId) throw new UnauthorizedOrgError("No active organization");

  const id = await lookupOrgId(orgId);
  return { id, clerkOrgId: orgId };
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
