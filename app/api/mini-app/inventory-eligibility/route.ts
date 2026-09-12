import { env } from "@/env";
import { NextResponse } from "next/server";
import { withTelegramAuth } from "@/lib/telegram";

// Proxies the "is this Foreman also an Inventory field_worker?" check to the
// separate ToolTrace app (own repo, own DB) so the browser only ever talks
// to our own /api/mini-app/* — no CORS setup needed on ToolTrace's side.
// Server-to-server only. Fails closed to {eligible:false} on any problem
// (not deployed yet, network hiccup, timeout) so a ToolTrace outage can
// never block someone from opening Safety Training.
const CHECK_TIMEOUT_MS = 2500;

export const GET = withTelegramAuth(async (req) => {
  if (!env.INVENTORY_APP_URL) {
    return NextResponse.json({ eligible: false });
  }

  const initData = req.headers.get("Telegram-Init-Data") ?? "";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    const res = await fetch(`${env.INVENTORY_APP_URL}/api/field/eligibility`, {
      headers: { "Telegram-Init-Data": initData },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return NextResponse.json({ eligible: false });
    const data = await res.json();
    return NextResponse.json({ eligible: Boolean(data?.eligible) });
  } catch (err) {
    console.error("inventory-eligibility check failed:", err);
    return NextResponse.json({ eligible: false });
  }
});
