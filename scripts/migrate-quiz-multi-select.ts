/**
 * One-time data migration: converts existing "quiz" slides and "dialogue" slides
 * with an embedded quiz (dialogueBelowType: "quiz") from single-answer
 * correctIndex: number to the new multi-select shape:
 *   - quiz slides:            correctIndex -> correctIndices: [correctIndex], quizType: "single"
 *   - dialogue quiz slides:   belowQuizCorrectIndex -> belowQuizCorrectIndices: [belowQuizCorrectIndex], belowQuizType: "single"
 *
 * Idempotent — slides that already have correctIndices/belowQuizCorrectIndices are skipped.
 *
 * Run with:
 *   npx tsx scripts/migrate-quiz-multi-select.ts
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

const sql = neon(DATABASE_URL);

async function main() {
  const candidateSlides = await sql.query(
    `SELECT id, type, content FROM slides WHERE type = 'quiz' OR type = 'dialogue'`
  );

  console.log(`Found ${candidateSlides.length} quiz/dialogue slide(s) to inspect.`);

  let migrated = 0;
  let skipped = 0;

  for (const row of candidateSlides) {
    const content = row.content as Record<string, any>;

    if (row.type === "quiz") {
      if (content.correctIndices !== undefined) {
        skipped++;
        continue;
      }
      if (typeof content.correctIndex !== "number") {
        skipped++;
        continue;
      }

      const newContent = {
        ...content,
        quizType: "single",
        correctIndices: [content.correctIndex],
      };
      await sql.query(`UPDATE slides SET content = $1 WHERE id = $2`, [
        JSON.stringify(newContent),
        row.id,
      ]);
      migrated++;
      continue;
    }

    // dialogue slides — only migrate the embedded quiz branch
    if (content.dialogueBelowType !== "quiz") {
      skipped++;
      continue;
    }
    if (content.belowQuizCorrectIndices !== undefined) {
      skipped++;
      continue;
    }
    if (typeof content.belowQuizCorrectIndex !== "number") {
      skipped++;
      continue;
    }

    const newContent = {
      ...content,
      belowQuizType: "single",
      belowQuizCorrectIndices: [content.belowQuizCorrectIndex],
    };
    await sql.query(`UPDATE slides SET content = $1 WHERE id = $2`, [
      JSON.stringify(newContent),
      row.id,
    ]);
    migrated++;
  }

  console.log(`Migration complete. ${migrated} slide(s) migrated, ${skipped} slide(s) skipped (already migrated or not applicable).`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
