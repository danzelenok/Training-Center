import { inngest } from "./inngest";
import { db } from "@/db";
import { courses, slides } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { generateTTS } from "./openai";
import { searchPhoto } from "./pexels";
import { imagekit } from "./imagekit";
import { submitDialogueVideo, checkDialogueVideoStatus } from "./heygen";

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
            AND ${slides.type} IN ('audio', 'image', 'dialogue', 'video')
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

    const targetSlides = courseSlides.filter(
      (slide) => slide.type === "audio" || slide.type === "image" || slide.type === "dialogue"
    );

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
        if (slide.type === "dialogue") {
          return (async () => {
            try {
              const [current] = await db.select().from(slides).where(eq(slides.id, slide.id)).limit(1);
              if (current?.assetStatus === "ready") return;

              // 1. Submit HeyGen video generation request
              const videoId = await step.run(`submit-heygen-video-${slide.id}`, async () => {
                const lines = content.dialogueLines || [];
                if (!Array.isArray(lines) || lines.length === 0) {
                  throw new Error(`Empty dialogue lines for slide ${slide.id}`);
                }
                const jobId = await submitDialogueVideo(lines);

                // Save heygenJobId to database content to ensure only the latest job can modify the slide
                const [slideData] = await db.select().from(slides).where(eq(slides.id, slide.id)).limit(1);
                const currentContent = (slideData?.content || {}) as Record<string, any>;
                await db
                  .update(slides)
                  .set({
                    content: {
                      ...currentContent,
                      heygenJobId: jobId,
                    },
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
                  courseId: courseId,
                  attempts: 1,
                },
              });

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

              } else if (slide.type === "image") {
                const keywords = content.visualKeywords || content.heading || content.title || "";
                if (!keywords.trim()) throw new Error(`Empty visual keywords for slide ${slide.id}`);
                const url = await searchPhoto(keywords);
                await db
                  .update(slides)
                  .set({ content: { ...content, url }, assetStatus: "ready", updatedAt: new Date() })
                  .where(eq(slides.id, slide.id));
                return url;
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
      throw new Error(`Slide ${slideId} not found`);
    }

    // Gate: exit if the slide is already done (e.g. a prior attempt succeeded before the retry fired)
    if (slide.assetStatus === "ready") return { success: true, aborted: true };

    const content = (slide.content || {}) as Record<string, any>;

    // 2. Generate the asset
    if (assetType === "video") {
      try {
        // 1. Submit HeyGen video generation request
        const videoId = await step.run(`submit-heygen-video-${slide.id}`, async () => {
          // Dialogue slide: use dialogueLines; single-avatar video slide: use speechText as one line
          let lines: { character: "instructor" | "student"; text: string }[];
          if (content.dialogueLines && Array.isArray(content.dialogueLines) && content.dialogueLines.length > 0) {
            lines = content.dialogueLines;
          } else if (content.speechText?.trim()) {
            const character = content.avatarId === "james" ? "student" : "instructor";
            lines = [{ character, text: content.speechText.trim() }];
          } else {
            throw new Error("No dialogue lines or speech text to generate video from");
          }
          if (lines.length === 0) {
            throw new Error("Empty dialogue lines");
          }
          const jobId = await submitDialogueVideo(lines);

          // Save heygenJobId to database content to ensure only the latest job can modify the slide
          const [slideData] = await db.select().from(slides).where(eq(slides.id, slide.id)).limit(1);
          const currentContent = (slideData?.content || {}) as Record<string, any>;
          await db
            .update(slides)
            .set({
              content: {
                ...currentContent,
                heygenJobId: jobId,
              },
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

          } else if (assetType === "image") {
            const keywords = content.visualKeywords || content.heading || content.title || "";
            if (!keywords.trim()) {
              throw new Error("Empty visual keywords");
            }
            const url = await searchPhoto(keywords);
            await db
              .update(slides)
              .set({
                content: {
                  ...content,
                  url: url,
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
    const { jobId, slideId, courseId, attempts } = event.data;

    console.log(`[HeyGen Poll] Starting status check for slide ${slideId}, job ${jobId}. Attempt: ${attempts}`);

    // 1. Idempotency check: if slide is already ready or failed, do nothing.
    const isDone = await step.run("check-slide-status-gate", async () => {
      const [slide] = await db
        .select({ assetStatus: slides.assetStatus })
        .from(slides)
        .where(eq(slides.id, slideId))
        .limit(1);
      return slide?.assetStatus === "ready" || slide?.assetStatus === "failed";
    });

    if (isDone) {
      console.log(`[HeyGen Poll] Slide ${slideId} is already in a terminal state (ready/failed). Aborting execution.`);
      return { success: true, aborted: true };
    }

    // 2. Latest job validation: check if this jobId matches the latest submitted heygenJobId
    const isLatest = await step.run("verify-latest-job", async () => {
      const [slide] = await db
        .select({ content: slides.content })
        .from(slides)
        .where(eq(slides.id, slideId))
        .limit(1);
      const currentContent = (slide?.content || {}) as Record<string, any>;
      return currentContent.heygenJobId === jobId;
    });

    if (!isLatest) {
      console.log(`[HeyGen Poll] Job ID ${jobId} is outdated for slide ${slideId}. Aborting.`);
      return { success: true, outdated: true };
    }

    // 3. Query HeyGen status
    console.log(`[HeyGen Poll] Querying HeyGen API for job ${jobId}...`);
    const check = await step.run("check-status", async () => {
      return await checkDialogueVideoStatus(jobId);
    });

    console.log(`[HeyGen Poll] HeyGen API status for job ${jobId}: ${check.status}`);

    if (check.status === "completed") {
      const videoUrl = check.videoUrl || "";
      if (!videoUrl) {
        throw new Error("HeyGen completed, but no video URL returned");
      }

      console.log(`[HeyGen Poll] Job ${jobId} completed successfully. Video URL: ${videoUrl}`);

      // Upload to ImageKit
      await step.run("upload-to-imagekit", async () => {
        // Fetch current content first to preserve it
        const [slide] = await db
          .select({ content: slides.content })
          .from(slides)
          .where(eq(slides.id, slideId))
          .limit(1);

        const currentContent = (slide?.content || {}) as Record<string, any>;

        const uploadRes = await imagekit.upload({
          file: videoUrl,
          fileName: `dialogue_${slideId}.mp4`,
          folder: `/courses/${courseId}/video`,
        });

        await db
          .update(slides)
          .set({
            content: {
              ...currentContent,
              assetUrl: uploadRes.url,
              url: uploadRes.url,
            },
            assetStatus: "ready",
            updatedAt: new Date(),
          })
          .where(eq(slides.id, slideId));
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

    // Send next poll event
    await step.sendEvent("trigger-next-poll", {
      name: "heygen/poll.status",
      data: {
        jobId,
        slideId,
        courseId,
        attempts: attempts + 1,
      },
    });

    return { success: true, status: check.status, nextAttempt: attempts + 1 };
  }
);
