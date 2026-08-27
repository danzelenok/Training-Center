import { db } from "@/db";
import { jurisdictions } from "@/db/schema";
import { roleOrUnauthorized } from "@/lib/adminRoles";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET /api/admin/me — the caller's own role + jurisdiction, for client-side
// UI gating (read-only badges, hiding write actions, course-creation defaults).
// Authorization itself always happens server-side per route; this is display
// only.
export async function GET(req: Request) {
  const roleResult = roleOrUnauthorized(req);
  if (roleResult instanceof Response) return roleResult;

  let jurisdiction = null;
  if (roleResult.jurisdictionId) {
    const [row] = await db
      .select({ id: jurisdictions.id, code: jurisdictions.code, name: jurisdictions.name })
      .from(jurisdictions)
      .where(eq(jurisdictions.id, roleResult.jurisdictionId))
      .limit(1);
    jurisdiction = row ?? null;
  }

  return NextResponse.json({ role: roleResult.role, jurisdiction });
}
