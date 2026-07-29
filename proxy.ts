import { clerkClient, clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { env } from "@/env";

// Match public routes that should not be protected
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/onboarding(.*)",
  "/invite(.*)",
  "/access-denied(.*)",
  "/api/bot(.*)",
  "/api/inngest(.*)",
  "/mini-app(.*)"
]);

// Match any path under /admin
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

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
      return NextResponse.next();
    }

    const { userId, orgId } = await auth();

    if (orgId) {
      const [org] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.clerkOrgId, orgId))
        .limit(1);

      if (!org) {
        return NextResponse.redirect(new URL("/access-denied", req.url));
      }

      return NextResponse.next();
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
