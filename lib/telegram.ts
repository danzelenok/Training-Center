import crypto from "crypto";
import { env } from "@/env";
import { db } from "@/db";
import { workers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export interface TelegramUser {
  id: bigint;
  first_name: string;
  last_name?: string;
  username?: string;
}

/**
 * Validates the Telegram Mini App initData against the bot token.
 * Reference: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramInitData(initData: string): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;

  // Remove hash parameter before verification
  params.delete("hash");

  // Sort alphabetically
  const keys = Array.from(params.keys()).sort();
  const dataCheckString = keys
    .map((key) => `${key}=${params.get(key)}`)
    .join("\n");

  // Generate secret key
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(env.TELEGRAM_BOT_TOKEN)
    .digest();

  // Compute verification hash
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return computedHash === hash;
}

/**
 * Validates Telegram initData and returns the parsed user information.
 * Throws an error if validation fails.
 */
export function validateInitData(initDataRaw: string): TelegramUser {
  if (!initDataRaw) {
    throw new Error("initData is empty");
  }

  // Development mode bypass
  if (env.NODE_ENV === "development" && initDataRaw === "mock-dev-data") {
    return {
      id: BigInt(999999999),
      first_name: "Dev",
      last_name: "User",
      username: "dev_user",
    };
  }

  const params = new URLSearchParams(initDataRaw);
  const hash = params.get("hash");
  if (!hash) throw new Error("Missing hash in initData");

  params.delete("hash");

  const keys = Array.from(params.keys()).sort();
  const dataCheckString = keys
    .map((key) => `${key}=${params.get(key)}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(env.TELEGRAM_BOT_TOKEN)
    .digest();

  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) {
    throw new Error("Invalid Telegram signature");
  }

  const userJson = params.get("user");
  if (!userJson) throw new Error("Missing user data in initData");

  const user = JSON.parse(userJson);
  if (!user || !user.id) throw new Error("Invalid user data structure");

  return {
    id: BigInt(user.id),
    first_name: user.first_name || "",
    last_name: user.last_name || undefined,
    username: user.username || undefined,
  };
}

/**
 * Wrapper for Next.js Route Handlers to validate Telegram auth
 * and upsert the corresponding worker.
 */
export function withTelegramAuth<T = any>(
  handler: (
    req: Request,
    context: T & {
      worker: typeof workers.$inferSelect;
      telegramUser: TelegramUser;
    }
  ) => Promise<Response> | Response
) {
  return async (req: Request, context: T) => {
    try {
      const initDataRaw = req.headers.get("Telegram-Init-Data");
      if (!initDataRaw) {
        return new NextResponse("Unauthorized: Missing Telegram-Init-Data header", { status: 401 });
      }

      let telegramUser: TelegramUser;
      try {
        telegramUser = validateInitData(initDataRaw);
      } catch (err: any) {
        console.error("Telegram validation failed:", err);
        return new NextResponse("Unauthorized: Invalid signature", { status: 401 });
      }

      // Query existing worker by telegramUserId
      const [worker] = await db
        .select()
        .from(workers)
        .where(eq(workers.telegramUserId, telegramUser.id))
        .limit(1);

      if (!worker) {
        return new NextResponse("Unauthorized: Worker account not linked. Please activate your invite link first.", { status: 403 });
      }

      // Sync latest Telegram profile info
      await db
        .update(workers)
        .set({
          telegramUsername: telegramUser.username || worker.telegramUsername,
          firstName: telegramUser.first_name || worker.firstName,
          lastName: telegramUser.last_name || worker.lastName,
          updatedAt: new Date(),
        })
        .where(eq(workers.id, worker.id));

      return await handler(req, { ...context, worker, telegramUser });
    } catch (error: any) {
      console.error("withTelegramAuth exception:", error);
      return new NextResponse(error.message || "Internal Server Error", { status: 500 });
    }
  };
}
