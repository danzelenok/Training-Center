import { pgTable, uuid, text, integer, bigint, timestamp, boolean, jsonb, unique } from "drizzle-orm/pg-core";

// 0. ORGANIZATIONS TABLE
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkOrgId: text("clerk_org_id").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 1. COURSES TABLE
export const courses = pgTable("courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").$type<"draft" | "published">().default("draft").notNull(),
  telegramMessageId: bigint("telegram_message_id", { mode: "bigint" }),
  telegramGroupId: bigint("telegram_group_id", { mode: "bigint" }),
  generationStatus: text("generation_status").$type<"none" | "pending" | "generating" | "ready" | "failed">().default("none").notNull(),
  themeType: text("theme_type").default("preset").notNull(),
  themeValue: text("theme_value").default("linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)").notNull(),
  autoAssignNewWorkers: boolean("auto_assign_new_workers").notNull().default(false),
  publishedAt: timestamp("published_at"),
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
  type: text("type").$type<"text" | "video" | "audio" | "quiz" | "dialogue" | "chat" | "poll">().notNull(),
  content: jsonb("content").notNull(),
  language: text("language").default("en").notNull(),
  assetStatus: text("asset_status").$type<"pending" | "generating" | "ready" | "failed">().default("ready").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 3. WORKERS TABLE
export const workers = pgTable("workers", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  telegramUserId: bigint("telegram_user_id", { mode: "bigint" }).unique(),
  telegramUsername: text("telegram_username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  displayName: text("display_name"),
  phone: text("phone"),
  active: boolean("active").default(true).notNull(),
  deactivatedAt: timestamp("deactivated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 3.05. WORKER_STATUS_EVENTS TABLE (audit trail of active/deactivated transitions)
export const workerStatusEvents = pgTable("worker_status_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  workerId: uuid("worker_id").notNull().references(() => workers.id, { onDelete: "cascade" }),
  status: text("status").$type<"active" | "deactivated">().notNull(),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
});

// 3.1. TEAMS TABLE
export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueOrgTeamName: unique().on(table.organizationId, table.name),
}));

// 3.2. WORKER_TEAMS TABLE (many-to-many)
export const workerTeams = pgTable("worker_teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  workerId: uuid("worker_id").notNull().references(() => workers.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueWorkerTeam: unique().on(table.workerId, table.teamId),
}));

// 3.3. COURSE_AUTO_ASSIGN_TEAMS TABLE
export const courseAutoAssignTeams = pgTable("course_auto_assign_teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueCourseTeam: unique().on(table.courseId, table.teamId),
}));

// 3.5. INVITES TABLE
export const invites = pgTable("invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  workerId: uuid("worker_id")
    .references(() => workers.id, { onDelete: "cascade" })
    .notNull(),
  token: text("token").unique().notNull(),
  status: text("status")
    .$type<"pending" | "used" | "revoked" | "expired">()
    .default("pending")
    .notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  usedByTelegramId: bigint("used_by_telegram_id", { mode: "bigint" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  quizAnswers: jsonb("quiz_answers").$type<Record<string, number[]>>(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueProgress: unique().on(table.workerId, table.courseId),
}));

// 5. ASSIGNMENTS TABLE
export const assignments = pgTable("assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  workerId: uuid("worker_id").notNull().references(() => workers.id, { onDelete: "cascade" }),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  uniqueAssignment: unique().on(table.workerId, table.courseId),
}));

// 6. POLL RESPONSES TABLE
export const pollResponses = pgTable("poll_responses", {
  id: uuid("id").defaultRandom().primaryKey(),
  workerId: uuid("worker_id")
    .references(() => workers.id, { onDelete: "cascade" })
    .notNull(),
  courseId: uuid("course_id")
    .references(() => courses.id, { onDelete: "cascade" })
    .notNull(),
  slideIndex: integer("slide_index").notNull(),
  rating: text("rating"),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 7. REMINDERS TABLE
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

// 8. MEDIA_FILES TABLE
export const mediaFiles = pgTable("media_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  r2Key: text("r2_key").notNull(),
  url: text("url").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").$type<"video" | "image" | "audio">().notNull(),
  mimeType: text("mime_type").notNull(),
  size: bigint("size", { mode: "number" }),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

