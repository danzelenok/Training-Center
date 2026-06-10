import { inngest } from "./inngest";
import { ROLE_STUDENT, ROLE_INSTRUCTOR } from "./avatar-roles";
import { db } from "@/db";
import { courses, slides } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { generateTTS } from "./openai";
import { searchPhoto } from "./pexels";
import { imagekit } from "./imagekit";
import { submitDialogueVideo, submitSingleVideo, checkDialogueVideoStatus } from "./heygen";

// Returns the voice ID for a slot based on the avatar assigned to it, not the slot position.
function getVoiceIdForSlot(slots: { slotIndex: number; avatarId: string }[], slotIdx: number): string | undefined {
  const avatarId = slots.find((s) => s.slotIndex === slotIdx)?.avatarId || "";
  const instructorAvatarId = process.env.HEYGEN_INSTRUCTOR_AVATAR_ID || "";
  const studentAvatarId = process.env.HEYGEN_STUDENT_AVATAR_ID || "";
  if (avatarId && avatarId === instructorAvatarId) return process.env.HEYGEN_INSTRUCTOR_VOICE_ID;
  if (avatarId && avatarId === studentAvatarId) return process.env.HEYGEN_STUDENT_VOICE_ID;
  // Fallback to slot-position defaults if avatar ID is unknown
  return slotIdx === 0 ? process.env.HEYGEN_INSTRUCTOR_VOICE_ID : process.env.HEYGEN_STUDENT_VOICE_ID;
}

// Splits dialogue lines between slot 0 (instructor) and slot 1 (student).
// Priority: explicit slotIndex field → "instructor"/"student" character string → first two unique character names in order.
function splitDialogueLinesBySlot(allLines: any[]): { slot0: any[]; slot1: any[] } {
  if (allLines.some((l) => l.slotIndex !== undefined)) {
    return {
      slot0: allLines
        .filter((l) => (l.slotIndex !== undefined ? l.slotIndex === 0 : l.character !== "student"))
        .map((l) => ({ ...l, slotIndex: 0 })),
      slot1: allLines
        .filter((l) => (l.slotIndex !== undefined ? l.slotIndex === 1 : l.character === "student"))
        .map((l) => ({ ...l, slotIndex: 1 })),
    };
  }

  // AI-generated lines have free-form character names (e.g. "Supervisor / Worker A").
  // Detect the first two unique names; second unique name becomes slot 1.
  const chars: string[] = [];
  for (const l of allLines) {
    const c = (l.character ?? "").trim();
    if (c && !chars.includes(c)) {
      chars.push(c);
      if (chars.length === 2) break;
    }
  }
  if (chars.length < 2) return { slot0: allLines.map((l) => ({ ...l, slotIndex: 0 })), slot1: [] };
  return {
    slot0: allLines.filter((l) => l.character !== chars[1]).map((l) => ({ ...l, slotIndex: 0 })),
    slot1: allLines.filter((l) => l.character === chars[1]).map((l) => ({ ...l, slotIndex: 1 })),
  };
}

async function checkAndFinalizeCourse(courseId: string) {
  await db
    .update(courses)
    .set({
      generationStatus: "ready",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(courses.id, courseId),
        sql`NOT EXISTS (
          SELECT 1 FROM ${slides}
          WHERE ${slides.courseId} = ${courseId}
            AND ${slides.language} = 'en'
            AND ${slides.assetStatus} IN ('generating', 'pending')
        )`
      )
    );
}

export const generateSlideAssets = inngest.createFunction(
  {
    id: "generate-slide-assets",
    name: "Generate Slide Assets",
    triggers: [{ event: "course/generate.assets" }],
    retries: 1,
  },
  async ({ event, step }) => {
    const { courseId } = event.data;

    // Gate: exit immediately if the course is no longer actively generating.
    // This aborts stuck retries without making any external API calls.
    const shouldRun = await step.run("guard-course-active", async () => {
      const [course] = await db
        .select({ generationStatus: courses.generationStatus })
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);
      return course?.generationStatus === "generating";
    });

    if (!shouldRun) return { success: true, aborted: true };

    // 1. Fetch course slides
    const courseSlides = await step.run("fetch-slides", async () => {
      return await db
        .select()
        .from(slides)
        .where(
          and(
            eq(slides.courseId, courseId),
            eq(slides.language, "en")
          )
        );
    });

    const targetSlides = courseSlides.filter((slide) => {
      if (slide.type === "audio" || slide.type === "dialogue" || slide.type === "video") return true;
      if (slide.type === "text" && (slide.content as any)?.visualKeywords) return true;
      return false;
    });

    if (targetSlides.length === 0) {
      await step.run("finalize-course-status-empty", async () => {
        await db
          .update(courses)
          .set({
            generationStatus: "ready",
            updatedAt: new Date(),
          })
          .where(eq(courses.id, courseId));
      });
      return { success: true, count: 0 };
    }

    // 2. Set all target slides to 'generating' status
    await step.run("update-slides-generating", async () => {
      for (const slide of targetSlides) {
        await db
          .update(slides)
          .set({
            assetStatus: "generating",
            updatedAt: new Date(),
          })
          .where(eq(slides.id, slide.id));
      }
    });

    // 3. Process each slide asset
    await Promise.all(
      targetSlides.map((slide) => {
        const content = (slide.content || {}) as Record<string, any>;
        if (slide.type === "video") {
          return (async () => {
            try {
              const [current] = await db.select().from(slides).where(eq(slides.id, slide.id)).limit(1);
              if (current?.assetStatus === "ready" || current?.assetStatus === "generating") return;

              if (!content.speechText?.trim()) throw new Error(`Empty speechText for video slide ${slide.id}`);
              const role = content.avatarId === ROLE_STUDENT ? ROLE_STUDENT : ROLE_INSTRUCTOR;
              const avatarId = role === ROLE_STUDENT
                ? (process.env.HEYGEN_STUDENT_AVATAR_ID ?? "")
                : (process.env.HEYGEN_INSTRUCTOR_AVATAR_ID ?? "");
              const voiceId = role === ROLE_STUDENT
                ? (process.env.HEYGEN_STUDENT_VOICE_ID ?? "")
                : (process.env.HEYGEN_INSTRUCTOR_VOICE_ID ?? "");
              if (!avatarId || !voiceId) throw new Error(`HeyGen not configured for role: ${role}`);

              const jobId = await step.run(`submit-heygen-video-${slide.id}`, async () => {
                const id = await submitSingleVideo({ avatarId, voiceId, text: content.speechText.trim() });
                await db.update(slides).set({
                  content: sql`content || ${JSON.stringify({ heygenJobId: id })}::jsonb`,
                  assetStatus: "generating",
                  updatedAt: new Date(),
                }).where(eq(slides.id, slide.id));
                return id;
              });

              await step.sendEvent(`trigger-poll-heygen-video-${slide.id}`, {
                name: "heygen/poll.status",
                data: { jobId, slideId: slide.id, courseId, attempts: 1 },
              });

            } catch (err: any) {
              console.error(`Video asset generation failed for slide ${slide.id}:`, err);
              await step.run(`mark-failed-video-${slide.id}`, async () => {
                await db.update(slides).set({ assetStatus: "failed", updatedAt: new Date() }).where(eq(slides.id, slide.id));
              });
            }
          })();
        } else if (slide.type === "dialogue") {
          return (async () => {
            try {
              const [current] = await db.select().from(slides).where(eq(slides.id, slide.id)).limit(1);
              if (current?.assetStatus === "ready") return;

              const lines = content.dialogueLines || [];
              if (!Array.isArray(lines) || lines.length === 0) {
                throw new Error(`Empty dialogue lines for slide ${slide.id}`);
              }
              const slots = content.slots || [
                { slotIndex: 0, avatarId: content.heygenAvatarAId || "" },
                { slotIndex: 1, avatarId: content.heygenAvatarBId || "" },
              ];
              const slot0VoiceId = getVoiceIdForSlot(slots, 0);
              const slot1VoiceId = getVoiceIdForSlot(slots, 1);
              const { slot0: slot0Lines, slot1: slot1Lines } = splitDialogueLinesBySlot(lines);

              console.log(`[dialogue init] slide=${slide.id} slot0=${slot0Lines.length} slot1=${slot1Lines.length}`);

              const initStartTs = Date.now();

              if (slot0Lines.length > 0) {
                const instJobId = await step.run(`submit-heygen-instructor-${slide.id}`, async () => {
                  const jobId = await submitDialogueVideo(slot0Lines, slots, { 0: slot0VoiceId });
                  await db.update(slides).set({
                    content: sql`content || ${JSON.stringify({ heygenInstructorJobId: jobId })}::jsonb`,
                    updatedAt: new Date(),
                  }).where(eq(slides.id, slide.id));
                  return jobId;
                });
                await step.sendEvent(`trigger-poll-heygen-instructor-${slide.id}`, {
                  name: "heygen/poll.status",
                  data: { jobId: instJobId, slideId: slide.id, courseId, attempts: 1, role: "instructor", submittedAt: initStartTs },
                });
              }

              if (slot1Lines.length > 0) {
                const studJobId = await step.run(`submit-heygen-student-${slide.id}`, async () => {
                  const jobId = await submitDialogueVideo(slot1Lines, slots, { 1: slot1VoiceId });
                  await db.update(slides).set({
                    content: sql`content || ${JSON.stringify({ heygenStudentJobId: jobId })}::jsonb`,
                    updatedAt: new Date(),
                  }).where(eq(slides.id, slide.id));
                  return jobId;
                });
                await step.sendEvent(`trigger-poll-heygen-student-${slide.id}`, {
                  name: "heygen/poll.status",
                  data: { jobId: studJobId, slideId: slide.id, courseId, attempts: 1, role: "student", submittedAt: initStartTs },
                });
              }

            } catch (err: any) {
              console.error(`Asset generation failed for slide ${slide.id}:`, err);
              await step.run(`mark-failed-${slide.id}`, async () => {
                await db
                  .update(slides)
                  .set({ assetStatus: "failed", updatedAt: new Date() })
                  .where(eq(slides.id, slide.id));
              });
            }
          })();
        } else {
          return step.run(`process-asset-${slide.id}`, async () => {
            try {
              const [current] = await db.select().from(slides).where(eq(slides.id, slide.id)).limit(1);
              if (current?.assetStatus === "ready") return (current.content as any)?.url ?? null;

              if (slide.type === "audio") {
                const script = content.audioScript || content.text || content.body || "";
                if (!script.trim()) throw new Error(`Empty audio script for slide ${slide.id}`);
                const buffer = await generateTTS(script);
                const uploadRes = await imagekit.upload({
                  file: buffer,
                  fileName: `audio_${slide.id}.mp3`,
                  folder: `/courses/${courseId}/audio`,
                });
                await db
                  .update(slides)
                  .set({ content: { ...content, url: uploadRes.url }, assetStatus: "ready", updatedAt: new Date() })
                  .where(eq(slides.id, slide.id));
                return uploadRes.url;
              }

              if (slide.type === "text" && content.visualKeywords) {
                const imageUrl = await searchPhoto(content.visualKeywords);
                await db
                  .update(slides)
                  .set({ content: { ...content, imageUrl }, assetStatus: "ready", updatedAt: new Date() })
                  .where(eq(slides.id, slide.id));
                return imageUrl;
              }


            } catch (err) {
              console.error(`Asset generation failed for slide ${slide.id}:`, err);
              await db
                .update(slides)
                .set({ assetStatus: "failed", updatedAt: new Date() })
                .where(eq(slides.id, slide.id));
            }
          });
        }
      })
    );

    // 4. Finalize course status (only if all slides are finished generating)
    await step.run("finalize-course-status", async () => {
      await checkAndFinalizeCourse(courseId);
    });

    return { success: true };
  }
);

export const regenerateSingleSlideAsset = inngest.createFunction(
  {
    id: "regenerate-single-slide-asset",
    name: "Regenerate Single Slide Asset",
    triggers: [{ event: "slide/regenerate" }],
    retries: 1,
  },
  async ({ event, step }) => {
    const { slideId, assetType } = event.data;

    // 1. Fetch slide
    const slide = await step.run("fetch-slide", async () => {
      const [s] = await db
        .select()
        .from(slides)
        .where(eq(slides.id, slideId))
        .limit(1);
      return s;
    });

    if (!slide) {
      // Slide was deleted between the route call and Inngest execution — nothing to mark failed
      console.warn(`[regenerate] Slide ${slideId} not found in DB, skipping`);
      return { success: false, reason: "slide_not_found" };
    }

    // Gate: exit if the slide is already done (e.g. a prior attempt succeeded before the retry fired)
    if (slide.assetStatus === "ready") return { success: true, aborted: true };

    const content = (slide.content || {}) as Record<string, any>;

    // 2. Generate the asset
    if (assetType === "video" && slide.type === "dialogue") {
      try {
        const allLines: { slotIndex?: number; character?: string; text: string }[] = content.dialogueLines || [];
        if (!Array.isArray(allLines) || allLines.length === 0) {
          throw new Error("Empty dialogue lines for regeneration");
        }

        const slots = content.slots || [
          { slotIndex: 0, avatarId: content.heygenAvatarAId || "" },
          { slotIndex: 1, avatarId: content.heygenAvatarBId || "" }
        ];

        const slot0VoiceId = getVoiceIdForSlot(slots, 0);
        const slot1VoiceId = getVoiceIdForSlot(slots, 1);

        const { slot0: slot0Lines, slot1: slot1Lines } = splitDialogueLinesBySlot(allLines);

        console.log(`[dialogue regen] slot 0 lines: ${slot0Lines.length}, slot 1 lines: ${slot1Lines.length}`);

        const regenStartTs = Date.now();

        if (slot0Lines.length > 0) {
          const instJobId = await step.run(`submit-heygen-instructor-${slide.id}`, async () => {
            const t0 = Date.now();
            console.log(`[dialogue regen] Submitting instructor job (${slot0Lines.length} lines) at ${new Date().toISOString()}`);
            const jobId = await submitDialogueVideo(slot0Lines, slots, { 0: slot0VoiceId });
            console.log(`[dialogue regen] Instructor jobId=${jobId} submitted in ${Date.now() - t0}ms`);
            await db.update(slides).set({
              content: sql`content || ${JSON.stringify({ heygenInstructorJobId: jobId })}::jsonb`,
              updatedAt: new Date(),
            }).where(eq(slides.id, slide.id));
            return jobId;
          });
          await step.sendEvent(`trigger-poll-instructor-${slide.id}`, {
            name: "heygen/poll.status",
            data: { jobId: instJobId, slideId: slide.id, courseId: slide.courseId, attempts: 1, role: "instructor", submittedAt: regenStartTs },
          });
        }

        if (slot1Lines.length > 0) {
          const studJobId = await step.run(`submit-heygen-student-${slide.id}`, async () => {
            const t0 = Date.now();
            console.log(`[dialogue regen] Submitting student job (${slot1Lines.length} lines) at ${new Date().toISOString()}`);
            const jobId = await submitDialogueVideo(slot1Lines, slots, { 1: slot1VoiceId });
            console.log(`[dialogue regen] Student jobId=${jobId} submitted in ${Date.now() - t0}ms`);
            await db.update(slides).set({
              content: sql`content || ${JSON.stringify({ heygenStudentJobId: jobId })}::jsonb`,
              updatedAt: new Date(),
            }).where(eq(slides.id, slide.id));
            return jobId;
          });
          await step.sendEvent(`trigger-poll-student-${slide.id}`, {
            name: "heygen/poll.status",
            data: { jobId: studJobId, slideId: slide.id, courseId: slide.courseId, attempts: 1, role: "student", submittedAt: regenStartTs },
          });
        }

      } catch (error: any) {
        console.error(`[dialogue regen] Failed for slide ${slideId}:`, error.message);
        await step.run(`mark-failed-${slideId}`, async () => {
          await db.update(slides).set({ assetStatus: "failed", updatedAt: new Date() }).where(eq(slides.id, slideId));
        });
        throw error;
      }
    } else if (assetType === "video") {
      try {
        // 1. Submit HeyGen video generation request
        const videoId = await step.run(`submit-heygen-video-${slide.id}`, async () => {
          if (!content.speechText?.trim()) {
            throw new Error("No speech text to generate video from");
          }
          const role = content.avatarId === ROLE_STUDENT ? ROLE_STUDENT : ROLE_INSTRUCTOR;
          const avatarId = role === ROLE_STUDENT
            ? (process.env.HEYGEN_STUDENT_AVATAR_ID ?? "")
            : (process.env.HEYGEN_INSTRUCTOR_AVATAR_ID ?? "");
          const voiceId = role === ROLE_STUDENT
            ? (process.env.HEYGEN_STUDENT_VOICE_ID ?? "")
            : (process.env.HEYGEN_INSTRUCTOR_VOICE_ID ?? "");

          if (!avatarId || !voiceId) {
            throw new Error(`HeyGen avatar or voice not configured for role: ${role}`);
          }

          const params = { avatarId, voiceId, text: content.speechText.trim() };
          console.log("[submitSingleVideo] params:", JSON.stringify(params, null, 2));

          const jobId = await submitSingleVideo(params);

          // Save heygenJobId to database content to ensure only the latest job can modify the slide
          await db
            .update(slides)
            .set({
              content: sql`content || ${JSON.stringify({ heygenJobId: jobId })}::jsonb`,
              updatedAt: new Date(),
            })
            .where(eq(slides.id, slide.id));

          return jobId;
        });

        // 2. Trigger background polling event
        await step.sendEvent(`trigger-poll-heygen-${slide.id}`, {
          name: "heygen/poll.status",
          data: {
            jobId: videoId,
            slideId: slide.id,
            courseId: slide.courseId,
            attempts: 1,
          },
        });

      } catch (error: any) {
        console.error(`Single asset regeneration failed for slide ${slideId}:`, error);
        await step.run(`mark-failed-${slideId}`, async () => {
          await db
            .update(slides)
            .set({
              assetStatus: "failed",
              updatedAt: new Date(),
            })
            .where(eq(slides.id, slideId));
        });
        throw error;
      }
    } else {
      await step.run("process-single-asset", async () => {
        try {
          if (assetType === "audio") {
            const script = content.audioScript || content.text || content.body || "";
            if (!script.trim()) {
              throw new Error("Empty audio script");
            }
            const buffer = await generateTTS(script);
            const uploadRes = await imagekit.upload({
              file: buffer,
              fileName: `audio_${slide.id}.mp3`,
              folder: `/courses/${slide.courseId}/audio`,
            });
            await db
              .update(slides)
              .set({
                content: {
                  ...content,
                  url: uploadRes.url,
                },
                assetStatus: "ready",
                updatedAt: new Date(),
              })
              .where(eq(slides.id, slideId));
          }
        } catch (error: any) {
          console.error(`Single asset regeneration failed for slide ${slideId}:`, error);
          await db
            .update(slides)
            .set({
              assetStatus: "failed",
              updatedAt: new Date(),
            })
            .where(eq(slides.id, slideId));
          throw error;
        }
      });
    }

    // 3. Finalize course status
    await step.run("finalize-course-status", async () => {
      await checkAndFinalizeCourse(slide.courseId);
    });

    return { success: true };
  }
);

export const pollHeygenJobStatus = inngest.createFunction(
  {
    id: "poll-heygen-job-status",
    name: "Poll HeyGen Job Status",
    triggers: [{ event: "heygen/poll.status" }],
    retries: 1,
  },
  async ({ event, step }) => {
    const { jobId, slideId, courseId, attempts, role, submittedAt } = event.data;
    // role: "instructor" | "student" | undefined (legacy single-video path)

    const elapsedSec = submittedAt ? Math.round((Date.now() - submittedAt) / 1000) : null;
    const elapsedStr = elapsedSec !== null ? ` elapsed=${elapsedSec}s` : "";
    console.log(`[HeyGen Poll] slide=${slideId} job=${jobId} role=${role ?? "legacy"} attempt=${attempts}${elapsedStr}`);

    // 1. Idempotency: for role-based polls check if this role's URL already exists
    const isDone = await step.run("check-slide-status-gate", async () => {
      const [slide] = await db
        .select({ assetStatus: slides.assetStatus, content: slides.content })
        .from(slides)
        .where(eq(slides.id, slideId))
        .limit(1);
      if (!slide) return true;
      if (slide.assetStatus === "failed") return true;
      if (!role) return slide.assetStatus === "ready";
      const c = (slide.content || {}) as Record<string, any>;
      return role === "instructor" ? !!c.instructorVideoUrl : !!c.studentVideoUrl;
    });

    if (isDone) {
      console.log(`[HeyGen Poll] Already done for slide ${slideId} role=${role ?? "legacy"}. Aborting.`);
      return { success: true, aborted: true };
    }

    // 2. Validate this jobId is still the latest for this role
    const isLatest = await step.run("verify-latest-job", async () => {
      const [slide] = await db
        .select({ content: slides.content })
        .from(slides)
        .where(eq(slides.id, slideId))
        .limit(1);
      const c = (slide?.content || {}) as Record<string, any>;
      if (role === "instructor") return c.heygenInstructorJobId === jobId;
      if (role === "student")    return c.heygenStudentJobId    === jobId;
      return c.heygenJobId === jobId;
    });

    if (!isLatest) {
      console.log(`[HeyGen Poll] Job ${jobId} is outdated for slide ${slideId} role=${role}. Aborting.`);
      return { success: true, outdated: true };
    }

    // 3. Query HeyGen status
    const check = await step.run("check-status", async () => {
      return await checkDialogueVideoStatus(jobId);
    });

    const elapsedAfterCheck = submittedAt ? Math.round((Date.now() - submittedAt) / 1000) : null;
    const elapsedAfterCheckStr = elapsedAfterCheck !== null ? ` total_elapsed=${elapsedAfterCheck}s` : "";
    console.log(`[HeyGen Poll] job=${jobId} status=${check.status}${elapsedAfterCheckStr}`);

    if (check.status === "completed") {
      const videoUrl = check.videoUrl || "";
      if (!videoUrl) throw new Error("HeyGen completed, but no video URL returned");

      const totalSec = submittedAt ? Math.round((Date.now() - submittedAt) / 1000) : null;
      console.log(`[HeyGen Poll] ✅ job=${jobId} role=${role ?? "legacy"} COMPLETED after ${totalSec !== null ? `${totalSec}s` : "unknown time"}. Starting ImageKit upload.`);

      // Upload to ImageKit and save to the correct content field
      await step.run("upload-to-imagekit", async () => {
        const [slide] = await db
          .select({ content: slides.content })
          .from(slides)
          .where(eq(slides.id, slideId))
          .limit(1);

        const currentContent = (slide?.content || {}) as Record<string, any>;

        const fileName = role
          ? `dialogue_${role}_${slideId}.mp4`
          : `dialogue_${slideId}.mp4`;

        const uploadStart = Date.now();
        const uploadRes = await imagekit.upload({
          file: videoUrl,
          fileName,
          folder: `/courses/${courseId}/video`,
        });
        console.log(`[HeyGen Poll] ImageKit upload for role=${role ?? "legacy"} took ${Date.now() - uploadStart}ms → ${uploadRes.url}`);

        let updatedContent: Record<string, any>;
        let newStatus: "ready" | "generating";

        if (role === "instructor") {
          const currentSlots: any[] = Array.isArray(currentContent.slots) && currentContent.slots.length >= 2
            ? currentContent.slots
            : [
                { slotIndex: 0, avatarId: currentContent.heygenAvatarAId || "" },
                { slotIndex: 1, avatarId: currentContent.heygenAvatarBId || "" },
              ];
          const updatedSlots = currentSlots.map((s: any) =>
            s.slotIndex === 0 ? { ...s, videoUrl: uploadRes.url } : s
          );
          updatedContent = { ...currentContent, instructorVideoUrl: uploadRes.url, slots: updatedSlots };
          // ready when student URL exists OR no student job was ever submitted (no student lines)
          const studDone = !!currentContent.studentVideoUrl || !currentContent.heygenStudentJobId;
          newStatus = studDone ? "ready" : "generating";
        } else if (role === "student") {
          const currentSlots: any[] = Array.isArray(currentContent.slots) && currentContent.slots.length >= 2
            ? currentContent.slots
            : [
                { slotIndex: 0, avatarId: currentContent.heygenAvatarAId || "" },
                { slotIndex: 1, avatarId: currentContent.heygenAvatarBId || "" },
              ];
          const updatedSlots = currentSlots.map((s: any) =>
            s.slotIndex === 1 ? { ...s, videoUrl: uploadRes.url } : s
          );
          updatedContent = { ...currentContent, studentVideoUrl: uploadRes.url, slots: updatedSlots };
          // ready when instructor URL exists OR no instructor job was ever submitted (no instructor lines)
          const instDone = !!currentContent.instructorVideoUrl || !currentContent.heygenInstructorJobId;
          newStatus = instDone ? "ready" : "generating";
        } else {
          // legacy path: single combined video
          updatedContent = { ...currentContent, assetUrl: uploadRes.url, url: uploadRes.url };
          newStatus = "ready";
        }

        await db
          .update(slides)
          .set({ content: updatedContent, assetStatus: newStatus, updatedAt: new Date() })
          .where(eq(slides.id, slideId));

        console.log(`[HeyGen Poll] Saved ${role ?? "legacy"} URL. New assetStatus: ${newStatus}`);
      });

      // Check and finalize course status
      await step.run("finalize-course", async () => {
        await checkAndFinalizeCourse(courseId);
      });

      return { success: true, status: "completed" };
    }

    if (check.status === "failed") {
      console.error(`[HeyGen Poll] Job ${jobId} failed. Error: ${check.error || "unknown"}`);
      await step.run("mark-failed", async () => {
        await db
          .update(slides)
          .set({
            assetStatus: "failed",
            updatedAt: new Date(),
          })
          .where(eq(slides.id, slideId));

        await checkAndFinalizeCourse(courseId);
      });

      throw new Error(`HeyGen video generation failed: ${check.error || "unknown error"}`);
    }

    // If still pending/processing
    if (attempts >= 20) { // Max 10 minutes (20 * 30 seconds)
      console.error(`[HeyGen Poll] Job ${jobId} timed out after 10 minutes.`);
      await step.run("mark-failed-timeout", async () => {
        await db
          .update(slides)
          .set({
            assetStatus: "failed",
            updatedAt: new Date(),
          })
          .where(eq(slides.id, slideId));

        await checkAndFinalizeCourse(courseId);
      });

      throw new Error("HeyGen video generation timed out after 10 minutes.");
    }

    console.log(`[HeyGen Poll] Job ${jobId} is still processing. Sleeping for 30s before attempt ${attempts + 1}...`);
    // Wait 30 seconds
    await step.sleep("wait-30s", "30s");

    // Send next poll event (preserve role and submittedAt for timing chain)
    await step.sendEvent("trigger-next-poll", {
      name: "heygen/poll.status",
      data: {
        jobId,
        slideId,
        courseId,
        attempts: attempts + 1,
        ...(role ? { role } : {}),
        ...(submittedAt ? { submittedAt } : {}),
      },
    });

    return { success: true, status: check.status, nextAttempt: attempts + 1 };
  }
);
