import { db } from "@/db";
import { workers } from "@/db/schema";
import { withTelegramAuth } from "@/lib/telegram";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

function serializeWorker(worker: typeof workers.$inferSelect) {
  return {
    id: worker.id,
    displayName: worker.displayName,
    firstName: worker.firstName,
    lastName: worker.lastName,
    telegramUsername: worker.telegramUsername,
  };
}

// GET /api/mini-app/me
export const GET = withTelegramAuth(async (_req, { worker }) => {
  return NextResponse.json(serializeWorker(worker));
});

// PATCH /api/mini-app/me
export const PATCH = withTelegramAuth(async (req, { worker }) => {
  try {
    const body = await req.json();
    const { displayName } = body;

    if (typeof displayName !== "string" || displayName.trim().length === 0) {
      return new NextResponse("displayName must be a non-empty string", { status: 400 });
    }
    if (displayName.length > 100) {
      return new NextResponse("displayName must be at most 100 characters", { status: 400 });
    }

    const [updated] = await db
      .update(workers)
      .set({ displayName: displayName.trim(), updatedAt: new Date() })
      .where(eq(workers.id, worker.id))
      .returning();

    return NextResponse.json(serializeWorker(updated));
  } catch (error: any) {
    console.error("PATCH /api/mini-app/me error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
});
