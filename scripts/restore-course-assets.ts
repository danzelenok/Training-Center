/**
 * One-time recovery script: resets all asset-bearing slides to `pending`,
 * clears stale asset URLs, and fires Inngest generation for every course.
 *
 * Run with:
 *   npx tsx scripts/restore-course-assets.ts
 *
 * Requires the Next.js dev server AND the Inngest CLI dev server to be
 * running so Inngest can pick up the triggered events:
 *   npm run dev          (port 3000)
 *   npm run inngest:dev  (port 8288)
 */

import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";

// ─── Load .env.local ─────────────────────────────────────────────────────────
function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const root = path.resolve(process.cwd());
loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not found in environment.");
  process.exit(1);
}

const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY || "local";
const INNGEST_DEV_HOST = process.env.INNGEST_DEV_SERVER_HOST || "http://localhost:8288";
const IS_DEV = process.env.INNGEST_DEV === "1" || process.env.NODE_ENV !== "production";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function clearAssetUrls(content: Record<string, any>): Record<string, any> {
  const cleaned = { ...content };
  delete cleaned.url;
  delete cleaned.assetUrl;
  delete cleaned.imageUrl;
  delete cleaned.heygenJobId;
  delete cleaned.heygenInstructorJobId;
  delete cleaned.heygenStudentJobId;
  delete cleaned.instructorVideoUrl;
  delete cleaned.studentVideoUrl;
  if (Array.isArray(cleaned.slots)) {
    cleaned.slots = cleaned.slots.map(({ videoUrl: _, ...rest }: any) => rest);
  }
  return cleaned;
}

function needsAsset(type: string, content: Record<string, any>): boolean {
  if (type === "audio" || type === "video" || type === "dialogue") return true;
  if (type === "text" && content.visualKeywords) return true;
  if (type === "chat" && content.belowType === "image" && content.visualKeywords) return true;
  return false;
}

async function sendInngestEvent(courseId: string): Promise<void> {
  const event = { name: "course/generate.assets", data: { courseId } };

  if (IS_DEV) {
    const url = `${INNGEST_DEV_HOST}/e/${INNGEST_EVENT_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([event]),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Inngest dev server responded ${res.status}: ${text}`);
    }
  } else {
    // Production: Inngest Cloud event API
    const res = await fetch(`https://inn.gs/e/${INNGEST_EVENT_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([event]),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Inngest Cloud responded ${res.status}: ${text}`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const sql = neon(DATABASE_URL!);
  const pendingEvents: string[] = [];

  // Only restore real courses — skip test/throwaway ones
  const SKIP_COURSE_IDS = ["f07aaca6-3ab0-4506-a84e-f70a12fe02ce"];

  console.log("Fetching all courses...");
  const allCourses = await sql`SELECT id, title, generation_status FROM courses ORDER BY created_at`;
  const courses = allCourses.filter((c) => !SKIP_COURSE_IDS.includes(c.id));
  console.log(`Found ${allCourses.length} course(s); processing ${courses.length} (skipping ${allCourses.length - courses.length}).\n`);

  for (const course of courses) {
    console.log(`── Course: "${course.title}" (${course.id})`);

    const allSlides = await sql`
      SELECT id, type, content, asset_status
      FROM slides
      WHERE course_id = ${course.id} AND language = 'en'
    `;

    const targetSlides = allSlides.filter((s) =>
      needsAsset(s.type, (s.content || {}) as Record<string, any>)
    );

    if (targetSlides.length === 0) {
      console.log("   No asset slides found, skipping.\n");
      continue;
    }

    console.log(`   Resetting ${targetSlides.length} asset slide(s)...`);

    for (const slide of targetSlides) {
      const cleaned = clearAssetUrls((slide.content || {}) as Record<string, any>);
      await sql`
        UPDATE slides
        SET content = ${JSON.stringify(cleaned)}::jsonb,
            asset_status = 'pending',
            updated_at = NOW()
        WHERE id = ${slide.id}
      `;
      console.log(`   ✓ ${slide.type} slide ${slide.id} — reset to pending`);
    }

    await sql`
      UPDATE courses
      SET generation_status = 'generating', updated_at = NOW()
      WHERE id = ${course.id}
    `;
    console.log(`   ✓ Course generation_status → generating`);

    console.log(`   Sending Inngest event...`);
    try {
      await sendInngestEvent(course.id);
      console.log(`   ✓ Event sent\n`);
    } catch (err: any) {
      console.warn(`   ⚠ Inngest unreachable (${err.message}). DB already updated.`);
      pendingEvents.push(course.id);
      console.log();
    }
  }

  if (pendingEvents.length > 0) {
    console.log("─────────────────────────────────────────────────────────────");
    console.log("DB resets are complete. Inngest events were NOT sent because");
    console.log("the dev server is not running.");
    console.log();
    console.log("To kick off generation, start both servers and re-run the script:");
    console.log("  npm run dev          # terminal 1 (port 3000)");
    console.log("  npm run inngest:dev  # terminal 2 (port 8288)");
    console.log("  npx tsx scripts/restore-course-assets.ts   # terminal 3");
    console.log();
    console.log("The slides are already reset in the DB — re-running the script");
    console.log("after starting the servers is the only step needed.");
  } else {
    console.log("Done. Watch the Inngest dev dashboard for progress.");
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
