import { pgTable, uuid, text, integer, bigint, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

// 1. COURSES TABLE
export const courses = pgTable("courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").$type<"draft" | "published">().default("draft").notNull(),
  telegramMessageId: bigint("telegram_message_id", { mode: "bigint" }),
  telegramGroupId: bigint("telegram_group_id", { mode: "bigint" }),
  generationStatus: text("generation_status").$type<"none" | "pending" | "generating" | "ready" | "failed">().default("none").notNull(),
  themeType: text("theme_type").default("preset").notNull(),
  themeValue: text("theme_value").default("linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 2. SLIDES TABLE
export const slides = pgTable("slides", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id")
    .references(() => courses.id, { onDelete: "cascade" })
    .notNull(),
  order: integer("order").notNull(),
  type: text("type").$type<"text" | "image" | "video" | "audio" | "quiz" | "dialogue" | "chat" | "poll">().notNull(),
  content: jsonb("content").notNull(),
  language: text("language").default("en").notNull(),
  assetStatus: text("asset_status").$type<"pending" | "generating" | "ready" | "failed">().default("ready").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 3. WORKERS TABLE
export const workers = pgTable("workers", {
  id: uuid("id").defaultRandom().primaryKey(),
  telegramUserId: bigint("telegram_user_id", { mode: "bigint" }).unique().notNull(),
  telegramUsername: text("telegram_username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 4. PROGRESS TABLE
export const progress = pgTable("progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  workerId: uuid("worker_id")
    .references(() => workers.id, { onDelete: "cascade" })
    .notNull(),
  courseId: uuid("course_id")
    .references(() => courses.id, { onDelete: "cascade" })
    .notNull(),
  currentSlideIndex: integer("current_slide_index").default(0).notNull(),
  status: text("status").$type<"not_started" | "in_progress" | "completed">().default("not_started").notNull(),
  quizScore: integer("quiz_score"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 5. REMINDERS TABLE
export const reminders = pgTable("reminders", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id")
    .references(() => courses.id, { onDelete: "cascade" })
    .notNull(),
  scheduleExpression: text("schedule_expression").notNull(),
  inngestJobId: text("inngest_job_id"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
