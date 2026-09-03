import { Bot } from "grammy";
import { env } from "@/env";

// Retrieve the token from environmental variables
const token = process.env.BOT_TOKEN || env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN or BOT_TOKEN is required to initialize the Grammy bot.");
}

// Global declaration to handle Next.js development hot-reloading gracefully
declare global {
  var globalBot: Bot | undefined;
}

// Create and export the singleton Bot instance
export const bot = global.globalBot || new Bot(token);

if (process.env.NODE_ENV !== "production") {
  global.globalBot = bot;
}

import { db } from "@/db";
import { invites, workers, assignments } from "@/db/schema";
import { eq } from "drizzle-orm";

// Initialize standard command/event handlers
bot.command("start", async (ctx) => {
  const token = ctx.match?.toString().trim();

  if (!token) {
    await ctx.reply("You do not have an active invitation link. Please contact your administrator.");
    return;
  }

  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.token, token))
    .limit(1);

  if (!invite || invite.status === "revoked" || invite.expiresAt < new Date()) {
    await ctx.reply("This invitation link is invalid or has expired. Please contact your administrator.");
    return;
  }

  const [worker] = await db
    .select()
    .from(workers)
    .where(eq(workers.id, invite.workerId))
    .limit(1);

  if (!worker) {
    await ctx.reply("Worker account not found. Please contact your administrator.");
    return;
  }

  if (!ctx.from) {
    await ctx.reply("Could not identify your Telegram user profile.");
    return;
  }

  const incomingTelegramId = BigInt(ctx.from.id);

  if (worker.telegramUserId !== null && worker.telegramUserId !== incomingTelegramId) {
    await ctx.reply("This invite link is bound to another account.");
    return;
  }

  await db
    .update(workers)
    .set({
      telegramUserId: incomingTelegramId,
      firstName: ctx.from.first_name || worker.firstName,
      lastName: ctx.from.last_name || worker.lastName,
      telegramUsername: ctx.from.username || worker.telegramUsername,
      updatedAt: new Date(),
    })
    .where(eq(workers.id, worker.id));

  await db
    .update(invites)
    .set({
      status: "used",
      usedAt: new Date(),
      usedByTelegramId: incomingTelegramId,
    })
    .where(eq(invites.id, invite.id));

  await ctx.reply("Welcome! Open the Mini App to start your training.");
});

/**
 * Sends direct message course announcements to all workers assigned to this course who have a linked Telegram user ID.
 * @param courseId The unique identifier of the course.
 * @param courseTitle The title of the course.
 */
export async function sendCourseAnnouncementDMs(courseId: string, courseTitle: string): Promise<void> {
  const assignedWorkers = await db
    .select({
      id: workers.id,
      telegramUserId: workers.telegramUserId,
      displayName: workers.displayName,
      firstName: workers.firstName,
    })
    .from(assignments)
    .innerJoin(workers, eq(workers.id, assignments.workerId))
    .where(eq(assignments.courseId, courseId));

  const botUsername = process.env.TELEGRAM_BOT_USERNAME || "CoolCatTraining_bot";
  const courseUrl = `https://t.me/${botUsername}/CoolCatTraining?startapp=${courseId}`;

  const messageText =
    `🚀 *New Safety Training Course Assigned!*\n\n` +
    `📚 *Course Title:* ${courseTitle}\n\n` +
    `Tap the button below to launch your interactive learning module directly inside Telegram.`;

  let sentCount = 0;
  let skippedCount = 0;

  for (const worker of assignedWorkers) {
    if (!worker.telegramUserId) {
      skippedCount++;
      continue;
    }

    try {
      await bot.api.sendMessage(worker.telegramUserId.toString(), messageText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📖 Start Learning",
                url: courseUrl,
              },
            ],
          ],
        },
      });
      sentCount++;
    } catch (err: any) {
      console.warn(`Failed to send DM announcement to worker ${worker.id}:`, err?.message);
    }
  }

  console.log(`Course announcement DMs summary for course ${courseId}: Sent = ${sentCount}, Skipped (unlinked) = ${skippedCount}`);
}



/**
 * Sends a reminder direct message to a worker regarding an active course.
 * @param telegramUserId The worker's unique Telegram user ID.
 * @param courseTitle Title of the course.
 * @param kind "before" (deadline still ahead) or "after" (deadline has passed) — varies the copy.
 */
export async function sendReminderToWorker(
  telegramUserId: string | number | bigint,
  courseTitle: string,
  kind: "before" | "after" = "before"
): Promise<void> {
  const chatId = typeof telegramUserId === "bigint" ? telegramUserId.toString() : telegramUserId;

  const messageText = kind === "after"
    ? `⚠️ *Training Overdue*\n\n` +
      `Your safety training is now past its due date:\n` +
      `📚 *${courseTitle}*\n\n` +
      `Please complete it as soon as possible via the Safety Training Mini App.`
    : `⏰ *Training Reminder*\n\n` +
      `You have an active safety learning module waiting for you:\n` +
      `📚 *${courseTitle}*\n\n` +
      `It only takes a few minutes! Please open the Safety Training Mini App to complete your training. 💪`;

  await bot.api.sendMessage(chatId, messageText, {
    parse_mode: "Markdown",
  });
}
