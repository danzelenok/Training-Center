import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query")?.trim();
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const apiKey = env.PEXELS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "PEXELS_API_KEY not configured" }, { status: 500 });
  }

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "20");
  url.searchParams.set("orientation", "landscape");

  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Pexels error: ${res.status} ${text}` }, { status: 502 });
  }

  const data = await res.json();
  const photos = (data.photos ?? []).map((p: any) => ({
    id: p.id,
    url: p.src.large2x || p.src.large || p.src.original,
    thumbnail: p.src.medium,
    photographer: p.photographer,
    photographerUrl: p.photographer_url,
  }));

  return NextResponse.json(photos);
}
