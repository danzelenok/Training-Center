export interface TeamRef {
  id: string;
  name: string;
}

export interface ManagerRef {
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
  active: boolean;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  coursesAssigned: number;
  teams: TeamRef[];
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

export interface WorkerStatusEvent {
  id: string;
  status: "active" | "deactivated";
  changedAt: string;
}

export interface WorkerDetail extends Worker {
  manager: ManagerRef | null;
  courses: WorkerCourseProgress[];
  pollResponses: WorkerPollResponse[];
  statusHistory: WorkerStatusEvent[];
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
};

export const teamsKeys = {
  list: () => ["teams"] as const,
};
