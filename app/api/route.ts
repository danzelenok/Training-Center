import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Safety Training API service foundation initialized.",
    timestamp: new Date().toISOString(),
  });
}
