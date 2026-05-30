import { webhookCallback } from "grammy";
import { bot } from "@/lib/bot";
import { NextResponse } from "next/server";

// Force Next.js dynamic routing behavior (no static optimization or caching)
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Use the standard HTTP/Web API adapter for Next.js App Router (std/http)
const handleUpdate = webhookCallback(bot, "std/http");

export async function POST(req: Request) {
  try {
    return await handleUpdate(req);
  } catch (error: any) {
    console.error("Error executing Telegram Bot webhook:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal bot execution error", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
