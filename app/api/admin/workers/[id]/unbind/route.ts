import { db } from "@/db";
import { workers, invites } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
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
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;

    const [worker] = await db
      .select()
      .from(workers)
      .where(eq(workers.id, id))
      .limit(1);

    if (!worker) {
      return new NextResponse(
        JSON.stringify({ error: "Worker not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // 1. Clear telegramUserId
    await db
      .update(workers)
      .set({
        telegramUserId: null,
        updatedAt: new Date(),
      })
      .where(eq(workers.id, id));

    // 2. Revoke pending invites
    await db
      .update(invites)
      .set({ status: "revoked" })
      .where(and(eq(invites.workerId, id), eq(invites.status, "pending")));

    // 3. Create new invite
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
    console.error("Error unbinding worker Telegram account:", error);
    return new NextResponse(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
