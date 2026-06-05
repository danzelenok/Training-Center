import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import fs from "fs";
import path from "path";

// Path to a local cache file within the workspace
const CACHE_FILE = path.join(process.cwd(), "scratch/avatars_cache.json");

export async function GET(req: NextRequest) {
  const apiKey = env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "HEYGEN_API_KEY not configured" }, { status: 500 });
  }

  // Check if cache file exists and is less than 24 hours old
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const stats = fs.statSync(CACHE_FILE);
      const ageMs = Date.now() - stats.mtimeMs;
      if (ageMs < 24 * 60 * 60 * 1000) {
        const cachedData = fs.readFileSync(CACHE_FILE, "utf-8");
        return NextResponse.json(JSON.parse(cachedData));
      }
    } catch (e) {
      console.error("Failed to read avatars cache:", e);
    }
  }

  // Fetch all avatars from HeyGen paginated
  try {
    let url: string | null = "https://api.heygen.com/v3/avatars?limit=50";
    const allAvatars: any[] = [];
    while (url) {
      const res: Response = await fetch(url, {
        headers: { "X-Api-Key": apiKey }
      });
      if (!res.ok) {
        throw new Error(`HeyGen returned ${res.status}`);
      }
      const data: any = await res.json();
      if (data.data && Array.isArray(data.data)) {
        allAvatars.push(...data.data);
      }
      if (data.has_more && data.next_token) {
        url = `https://api.heygen.com/v3/avatars?token=${encodeURIComponent(data.next_token)}`;
      } else {
        url = null;
      }
    }

    // Map to essential fields to save bandwidth
    const mapped = allAvatars.map((av: any) => ({
      id: av.id,
      name: av.name,
      preview_image_url: av.preview_image_url,
      gender: av.gender,
    }));

    // Ensure the parent directory exists
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write to cache file
    fs.writeFileSync(CACHE_FILE, JSON.stringify(mapped), "utf-8");

    return NextResponse.json(mapped);
  } catch (err: any) {
    console.error("Failed to fetch HeyGen avatars:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch avatars" }, { status: 502 });
  }
}
