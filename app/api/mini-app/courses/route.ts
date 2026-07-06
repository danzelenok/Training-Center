import { db } from "@/db";
import { courses, progress, workers, assignments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { validateInitData } from "@/lib/telegram";

export async function GET(req: Request) {
  const initDataRaw = req.headers.get("Telegram-Init-Data");

  if (!initDataRaw) {
    return NextResponse.json([]);
  }

  let telegramUser;
  try {
    telegramUser = validateInitData(initDataRaw);
  } catch {
    return NextResponse.json([]);
  }

  const [worker] = await db
    .select({ id: workers.id })
    .from(workers)
    .where(eq(workers.telegramUserId, telegramUser.id))
    .limit(1);

  if (!worker) {
    return NextResponse.json([]);
  }

  // Only courses explicitly assigned to this worker
  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      progressStatus: progress.status,
      currentSlideIndex: progress.currentSlideIndex,
    })
    .from(assignments)
    .innerJoin(courses, and(eq(courses.id, assignments.courseId), eq(courses.status, "published")))
    .leftJoin(
      progress,
      and(eq(progress.courseId, assignments.courseId), eq(progress.workerId, worker.id))
    )
    .where(eq(assignments.workerId, worker.id));

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      progressStatus: r.progressStatus ?? "not_started",
      currentSlideIndex: r.currentSlideIndex ?? 0,
    }))
  );
}
