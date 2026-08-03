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

type PublishOrResendVariant = "publish" | "resend";

interface PublishOrResendVars {
  courseId: string;
  variant: PublishOrResendVariant;
}

interface PublishOrResendResult {
  telegramMessageId?: string | null;
  telegramGroupId?: string | null;
  [key: string]: unknown;
}

const PUBLISH_OR_RESEND_FALLBACK_ERROR: Record<PublishOrResendVariant, string> = {
  publish: "Failed to publish course",
  resend: "Failed to resend course",
};

// Publish (draft -> published) and Resend (already published) hit the exact
// same POST /api/courses/:id/publish with no body — the server can't tell
// them apart, only the client-side toast wording and which button is shown
// differ. `variant` here only selects the error fallback string; toast
// framing (loading/success text) stays in the page, same as the rest of
// this migration's pattern. Sends a real Telegram DM blast to every worker
// currently assigned to the course — retry:0 is explicit, not relying on
// the mutation default, so a network blip can never silently re-send it.
export function usePublishOrResendCourseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    retry: 0,
    mutationFn: async ({ courseId, variant }: PublishOrResendVars): Promise<PublishOrResendResult> => {
      const res = await fetch(`/api/courses/${courseId}/publish`, { method: "POST" });
      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        const msg = ct.includes("application/json")
          ? (await res.json()).error
          : `Server error ${res.status}`;
        throw new Error(msg || PUBLISH_OR_RESEND_FALLBACK_ERROR[variant]);
      }
      return res.json();
    },
    onSuccess: () => {
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
