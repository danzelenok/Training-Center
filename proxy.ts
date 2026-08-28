import { clerkClient, clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { env } from "@/env";
import { ADMIN_ROLE_HEADER, ADMIN_JURISDICTION_HEADER, lookupAdminRole, type RoleContext } from "@/lib/adminRoles";

// Match public routes that should not be protected
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/onboarding(.*)",
  "/invite(.*)",
  "/access-denied(.*)",
  "/api/bot(.*)",
  "/api/inngest(.*)",
  "/api/webhooks(.*)",
  // Called by a brand-new admin's own sign-up flow before they have an
  // admin_roles row yet (see the route for why) — must not go through the
  // role-header gate below, which would 403 them for exactly that reason.
  "/api/admin/team/finalize-invite",
  "/mini-app(.*)"
]);

// Match any path under /admin
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

// Admin API routes that read course/worker ownership and need the caller's
// role + jurisdiction available without re-querying admin_roles themselves.
// Scoped to exactly the route groups whose handlers were updated to check
// role (see lib/adminRoles.ts callers) — not every /api/* path.
const isAdminApiRoute = createRouteMatcher([
  "/api/courses(.*)",
  "/api/slides(.*)",
  "/api/admin(.*)",
  "/api/workers(.*)",
  "/api/reports(.*)",
]);

function devMockRole(): RoleContext {
  return {
    role: env.MOCK_ADMIN_ROLE ?? "org_admin",
    jurisdictionId: env.MOCK_ADMIN_ROLE === "jurisdiction_admin" ? env.MOCK_ADMIN_JURISDICTION_ID ?? null : null,
  };
}

function withRoleHeaders(req: any, ctx: RoleContext) {
  const headers = new Headers(req.headers);
  headers.set(ADMIN_ROLE_HEADER, ctx.role);
  headers.set(ADMIN_JURISDICTION_HEADER, ctx.jurisdictionId ?? "");
  return NextResponse.next({ request: { headers } });
}

// This decision is only ever valid for the instant it was made — the very
// next request from the same admin (e.g. immediately after a role finishes
// being provisioned) must be re-evaluated, never served a cached "denied"
// from a moment ago.
function accessDenied(req: any) {
  const res = NextResponse.redirect(new URL("/access-denied", req.url));
  res.headers.set("Cache-Control", "no-store");
  return res;
}

const clerkAuthMiddleware = clerkMiddleware(async (auth, req) => {
  // If it's a public route, do not protect it
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // If it's an admin route, resolve which organization (if any) the signed-in
  // user belongs to and route them accordingly.
  if (isAdminRoute(req)) {
    await auth.protect();

    if (env.NODE_ENV === "development" && env.MOCK_ORG_ID) {
      return withRoleHeaders(req, devMockRole());
    }

    const { userId, orgId } = await auth();

    if (orgId) {
      const [org] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.clerkOrgId, orgId))
        .limit(1);

      if (!org) {
        return accessDenied(req);
      }

      // Fail-closed: a Clerk member with no admin_roles row yet (invite
      // accepted but the organizationInvitation.accepted webhook hasn't
      // landed, or it failed) gets no admin access until that row exists.
      // TicketSignUpForm calls /api/admin/team/finalize-invite synchronously
      // before redirecting here specifically to avoid hitting this — this
      // remains the fallback for every other path into the org.
      const roleCtx = await lookupAdminRole(org.id, userId!);
      if (!roleCtx) {
        return accessDenied(req);
      }

      return withRoleHeaders(req, roleCtx);
    }

    const client = await clerkClient();
    const pendingInvitations = await client.users.getOrganizationInvitationList({
      userId: userId!,
      status: "pending",
    });

    if (pendingInvitations.data.length > 0) {
      return NextResponse.redirect(new URL("/invite", req.url));
    }

    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  // Admin API routes: same org+role resolution as page routes, but a missing
  // org or role can't redirect to a page — respond with the API's own
  // unauthorized/forbidden status instead and let the route handler's own
  // requireOrgId() produce the 401 body it already produces today.
  if (isAdminApiRoute(req)) {
    if (env.NODE_ENV === "development" && env.MOCK_ORG_ID) {
      return withRoleHeaders(req, devMockRole());
    }

    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      // No active org/session — fall through without role headers so the
      // route's existing requireOrgId() 401s exactly as it did before this
      // change (unauthenticated callers were never route-scoped by role).
      return NextResponse.next();
    }

    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.clerkOrgId, orgId))
      .limit(1);
    if (!org) {
      return NextResponse.next();
    }

    const roleCtx = await lookupAdminRole(org.id, userId);
    if (!roleCtx) {
      return NextResponse.json({ error: "No admin role assigned for this organization." }, { status: 403 });
    }

    return withRoleHeaders(req, roleCtx);
  }

  // Allow all other requests to continue normally
  return NextResponse.next();
});

export const proxy = (req: any, evt: any) => {
  // Bypass Clerk middleware for routes that use bodyParser:false (large file uploads).
  // Auth for these routes is handled manually via the __session cookie.
  const pathname: string = req.nextUrl.pathname;
  const isBypassedUpload =
    pathname.match(/^\/api\/courses\/[^/]+\/upload$/) || // PPTX course upload
    pathname === "/api/media/upload";                     // R2 media upload

  if (isBypassedUpload) {
    return NextResponse.next();
  }

  return clerkAuthMiddleware(req, evt);
};

export const config = {
  matcher: [
    // Run for all non‑static routes and API routes
    "/((?!_next|[^?]*\\.[\\w]+$).*)",
    "/(api|trpc)(.*)"
  ]
};
