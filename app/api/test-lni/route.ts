import { NextResponse } from "next/server";
import { fetchLNIContext } from "@/lib/lni-scraper";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const topic = searchParams.get("topic") || "fall protection";

  const keyPresent = !!process.env.BRAVE_SEARCH_API_KEY;

  try {
    const result = await fetchLNIContext(topic);
    return NextResponse.json({
      keyPresent,
      sourcesCount: result.sources.length,
      sourcesDescription: result.sourcesDescription,
      sources: result.sources.map((s) => ({ url: s.url, title: s.title, textLength: s.text.length })),
    });
  } catch (err: any) {
    return NextResponse.json({ keyPresent, error: err.message }, { status: 500 });
  }
}
