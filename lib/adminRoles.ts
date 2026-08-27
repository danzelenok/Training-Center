import { db } from "@/db";
import { adminRoles } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export type AdminRole = "org_admin" | "jurisdiction_admin";

export interface RoleContext {
  role: AdminRole;
  /** null for org_admin; a jurisdictions.id for jurisdiction_admin */
  jurisdictionId: string | null;
}

/** Header names middleware (proxy.ts) sets so route handlers don't have to re-query admin_roles per request. */
export const ADMIN_ROLE_HEADER = "x-admin-role";
export const ADMIN_JURISDICTION_HEADER = "x-admin-jurisdiction-id";

/** Looks up a Clerk user's role for an organization directly from the DB. Used by middleware and the webhook. */
export async function lookupAdminRole(organizationId: string, clerkUserId: string): Promise<RoleContext | null> {
  const [row] = await db
    .select({ role: adminRoles.role, jurisdictionId: adminRoles.jurisdictionId })
    .from(adminRoles)
    .where(and(eq(adminRoles.organizationId, organizationId), eq(adminRoles.clerkUserId, clerkUserId)))
    .limit(1);

  if (!row) return null;
  return { role: row.role, jurisdictionId: row.jurisdictionId };
}

export class MissingRoleError extends Error {}

/**
 * Reads the role context that proxy.ts already resolved and attached to this
 * request as headers. Route handlers must not re-derive this from the DB —
 * middleware is the single place that decides fail-open/fail-closed for a
 * missing role (see proxy.ts).
 *
 * Throws MissingRoleError if the headers aren't present, which happens if a
 * route is called without going through the admin API middleware matcher —
 * that's a routing bug, not an auth outcome, so callers shouldn't treat it
 * as "unauthorized" without checking why.
 */
export function requireRoleFromHeaders(req: Request): RoleContext {
  const role = req.headers.get(ADMIN_ROLE_HEADER);
  if (role !== "org_admin" && role !== "jurisdiction_admin") {
    throw new MissingRoleError(
      `No admin role header on request to ${new URL(req.url).pathname} — is this path covered by proxy.ts's admin API matcher?`
    );
  }
  const jurisdictionId = req.headers.get(ADMIN_JURISDICTION_HEADER) || null;
  return { role, jurisdictionId };
}

/** True if this role can write (edit/publish/delete/generate) a course owned by `ownerJurisdictionId`. */
export function canWriteCourse(ctx: RoleContext, ownerJurisdictionId: string): boolean {
  return ctx.role === "org_admin" || ctx.jurisdictionId === ownerJurisdictionId;
}

/**
 * requireRoleFromHeaders(), but returns a ready-to-return 401 Response instead
 * of throwing when the headers are missing — the common case every course/
 * team/workers route needs, since a missing role header only ever means "not
 * authenticated for this admin API", not a bug worth a 500.
 */
export function roleOrUnauthorized(req: Request): RoleContext | Response {
  try {
    return requireRoleFromHeaders(req);
  } catch (err) {
    if (err instanceof MissingRoleError) return new Response("Unauthorized", { status: 401 });
    throw err;
  }
}
