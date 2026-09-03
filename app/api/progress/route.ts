import { db } from "@/db";
import { progress, courses, slides } from "@/db/schema";
import { withTelegramAuth } from "@/lib/telegram";
import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

// Extracts { quizType, correctIndices } for a quiz slide, or the embedded quiz
// inside a dialogue slide. Returns null for slides that carry no quiz to grade.
function getSlideQuizAnswerKey(slideType: string, content: any): { quizType: "single" | "multiple"; correctIndices: number[] } | null {
  if (slideType === "quiz" && Array.isArray(content?.correctIndices)) {
    return { quizType: content.quizType === "multiple" ? "multiple" : "single", correctIndices: content.correctIndices };
  }
  if (slideType === "dialogue" && content?.dialogueBelowType === "quiz" && Array.isArray(content?.belowQuizCorrectIndices)) {
    return { quizType: content.belowQuizType === "multiple" ? "multiple" : "single", correctIndices: content.belowQuizCorrectIndices };
  }
  return null;
}

// Scores a single answered question: exact match for single-select, partial credit
// for multi-select (max(0, correctPicks - wrongPicks) / totalCorrect).
// selectedIndices comes straight from the client request body, so it's deduped
// through a Set before counting — otherwise a client could send a repeated index
// (e.g. [0,0,0]) to inflate correctPicks past correctIndices.length and push the
// score over 100.
function scoreAnswer(quizType: "single" | "multiple", correctIndices: number[], selectedIndices: number[]): number {
  if (correctIndices.length === 0) return 0;

  const correctSet = new Set(correctIndices);
  const selectedSet = new Set(selectedIndices);

  if (quizType === "single") {
    const exactMatch = selectedSet.size === correctSet.size && [...selectedSet].every((i) => correctSet.has(i));
    return exactMatch ? 100 : 0;
  }

  const selected = [...selectedSet];
  const correctPicks = selected.filter((i) => correctSet.has(i)).length;
  const wrongPicks = selected.filter((i) => !correctSet.has(i)).length;
  return Math.max(0, Math.min(1, (correctPicks - wrongPicks) / correctIndices.length)) * 100;
}

// Recomputes the overall quiz score from the full set of merged answers against the
// course's current slide content, averaged across every answered question.
async function computeQuizScore(courseId: string, quizAnswers: Record<string, number[]>): Promise<number | null> {
  const slideIds = Object.keys(quizAnswers);
  if (slideIds.length === 0) return null;

  const quizSlides = await db
    .select({ id: slides.id, type: slides.type, content: slides.content })
    .from(slides)
    .where(and(eq(slides.courseId, courseId), inArray(slides.id, slideIds)));

  const scores: number[] = [];
  for (const s of quizSlides) {
    const answerKey = getSlideQuizAnswerKey(s.type, s.content);
    if (!answerKey) continue;
    const selectedIndices = quizAnswers[s.id];
    if (!Array.isArray(selectedIndices)) continue;
    scores.push(scoreAnswer(answerKey.quizType, answerKey.correctIndices, selectedIndices));
  }

  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
}

// GET /api/progress?courseId=<uuid>
export const GET = withTelegramAuth(async (req, { worker }) => {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    if (!courseId) {
      return new NextResponse("Missing courseId parameter", { status: 400 });
    }

    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.organizationId, worker.organizationId)))
      .limit(1);
    if (!course) {
      return new NextResponse("Course not found", { status: 404 });
    }

    const [prog] = await db
      .select()
      .from(progress)
      .where(
        and(
          eq(progress.workerId, worker.id),
          eq(progress.courseId, courseId)
        )
      )
      .limit(1);

    if (!prog) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      currentSlideIndex: prog.currentSlideIndex,
      status: prog.status,
      courseId: prog.courseId,
      quizScore: prog.quizScore,
      completedAt: prog.completedAt,
    });
  } catch (error: any) {
    console.error("GET /api/progress error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
});

// POST /api/progress
export const POST = withTelegramAuth(async (req, { worker }) => {
  try {
    const body = await req.json();
    const { courseId, currentSlideIndex, status, slideId, selectedIndices } = body;

    if (!courseId) {
      return new NextResponse("Missing courseId parameter", { status: 400 });
    }
    if (currentSlideIndex === undefined) {
      return new NextResponse("Missing currentSlideIndex parameter", { status: 400 });
    }
    if (!status) {
      return new NextResponse("Missing status parameter", { status: 400 });
    }

    // Write-time invariant: never create progress for a course outside the worker's organization
    const [course] = await db
      .select({ id: courses.id, title: courses.title })
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.organizationId, worker.organizationId)))
      .limit(1);
    if (!course) {
      return new NextResponse("Course not found", { status: 404 });
    }

    const isCompleted = status === "completed";
    const completedAtVal = isCompleted ? new Date() : null;

    // progress has a unique constraint on (worker_id, course_id). Two near-simultaneous
    // requests can both miss the existing row in the select below and both attempt an
    // insert; the loser is caught here and retried as an update so we never end up with
    // two progress rows for the same worker+course.
    let updatedProgress;
    let wasCompleted = false;

    for (let attempt = 0; ; attempt++) {
      const [existing] = await db
        .select()
        .from(progress)
        .where(
          and(
            eq(progress.workerId, worker.id),
            eq(progress.courseId, courseId)
          )
        )
        .limit(1);

      // Merge this request's answer (if any) into the accumulated quiz answers, then
      // recompute the overall score from actual slide content — the client only ever
      // sends raw selections, never a score.
      let mergedQuizAnswers = existing?.quizAnswers ?? null;
      let computedQuizScore = existing?.quizScore ?? null;
      if (slideId && Array.isArray(selectedIndices)) {
        mergedQuizAnswers = { ...(mergedQuizAnswers || {}), [slideId]: selectedIndices };
        computedQuizScore = await computeQuizScore(courseId, mergedQuizAnswers);
      }

      if (existing) {
        // Never downgrade a completed course — once done, always done
        wasCompleted = existing.status === "completed";
        const effectiveStatus = wasCompleted ? "completed" : status;
        const effectiveIsCompleted = effectiveStatus === "completed";

        const [updated] = await db
          .update(progress)
          .set({
            currentSlideIndex,
            status: effectiveStatus,
            quizScore: computedQuizScore,
            quizAnswers: mergedQuizAnswers,
            completedAt: effectiveIsCompleted ? (existing.completedAt || completedAtVal) : existing.completedAt,
            updatedAt: new Date(),
          })
          .where(eq(progress.id, existing.id))
          .returning();

        updatedProgress = updated;
        break;
      }

      try {
        const [inserted] = await db
          .insert(progress)
          .values({
            workerId: worker.id,
            courseId,
            currentSlideIndex,
            status,
            quizScore: computedQuizScore,
            quizAnswers: mergedQuizAnswers,
            completedAt: completedAtVal,
          })
          .returning();

        updatedProgress = inserted;
        break;
      } catch (err: any) {
        if (err?.code === "23505" && attempt === 0) {
          // Lost the insert race — a concurrent request just created the row.
          // Retry: the select above will now find it and take the update path.
          continue;
        }
        throw err;
      }
    }

    return NextResponse.json(updatedProgress);
  } catch (error: any) {
    console.error("POST /api/progress error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
});
