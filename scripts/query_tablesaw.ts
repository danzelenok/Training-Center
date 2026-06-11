import { db } from '../db/index';
import { slides, courses } from '../db/schema';
import { eq, ilike } from 'drizzle-orm';

async function main() {
  const rows = await db
    .select({ id: slides.id, order: slides.order, type: slides.type, assetStatus: slides.assetStatus })
    .from(slides)
    .innerJoin(courses, eq(slides.courseId, courses.id))
    .where(ilike(courses.title, '%tablesaw%'))
    .orderBy(slides.order);

  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
