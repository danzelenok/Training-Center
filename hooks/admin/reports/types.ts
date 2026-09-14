export interface Report {
  id: string;
  workerId: string;
  workerName: string;
  courseName: string;
  status: "not_started" | "in_progress" | "completed";
  completedAt: string | null;
  quizScore: number | null;
}

export interface PollResponse {
  id: string;
  slideIndex: number;
  rating: string | null;
  comment: string | null;
  createdAt: string;
  courseId: string;
  workerId: string;
  courseName: string;
  workerName: string;
  question: string | null;
}

export const reportsKeys = {
  list: (courseId?: string, status?: string) =>
    ["reports", courseId ?? "all", status ?? "all"] as const,
};

export const pollResponsesKeys = {
  list: (courseId?: string) => ["poll-responses", courseId ?? "all"] as const,
};

export interface ReportCourseListItem {
  id: string;
  title: string;
  status: "draft" | "published";
  publishedAt: string | null;
}

export interface CourseSnapshotWorker {
  workerId: string;
  workerName: string;
  roleId: string | null;
  roleName: string | null; // null = "Role unknown" — no role-bearing event before the snapshot date
  jurisdictionId: string | null;
  jurisdictionCode: string | null;
  jurisdictionName: string | null; // current jurisdiction, not historical — see courseSnapshotKeys note
  status: "not_started" | "in_progress" | "completed";
  completedAt: string | null;
  quizScore: number | null;
}

export interface CourseRunSummary {
  id: string;
  publishedAt: string;
}

export interface CourseSnapshotResponse {
  course: {
    id: string;
    title: string;
    publishedAt: string; // the selected run's publish date, not the course's first-publish date
  };
  runId: string;
  runs: CourseRunSummary[]; // every run of this course, newest first
  workers: CourseSnapshotWorker[];
}

export const reportCoursesKeys = {
  list: () => ["report-courses"] as const,
};

export const courseSnapshotKeys = {
  detail: (courseId: string, runId?: string | null) => ["course-snapshot", courseId, runId ?? "latest"] as const,
};
