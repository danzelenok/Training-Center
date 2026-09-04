import { db } from '../db/index';
import { slides, courses } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';

async function main() {
  const courseId = '6aef5e8e-44a0-4c3d-9d63-6805cc5d6aa0';
  const [course] = await db.select({ generationStatus: courses.generationStatus }).from(courses).where(eq(courses.id, courseId)).limit(1);
  console.log('course.generationStatus =', course?.generationStatus);

  const rows = await db
    .select({ id: slides.id, order: slides.order, type: slides.type, assetStatus: slides.assetStatus, content: slides.content })
    .from(slides)
    .where(and(eq(slides.courseId, courseId), eq(slides.language, 'en')))
    .orderBy(slides.order);
  console.log(JSON.stringify(rows.map(r => ({ order: r.order, type: r.type, assetStatus: r.assetStatus, heygenJobId: (r.content as any)?.heygenJobId, hasImageUrl: !!(r.content as any)?.imageUrl, hasUrl: !!(r.content as any)?.url })), null, 2));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
