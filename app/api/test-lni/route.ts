import { NextResponse } from "next/server";
import { fetchRegulatoryContext } from "@/lib/regulatory-scraper";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const topic = searchParams.get("topic") || "fall protection";

  const keyPresent = !!process.env.BRAVE_SEARCH_API_KEY;

  try {
    const result = await fetchRegulatoryContext(topic, "www.lni.wa.gov", "Washington State L&I");
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
