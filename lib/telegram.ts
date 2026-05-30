import crypto from "crypto";
import { env } from "@/env";

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
