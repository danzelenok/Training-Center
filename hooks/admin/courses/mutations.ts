import { useMutation, useQueryClient } from "@tanstack/react-query";

interface CreateCourseVars {
  title: string;
  description: string;
}

interface CreateCourseResult {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published";
  telegramMessageId: string | null;
  telegramGroupId: string | null;
  createdAt: string;
  updatedAt: string;
  slideCount: number;
}

export function useCreateCourseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ title, description }: CreateCourseVars): Promise<CreateCourseResult> => {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      if (!res.ok) throw new Error("Failed to create course");
      return res.json();
    },
    onSuccess: () => {
      // Prefix match — covers both ['courses', 'all'] and
      // ['courses', 'published'].
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
  });
}

// Resets status to draft — does not actually delete the Telegram message
// (see DAN-12) and does not touch assignments/progress. Behavior and toast
// wording intentionally unchanged. retry:0 for the same reason as publish/
// resend — this hits the same route, a retried DELETE should never fire
// silently.
export function useRevokeCourseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    retry: 0,
    mutationFn: async (courseId: string) => {
      const res = await fetch(`/api/courses/${courseId}/publish`, { method: "DELETE" });
      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        const msg = ct.includes("application/json")
          ? (await res.json()).error
          : `Server error ${res.status}`;
        throw new Error(msg || "Failed to revoke course");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
  });
}

export function useDeleteCourseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (courseId: string) => {
      const res = await fetch(`/api/courses/${courseId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete course");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
  });
}
