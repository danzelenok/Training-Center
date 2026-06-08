import { Bot, InlineKeyboard } from "grammy";
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

// Initialize standard command/event handlers
bot.command("start", async (ctx) => {
  await ctx.reply(
    "👋 *Welcome to the Safety Training Assistant!*\n\n" +
      "Use our interactive courses directly inside Telegram to complete your micro-learning modules. " +
      "Keep an eye out for course announcements in your team's group chat! 🚀",
    { parse_mode: "Markdown" }
  );
});

/**
 * Sends a course announcement to the configured Telegram Group with a Mini App web_app button.
 * @param courseId The unique identifier of the course.
 * @param courseTitle The title of the course.
 * @returns The message_id of the posted announcement.
 */
export async function sendCourseAnnouncement(courseId: string, courseTitle: string): Promise<number> {
  const groupId = process.env.TELEGRAM_GROUP_ID || env.TELEGRAM_GROUP_ID;
  if (!groupId) {
    throw new Error("TELEGRAM_GROUP_ID is not configured in environment variables.");
  }

  const miniAppBaseUrl =
    env.MINI_APP_URL ||
    process.env.NEXT_PUBLIC_MINI_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL;

  if (!miniAppBaseUrl) {
    throw new Error("Neither NEXT_PUBLIC_MINI_APP_URL nor NEXT_PUBLIC_APP_URL is configured.");
  }

  const courseUrl = `${miniAppBaseUrl}/mini-app/${courseId}`;

  const messageText =
    `🚀 *New Safety Training Course Available!*\n\n` +
    `📚 *Course Title:* ${courseTitle}\n\n` +
    `Stay safe, stay compliant! Tap the button below to start this interactive micro-learning module directly within Telegram.`;

  console.log("courseUrl:", courseUrl);
  const keyboard = new InlineKeyboard().url("📖 Start Learning", courseUrl);

  const message = await bot.api.sendMessage(groupId, messageText, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });

  return message.message_id;
}

/**
 * Sends a direct message completion notification to the configured administrator.
 * @param workerName Name of the worker who completed the training.
 * @param courseTitle Title of the completed course.
 */
export async function notifyAdminCompletion(workerName: string, courseTitle: string): Promise<void> {
  const adminUserId = process.env.TELEGRAM_ADMIN_USER_ID || env.TELEGRAM_ADMIN_USER_ID;
  if (!adminUserId) {
    console.warn("TELEGRAM_ADMIN_USER_ID is not configured. Admin completion notification skipped.");
    return;
  }

  const messageText =
    `✅ *Course Completed Successfully!*\n\n` +
    `👷‍♂️ *Worker:* ${workerName}\n` +
    `📚 *Course:* ${courseTitle}\n\n` +
    `The worker has fully completed the training module and passed any associated quiz.`;

  await bot.api.sendMessage(adminUserId, messageText, {
    parse_mode: "Markdown",
  });
}

/**
 * Sends a reminder direct message to a worker regarding an active course.
 * @param telegramUserId The worker's unique Telegram user ID.
 * @param courseTitle Title of the course.
 */
export async function sendReminderToWorker(
  telegramUserId: string | number | bigint,
  courseTitle: string
): Promise<void> {
  const chatId = typeof telegramUserId === "bigint" ? telegramUserId.toString() : telegramUserId;

  const messageText =
    `⏰ *Training Reminder*\n\n` +
    `You have an active safety learning module waiting for you:\n` +
    `📚 *${courseTitle}*\n\n` +
    `It only takes a few minutes! Please open the Safety Training Mini App to complete your training. 💪`;

  await bot.api.sendMessage(chatId, messageText, {
    parse_mode: "Markdown",
  });
}
