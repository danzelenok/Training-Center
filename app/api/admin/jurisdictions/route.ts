import { db } from "@/db";
import { jurisdictions, organizationJurisdictions } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const results = await db
      .select({
        id: jurisdictions.id,
        code: jurisdictions.code,
        name: jurisdictions.name,
      })
      .from(organizationJurisdictions)
      .innerJoin(jurisdictions, eq(jurisdictions.id, organizationJurisdictions.jurisdictionId))
      .where(
        and(
          eq(organizationJurisdictions.organizationId, orgId),
          eq(jurisdictions.isActive, true),
          eq(jurisdictions.isStatePlan, true)
        )
      );

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("Error fetching jurisdictions:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
