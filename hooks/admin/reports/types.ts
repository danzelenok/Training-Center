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
