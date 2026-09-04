import { db } from '../db/index';
import { slides, courses, mediaFiles } from '../db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { generateTTS } from '../lib/openai';
import { searchPhoto } from '../lib/pexels';
import { uploadToR2 } from '../lib/r2';
import { submitDialogueVideo, submitSingleVideo, checkDialogueVideoStatus } from '../lib/heygen';
import { ROLE_STUDENT } from '../lib/avatar-roles';

const COURSE_ID = '6aef5e8e-44a0-4c3d-9d63-6805cc5d6aa0'; // Extension Cords & Temp Power (WA)

async function pollUntilDone(jobId: string, label: string): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < 10 * 60 * 1000) {
    const check = await checkDialogueVideoStatus(jobId);
    console.log(`[poll ${label}] job=${jobId} status=${check.status} elapsed=${Math.round((Date.now() - start) / 1000)}s`);
    if (check.status === 'completed') {
      if (!check.videoUrl) throw new Error(`${label}: completed but no videoUrl`);
      return check.videoUrl;
    }
    if (check.status === 'failed') throw new Error(`${label}: HeyGen failed - ${check.error}`);
    await new Promise((r) => setTimeout(r, 10000));
  }
  throw new Error(`${label}: timed out after 10 minutes`);
}

async function main() {
  const [course] = await db.select().from(courses).where(eq(courses.id, COURSE_ID)).limit(1);
  if (!course) throw new Error('Course not found');
  const orgId = course.organizationId;

  await db.update(courses).set({ generationStatus: 'generating', updatedAt: new Date() }).where(eq(courses.id, COURSE_ID));

  const pending = await db
    .select()
    .from(slides)
    .where(and(eq(slides.courseId, COURSE_ID), eq(slides.language, 'en'), inArray(slides.assetStatus, ['pending', 'generating', 'failed'])))
    .orderBy(slides.order);

  console.log(`Found ${pending.length} slides still needing regeneration:`, pending.map((s) => `${s.order}:${s.type}`).join(', '));

  for (const slide of pending) {
    const content = (slide.content || {}) as Record<string, any>;
    try {
      if (slide.type === 'audio') {
        console.log(`[slide ${slide.order}] audio: generating TTS...`);
        const script = content.audioScript || content.text || content.body || '';
        const buffer = await generateTTS(script);
        const fileName = `audio_${slide.id}.mp3`;
        const r2Key = `courses/${COURSE_ID}/audio/${fileName}`;
        const publicUrl = await uploadToR2(buffer, r2Key, 'audio/mpeg');
        await db.insert(mediaFiles).values({ organizationId: orgId, r2Key, url: publicUrl, fileName, fileType: 'audio', mimeType: 'audio/mpeg', courseId: COURSE_ID });
        await db.update(slides).set({ content: { ...content, url: publicUrl }, assetStatus: 'ready', updatedAt: new Date() }).where(eq(slides.id, slide.id));
        console.log(`[slide ${slide.order}] audio: done -> ${publicUrl}`);

      } else if ((slide.type === 'text' || slide.type === 'chat') && content.visualKeywords) {
        console.log(`[slide ${slide.order}] photo: searching Pexels for "${content.visualKeywords}"...`);
        const imageUrl = await searchPhoto(content.visualKeywords);
        await db.update(slides).set({ content: { ...content, imageUrl }, assetStatus: 'ready', updatedAt: new Date() }).where(eq(slides.id, slide.id));
        console.log(`[slide ${slide.order}] photo: done -> ${imageUrl}`);

      } else if (slide.type === 'video') {
        console.log(`[slide ${slide.order}] video: resuming/submitting HeyGen job...`);
        let jobId: string = content.heygenJobId;
        if (jobId) {
          const check = await checkDialogueVideoStatus(jobId);
          console.log(`[slide ${slide.order}] video: existing job=${jobId} status=${check.status}`);
          if (check.status === 'failed') jobId = '';
        }
        if (!jobId) {
          const role = content.avatarId === ROLE_STUDENT ? ROLE_STUDENT : 'instructor';
          const avatarId = role === ROLE_STUDENT ? process.env.HEYGEN_STUDENT_AVATAR_ID! : process.env.HEYGEN_INSTRUCTOR_AVATAR_ID!;
          const voiceId = role === ROLE_STUDENT ? process.env.HEYGEN_STUDENT_VOICE_ID! : process.env.HEYGEN_INSTRUCTOR_VOICE_ID!;
          jobId = await submitSingleVideo({ avatarId, voiceId, text: content.speechText.trim() });
          await db.update(slides).set({ content: sql`content || ${JSON.stringify({ heygenJobId: jobId })}::jsonb`, updatedAt: new Date() }).where(eq(slides.id, slide.id));
        }
        const heygenVideoUrl = await pollUntilDone(jobId, `slide ${slide.order} video`);
        const fileName = `video_${slide.id}_${jobId}.mp4`;
        const r2Key = `courses/${COURSE_ID}/video/${fileName}`;
        const publicUrl = await uploadToR2(heygenVideoUrl, r2Key, 'video/mp4');
        await db.insert(mediaFiles).values({ organizationId: orgId, r2Key, url: publicUrl, fileName, fileType: 'video', mimeType: 'video/mp4', courseId: COURSE_ID });
        const [fresh] = await db.select({ content: slides.content }).from(slides).where(eq(slides.id, slide.id)).limit(1);
        const freshContent = (fresh?.content || {}) as Record<string, any>;
        await db.update(slides).set({ content: { ...freshContent, url: publicUrl, assetUrl: publicUrl }, assetStatus: 'ready', updatedAt: new Date() }).where(eq(slides.id, slide.id));
        console.log(`[slide ${slide.order}] video: done -> ${publicUrl}`);

      } else if (slide.type === 'dialogue') {
        console.log(`[slide ${slide.order}] dialogue: processing...`);
        const lines: { character?: string; text: string }[] = content.dialogueLines || [];
        const chars: string[] = [];
        for (const l of lines) {
          const c = (l.character ?? '').trim();
          if (c && !chars.includes(c)) { chars.push(c); if (chars.length === 2) break; }
        }
        const slot0Lines = lines.filter((l) => l.character !== chars[1]).map((l) => ({ ...l, slotIndex: 0 }));
        const slot1Lines = chars.length >= 2 ? lines.filter((l) => l.character === chars[1]).map((l) => ({ ...l, slotIndex: 1 })) : [];

        const slots = content.slots || [
          { slotIndex: 0, avatarId: content.heygenAvatarAId || '' },
          { slotIndex: 1, avatarId: content.heygenAvatarBId || '' },
        ];
        const instVoiceId = process.env.HEYGEN_INSTRUCTOR_VOICE_ID!;
        const studVoiceId = process.env.HEYGEN_STUDENT_VOICE_ID!;

        let instructorVideoUrl: string | undefined = content.instructorVideoUrl || undefined;
        let studentVideoUrl: string | undefined = content.studentVideoUrl || undefined;

        if (!instructorVideoUrl && slot0Lines.length > 0) {
          let instJobId: string = content.heygenInstructorJobId;
          if (instJobId) {
            const check = await checkDialogueVideoStatus(instJobId);
            console.log(`[slide ${slide.order}] dialogue instructor: existing job=${instJobId} status=${check.status}`);
            if (check.status === 'failed') instJobId = '';
          }
          if (!instJobId) {
            instJobId = await submitDialogueVideo(slot0Lines, slots, { 0: instVoiceId });
            console.log(`[slide ${slide.order}] dialogue instructor jobId=${instJobId}`);
            await db.update(slides).set({ content: sql`content || ${JSON.stringify({ heygenInstructorJobId: instJobId })}::jsonb`, updatedAt: new Date() }).where(eq(slides.id, slide.id));
          }
          const url = await pollUntilDone(instJobId, `slide ${slide.order} dialogue instructor`);
          const fileName = `dialogue_${slide.id}_instructor_${instJobId}.mp4`;
          const r2Key = `courses/${COURSE_ID}/video/${fileName}`;
          instructorVideoUrl = await uploadToR2(url, r2Key, 'video/mp4');
          await db.insert(mediaFiles).values({ organizationId: orgId, r2Key, url: instructorVideoUrl, fileName, fileType: 'video', mimeType: 'video/mp4', courseId: COURSE_ID });
        }

        if (!studentVideoUrl && slot1Lines.length > 0) {
          let studJobId: string = content.heygenStudentJobId;
          if (studJobId) {
            const check = await checkDialogueVideoStatus(studJobId);
            console.log(`[slide ${slide.order}] dialogue student: existing job=${studJobId} status=${check.status}`);
            if (check.status === 'failed') studJobId = '';
          }
          if (!studJobId) {
            studJobId = await submitDialogueVideo(slot1Lines, slots, { 1: studVoiceId });
            console.log(`[slide ${slide.order}] dialogue student jobId=${studJobId}`);
            await db.update(slides).set({ content: sql`content || ${JSON.stringify({ heygenStudentJobId: studJobId })}::jsonb`, updatedAt: new Date() }).where(eq(slides.id, slide.id));
          }
          const url = await pollUntilDone(studJobId, `slide ${slide.order} dialogue student`);
          const fileName = `dialogue_${slide.id}_student_${studJobId}.mp4`;
          const r2Key = `courses/${COURSE_ID}/video/${fileName}`;
          studentVideoUrl = await uploadToR2(url, r2Key, 'video/mp4');
          await db.insert(mediaFiles).values({ organizationId: orgId, r2Key, url: studentVideoUrl, fileName, fileType: 'video', mimeType: 'video/mp4', courseId: COURSE_ID });
        }

        const [fresh] = await db.select({ content: slides.content }).from(slides).where(eq(slides.id, slide.id)).limit(1);
        const freshContent = (fresh?.content || {}) as Record<string, any>;
        const currentSlots: any[] = Array.isArray(freshContent.slots) && freshContent.slots.length >= 2 ? freshContent.slots : slots;
        const updatedSlots = currentSlots.map((s: any) => {
          if (s.slotIndex === 0 && instructorVideoUrl) return { ...s, videoUrl: instructorVideoUrl };
          if (s.slotIndex === 1 && studentVideoUrl) return { ...s, videoUrl: studentVideoUrl };
          return s;
        });
        await db.update(slides).set({
          content: { ...freshContent, ...(instructorVideoUrl ? { instructorVideoUrl } : {}), ...(studentVideoUrl ? { studentVideoUrl } : {}), slots: updatedSlots },
          assetStatus: 'ready',
          updatedAt: new Date(),
        }).where(eq(slides.id, slide.id));
        console.log(`[slide ${slide.order}] dialogue: done`);
      }
    } catch (err: any) {
      console.error(`[slide ${slide.order}] FAILED:`, err.message);
      await db.update(slides).set({ assetStatus: 'failed', updatedAt: new Date() }).where(eq(slides.id, slide.id));
    }
  }

  const [remaining] = await db.select({ count: sql<number>`count(*)::int` }).from(slides).where(
    and(eq(slides.courseId, COURSE_ID), eq(slides.language, 'en'), inArray(slides.assetStatus, ['generating', 'pending']))
  );
  if (remaining.count === 0) {
    await db.update(courses).set({ generationStatus: 'ready', updatedAt: new Date() }).where(eq(courses.id, COURSE_ID));
    console.log('Course finalized: generationStatus = ready');
  } else {
    console.log(`Course NOT finalized: ${remaining.count} slides still pending/generating (failed ones don't block).`);
  }

  console.log('ALL_DONE');
  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
