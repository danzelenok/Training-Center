import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Match public routes that should not be protected
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
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

  // If it's an admin route, protect it
  if (isAdminRoute(req)) {
    await auth.protect();
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
    pathname === "/api/media/upload";                     // ImageKit media upload

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
