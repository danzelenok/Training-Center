import { NextRequest, NextResponse } from "next/server";
import { bot } from "@/lib/bot";
import { env } from "@/env";
import { getAuth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate the request
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");
    
    let isAuthorized = false;

    // Check A: Query secret matches the Telegram Bot Token
    const botToken = process.env.BOT_TOKEN || env.TELEGRAM_BOT_TOKEN;
    if (secret && secret === botToken) {
      isAuthorized = true;
    }

    // Check B: User is authenticated using Clerk
    if (!isAuthorized) {
      try {
        const { userId } = getAuth(req);
        if (userId) {
          isAuthorized = true;
        }
      } catch (e) {
        // Clerk authentication context not available or not signed in
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Unauthorized. Provide a valid 'secret' parameter or sign in as admin." },
        { status: 401 }
      );
    }

    // 2. Resolve the base webhook URL dynamically
    const baseAppUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      env.NEXT_PUBLIC_APP_URL ||
      new URL(req.url).origin;

    const webhookUrl = `${baseAppUrl}/api/bot/webhook`;

    console.log(`Setting up Telegram Bot webhook targeting: ${webhookUrl}`);
    
    // Call setWebhook API
    await bot.api.setWebhook(webhookUrl);

    // Retrieve the webhook info to confirm it was set correctly
    const webhookInfo = await bot.api.getWebhookInfo();

    return NextResponse.json({
      status: "success",
      message: "Telegram Bot webhook set successfully.",
      webhookUrl,
      webhookInfo: {
        url: webhookInfo.url,
        has_custom_certificate: webhookInfo.has_custom_certificate,
        pending_update_count: webhookInfo.pending_update_count,
        max_connections: webhookInfo.max_connections,
      },
    });
  } catch (error: any) {
    console.error("Error setting up Telegram Bot webhook:", error);
    return NextResponse.json(
      { error: "Failed to register webhook with Telegram", details: error.message },
      { status: 500 }
    );
  }
}
