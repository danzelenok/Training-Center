import { db } from "@/db";
import { courses, progress, workers } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { validateInitData } from "@/lib/telegram";

export async function GET(req: Request) {
  const published = await db
    .select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
    })
    .from(courses)
    .where(eq(courses.status, "published"));

  if (published.length === 0) {
    return NextResponse.json([]);
  }

  // If Telegram auth is provided, attach per-course progress
  const initDataRaw = req.headers.get("Telegram-Init-Data");
  if (initDataRaw) {
    try {
      const telegramUser = validateInitData(initDataRaw);

      const [worker] = await db
        .select({ id: workers.id })
        .from(workers)
        .where(eq(workers.telegramUserId, telegramUser.id))
        .limit(1);

      if (worker) {
        const courseIds = published.map((c) => c.id);
        const progressRows = await db
          .select({
            courseId: progress.courseId,
            status: progress.status,
            currentSlideIndex: progress.currentSlideIndex,
          })
          .from(progress)
          .where(
            and(
              eq(progress.workerId, worker.id),
              inArray(progress.courseId, courseIds)
            )
          );

        const progressMap = Object.fromEntries(
          progressRows.map((r) => [r.courseId, r])
        );

        return NextResponse.json(
          published.map((c) => ({
            ...c,
            progressStatus: progressMap[c.id]?.status ?? "not_started",
            currentSlideIndex: progressMap[c.id]?.currentSlideIndex ?? 0,
          }))
        );
      }
    } catch {
      // Invalid auth — fall through and return courses without progress
    }
  }

  return NextResponse.json(
    published.map((c) => ({ ...c, progressStatus: "not_started" as const, currentSlideIndex: 0 }))
  );
}
