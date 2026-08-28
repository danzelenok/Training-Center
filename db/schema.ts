import { pgTable, uuid, text, integer, bigint, timestamp, boolean, jsonb, unique, type AnyPgColumn } from "drizzle-orm/pg-core";

// 0. ORGANIZATIONS TABLE
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkOrgId: text("clerk_org_id").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 0.5. JURISDICTIONS TABLE (platform-wide reference data, not per-organization)
export const jurisdictions = pgTable("jurisdictions", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(), // "WA", "OR", "CA"
  name: text("name").notNull(), // "Washington L&I"
  regulatorName: text("regulator_name").notNull(),
  baseSourceUrl: text("base_source_url").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  isStatePlan: boolean("is_state_plan").default(true).notNull(), // false only for the federal record — distinguishes "assignable to a worker" from "just a base source"
});

// 0.6. ORGANIZATION_JURISDICTIONS TABLE (which states an organization operates in)
export const organizationJurisdictions = pgTable("organization_jurisdictions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  jurisdictionId: uuid("jurisdiction_id").references(() => jurisdictions.id, { onDelete: "cascade" }).notNull(),
}, (table) => ({
  unique: unique().on(table.organizationId, table.jurisdictionId),
}));

// 0.7. ADMIN_ROLES TABLE (per-organization admin role assignment; separate from Clerk membership)
export const adminRoles = pgTable("admin_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  clerkUserId: text("clerk_user_id").notNull(), // Clerk user id; not a FK, Clerk is the source of truth for the user itself
  role: text("role").$type<"org_admin" | "jurisdiction_admin">().notNull(),
  jurisdictionId: uuid("jurisdiction_id").references(() => jurisdictions.id), // null for org_admin, required for jurisdiction_admin
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueOrgUser: unique().on(table.organizationId, table.clerkUserId),
}));

// 1. COURSES TABLE
export const courses = pgTable("courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  ownerJurisdictionId: uuid("owner_jurisdiction_id").notNull().references(() => jurisdictions.id),
  // Set only on a course created via "Clone to my jurisdiction"; the clone is
  // fully independent afterward — this is an audit trail, not a live link.
  sourceOfCloneId: uuid("source_of_clone_id").references((): AnyPgColumn => courses.id, { onDelete: "set null" }),
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
  jurisdictionId: uuid("jurisdiction_id").references(() => jurisdictions.id), // null = base slide, shown to all
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 2.5. COURSE_SOURCES TABLE (source material per course+jurisdiction, including the base version)
export const courseSources = pgTable("course_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  jurisdictionId: uuid("jurisdiction_id").references(() => jurisdictions.id), // null = base part
  sourceUrl: text("source_url").notNull(),
  retrievedAt: timestamp("retrieved_at").defaultNow().notNull(),
}, (table) => ({
  unique: unique().on(table.courseId, table.jurisdictionId),
}));

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
  managerId: uuid("manager_id").references((): AnyPgColumn => workers.id, { onDelete: "set null" }),
  jurisdictionId: uuid("jurisdiction_id").references(() => jurisdictions.id),
  roleId: uuid("role_id").references((): AnyPgColumn => jobRoles.id, { onDelete: "set null" }),
  active: boolean("active").default(true).notNull(),
  deactivatedAt: timestamp("deactivated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 3.05. WORKER_STATUS_EVENTS TABLE (audit trail of active/deactivated transitions)
// Superseded by EMPLOYMENT_EVENTS below — no longer read or written by app code.
// Kept here (and in the DB) until a follow-up migration drops it once the
// employment_events backfill is confirmed trustworthy in production.
export const workerStatusEvents = pgTable("worker_status_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  workerId: uuid("worker_id").notNull().references(() => workers.id, { onDelete: "cascade" }),
  status: text("status").$type<"active" | "deactivated">().notNull(),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
});

// 3.06. JOB_ROLES TABLE (organization-level role reference data)
export const jobRoles = pgTable("job_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueOrgRoleName: unique().on(table.organizationId, table.name),
}));

// 3.07. EMPLOYMENT_EVENTS TABLE (append-only audit log; a worker's state as of
// date X is reconstructed as the latest row with eventDate <= X)
export const employmentEvents = pgTable("employment_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  workerId: uuid("worker_id").notNull().references(() => workers.id, { onDelete: "cascade" }),
  eventType: text("event_type").$type<"hired" | "role_changed" | "deactivated" | "reactivated">().notNull(),
  eventDate: timestamp("event_date").notNull(),
  newRoleId: uuid("new_role_id").references(() => jobRoles.id, { onDelete: "set null" }),
  createdByAdminId: text("created_by_admin_id"), // Clerk user id; not a FK, same convention as admin_roles.clerk_user_id. Null for backfilled/system-generated rows.
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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

// 3.4. COURSE_ROLES TABLE (many-to-many; supersedes the earlier single
// nullable courses.role_id — a course can target more than one job role)
export const courseRoles = pgTable("course_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  roleId: uuid("role_id").notNull().references(() => jobRoles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueCourseRole: unique().on(table.courseId, table.roleId),
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

