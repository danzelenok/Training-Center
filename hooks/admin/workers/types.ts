export interface JurisdictionRef {
  id: string;
  code: string;
  name: string;
}

export interface ManagerRef {
  id: string;
  name: string;
}

export interface JobRoleRef {
  id: string;
  name: string;
}

export interface Worker {
  id: string;
  telegramUserId: string | null;
  telegramUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  phone?: string | null;
  jurisdictionId: string | null;
  roleId: string | null;
  active: boolean;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  coursesAssigned: number;
}

export interface Course {
  id: string;
  title: string;
  status: string;
}

export interface WorkerCourseProgress {
  assignmentId: string;
  progressId: string | null;
  courseId: string;
  courseTitle: string;
  status: "not_started" | "in_progress" | "completed";
  currentSlideIndex: number;
  quizScore: number | null;
  completedAt: string | null;
  assignedAt: string;
  updatedAt: string;
  totalSlides: number;
}

export interface WorkerPollResponse {
  id: string;
  courseId: string;
  slideIndex: number;
  rating: string | null;
  comment: string | null;
  createdAt: string;
  question: string | null;
}

export interface EmploymentEvent {
  id: string;
  eventType: "hired" | "role_changed" | "deactivated" | "reactivated";
  eventDate: string;
  newRoleId: string | null;
  newRoleName: string | null;
  note: string | null;
}

export interface WorkerDetail extends Worker {
  manager: ManagerRef | null;
  jurisdiction: JurisdictionRef | null;
  role: JobRoleRef | null;
  courses: WorkerCourseProgress[];
  pollResponses: WorkerPollResponse[];
  employmentHistory: EmploymentEvent[];
}

export interface WorkersListResponse {
  workers: Worker[];
  totalCount: number;
  activeThisWeek: number;
  pendingModules: number;
  deactivatedCount: number;
}

export function workerDisplayName(w: Worker | WorkerDetail | null): string {
  if (!w) return "";
  if (w.displayName) return w.displayName;
  const name = [w.firstName, w.lastName].filter(Boolean).join(" ");
  if (name) return name;
  return "Unnamed Worker";
}

export const workersKeys = {
  list: () => ["workers"] as const,
  detail: (workerId: string) => ["worker", workerId] as const,
};

export const coursesKeys = {
  published: () => ["courses", "published"] as const,
  all: () => ["courses", "all"] as const,
};

export const jurisdictionsKeys = {
  list: () => ["jurisdictions"] as const,
};

export const jobRolesKeys = {
  list: () => ["job-roles"] as const,
};
