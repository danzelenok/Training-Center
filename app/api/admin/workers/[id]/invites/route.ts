import { db } from "@/db";
import { workers, invites } from "@/db/schema";
import { requireOrgId } from "@/lib/org";
import { roleOrUnauthorized } from "@/lib/adminRoles";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function generateInviteToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(21);
  let token = "";
  for (let i = 0; i < 21; i++) {
    token += chars[bytes[i] % chars.length];
  }
  return token;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await requireOrgId().catch(() => null);
    if (!orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const roleResult = roleOrUnauthorized(req);
    if (roleResult instanceof Response) return roleResult;

    const { id } = await params;

    const [worker] = await db
      .select()
      .from(workers)
      .where(and(eq(workers.id, id), eq(workers.organizationId, orgId)))
      .limit(1);

    if (!worker) {
      return new NextResponse(
        JSON.stringify({ error: "Worker not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
    if (roleResult.role === "jurisdiction_admin" && worker.jurisdictionId !== roleResult.jurisdictionId) {
      return NextResponse.json({ error: "You can only manage workers in your jurisdiction." }, { status: 403 });
    }

    // Revoke previous pending invites
    await db
      .update(invites)
      .set({ status: "revoked" })
      .where(and(eq(invites.workerId, id), eq(invites.status, "pending")));

    // Create new invite
    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const [invite] = await db
      .insert(invites)
      .values({
        workerId: id,
        token,
        status: "pending",
        expiresAt,
      })
      .returning();

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "CoolCatTraining_bot";
    const inviteUrl = `https://t.me/${botUsername}?start=${token}`;

    return NextResponse.json({
      invite: {
        id: invite.id,
        token: invite.token,
        expiresAt: invite.expiresAt,
        status: invite.status,
      },
      inviteUrl,
    });
  } catch (error: any) {
    console.error("Error reissuing worker invite:", error);
    return new NextResponse(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
