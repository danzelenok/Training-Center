import { useQuery } from "@tanstack/react-query";
import { courseEditorKeys, type Course, type GenerationStatusResponse, type MediaLibraryFile } from "./types";

async function fetchCourse(courseId: string): Promise<Course> {
  const res = await fetch(`/api/courses/${courseId}`);
  if (!res.ok) throw new Error("Course not found");
  return res.json();
}

export function useCourseQuery(courseId: string) {
  return useQuery({
    queryKey: courseEditorKeys.course(courseId),
    queryFn: () => fetchCourse(courseId),
  });
}

async function fetchMediaFiles(): Promise<MediaLibraryFile[]> {
  const res = await fetch("/api/media");
  if (!res.ok) {
    // Error responses are normally {error: string} JSON, but a 502/504 from
    // a proxy in front of the API can return an HTML error page instead —
    // guard the parse so that case falls back to the generic message
    // instead of surfacing a raw "Unexpected token <" JSON error.
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to load media library");
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export function useMediaFilesQuery(enabled: boolean) {
  return useQuery({
    queryKey: courseEditorKeys.mediaFiles(),
    queryFn: fetchMediaFiles,
    enabled,
  });
}

async function fetchGenerationStatus(courseId: string): Promise<GenerationStatusResponse> {
  const res = await fetch(`/api/courses/${courseId}/generation-status`);
  if (!res.ok) throw new Error("Failed to fetch generation status");
  return res.json();
}

// Background poll — a single missed tick isn't worth a toast or a retry
// backoff delay, the next interval tick (2s) covers it. See meta.silent in
// lib/query-client.ts.
export function useGenerationPollingQuery(courseId: string, enabled: boolean) {
  return useQuery({
    queryKey: courseEditorKeys.generationStatus(courseId),
    queryFn: () => fetchGenerationStatus(courseId),
    enabled,
    refetchInterval: enabled ? 2000 : false,
    refetchIntervalInBackground: true,
    retry: false,
    meta: { silent: true },
  });
}
