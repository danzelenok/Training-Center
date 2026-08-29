import { useMutation, useQueryClient } from "@tanstack/react-query";
import { courseEditorKeys, type Course } from "./types";
import type { Slide } from "@/components/admin/course-editor/CardCanvas";

interface AutosavePayload {
  title: string;
  description: string;
  themeType: string;
  themeValue: string;
  autoAssignNewWorkers: boolean;
  roleIds: string[];
  jurisdictionId: string;
  slides: Slide[];
}

async function patchCourse(courseId: string, payload: AutosavePayload | SaveCoursePayload): Promise<Course> {
  const res = await fetch(`/api/courses/${courseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Failed to save changes");
  }
  return res.json();
}

// Debounced background sync (~1.5s after each edit), not a click-triggered
// mutation — the Provider owns the timer and calls .mutate() from inside it.
// Deliberately silent: no toast on success, caller handles onError itself
// (console.error + setSaveStatus("error")), matching the original
// triggerAutoSave behavior exactly.
export function useAutosaveMutation(courseId: string) {
  return useMutation({
    mutationFn: (payload: AutosavePayload) => patchCourse(courseId, payload),
  });
}

interface SaveCoursePayload {
  title: string;
  description: string;
  themeType: string;
  themeValue: string;
  slides: Slide[];
}

// Explicit save (Preview button, Style dialog "Apply", and — in a later
// task — Publish). Toasts and saveStatus are owned by the caller so the
// same mutation can be reused from different flows with different framing.
export function useSaveCourseMutation(courseId: string) {
  return useMutation({
    mutationFn: (payload: SaveCoursePayload) => patchCourse(courseId, payload),
  });
}

interface UploadFileResult {
  fileId: string;
  url: string;
}

export function useUploadFileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<UploadFileResult> => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/media/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Upload failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: courseEditorKeys.mediaFiles() });
    },
  });
}

interface GenerateAIVars {
  prompt: string;
  model: "fast" | "advanced";
  useLNI: boolean;
}

export function useGenerateAIMutation(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ prompt, model, useLNI }: GenerateAIVars) => {
      const res = await fetch(`/api/courses/${courseId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model, useLNI }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate course");
      return data;
    },
    onSuccess: () => {
      // Slides aren't a separate entity with their own key — they ride
      // along on the course payload, so re-fetching ['course', courseId]
      // (picked up by CourseEditorContext's sync effect) is how the newly
      // generated deck reaches slidesList, same as the old fetchCourse() call.
      queryClient.invalidateQueries({ queryKey: courseEditorKeys.course(courseId) });
    },
  });
}

interface GenerateAddendumVars {
  jurisdictionIds: string[];
}

interface GenerateAddendumResult {
  results: { jurisdictionId: string; code: string; status: "ok" | "error"; slideCount?: number; error?: string }[];
}

export function useGenerateAddendumMutation(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jurisdictionIds }: GenerateAddendumVars): Promise<GenerateAddendumResult> => {
      const res = await fetch(`/api/courses/${courseId}/generate-addendum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jurisdictionIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate state variants");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: courseEditorKeys.course(courseId) });
    },
  });
}

interface PPTXUploadResult {
  slides: Slide[];
}

// Raw file body (not FormData) — the parser route expects
// application/octet-stream with the filename in a header.
export function usePPTXUploadMutation(courseId: string) {
  return useMutation({
    mutationFn: async (file: File): Promise<PPTXUploadResult> => {
      const res = await fetch(`/api/courses/${courseId}/upload`, {
        method: "POST",
        body: file,
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Filename": encodeURIComponent(file.name),
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || "Upload failed");
      return data;
    },
  });
}

interface PublishCourseVars {
  assignTo: "all" | "specific";
  workerIds: string[];
  notifyWorkers: boolean;
}

interface PublishCourseResult {
  telegramMessageId: string | null;
  telegramGroupId: string | null;
}

// Sends real Telegram DMs to workers when notifyWorkers is true — no
// automatic retry. A retried publish after a network blip could double-send
// announcements or re-run assignment side effects the caller never asked
// for twice. retry:0 is set explicitly (not relying on the mutation default)
// because this is the one mutation in this app where that default matters.
// No onSuccess/onError here — toast wording and the course-state merge
// depend on publishNotifyTelegram/course, which live in the Provider, so
// confirmPublish drives them via mutateAsync, same shape as the original
// linear try/catch.
export function usePublishCourseMutation(courseId: string) {
  return useMutation({
    retry: 0,
    mutationFn: async (payload: PublishCourseVars): Promise<PublishCourseResult> => {
      const res = await fetch(`/api/courses/${courseId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publishing failed");
      return data;
    },
  });
}
