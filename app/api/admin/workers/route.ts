import { db } from "@/db";
import { workers, invites, courses, assignments } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
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

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";

    if (!name) {
      return new NextResponse(
        JSON.stringify({ error: "Name is required." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (phone) {
      const [existingPhone] = await db
        .select({ id: workers.id })
        .from(workers)
        .where(eq(workers.phone, phone))
        .limit(1);

      if (existingPhone) {
        return new NextResponse(
          JSON.stringify({ error: "A worker with this phone number already exists." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const nameParts = name.split(/\s+/);
    const firstName = nameParts[0] || null;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

    // 1. Create worker
    const [worker] = await db
      .insert(workers)
      .values({
        telegramUserId: null,
        displayName: name,
        firstName,
        lastName,
        phone: phone || null,
      })
      .returning();

    // 2. Auto-assign published courses that have autoAssignNewWorkers = true
    const autoAssignCourses = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.autoAssignNewWorkers, true));

    if (autoAssignCourses.length > 0) {
      await db
        .insert(assignments)
        .values(
          autoAssignCourses.map((c) => ({
            workerId: worker.id,
            courseId: c.id,
          }))
        )
        .onConflictDoNothing({ target: [assignments.workerId, assignments.courseId] });
    }

    // 3. Create initial invite
    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const [invite] = await db
      .insert(invites)
      .values({
        workerId: worker.id,
        token,
        status: "pending",
        expiresAt,
      })
      .returning();

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "CoolCatTraining_bot";
    const inviteUrl = `https://t.me/${botUsername}?start=${token}`;

    return NextResponse.json({
      worker: {
        ...worker,
        telegramUserId: null,
      },
      invite: {
        id: invite.id,
        token: invite.token,
        expiresAt: invite.expiresAt,
        status: invite.status,
      },
      inviteUrl,
    });
  } catch (error: any) {
    console.error("Error creating worker:", error);
    return new NextResponse(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
