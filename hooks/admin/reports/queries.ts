import { useQuery } from "@tanstack/react-query";
import {
  reportsKeys,
  pollResponsesKeys,
  reportCoursesKeys,
  courseSnapshotKeys,
  type Report,
  type PollResponse,
  type ReportCourseListItem,
  type CourseSnapshotResponse,
} from "./types";

async function fetchReports(courseId?: string, status?: string): Promise<Report[]> {
  const params = new URLSearchParams();
  if (courseId && courseId !== "all") params.append("courseId", courseId);
  if (status && status !== "all") params.append("status", status);
  const res = await fetch(`/api/reports?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch reports");
  return res.json();
}

export function useReportsQuery(courseId?: string, status?: string) {
  return useQuery({
    queryKey: reportsKeys.list(courseId, status),
    queryFn: () => fetchReports(courseId, status),
  });
}

async function fetchPollResponses(courseId?: string): Promise<PollResponse[]> {
  const params = new URLSearchParams();
  if (courseId && courseId !== "all") params.append("courseId", courseId);
  const res = await fetch(`/api/poll-responses?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch poll responses");
  return res.json();
}

export function usePollResponsesQuery(courseId?: string) {
  return useQuery({
    queryKey: pollResponsesKeys.list(courseId),
    queryFn: () => fetchPollResponses(courseId),
  });
}

async function fetchReportCourses(): Promise<ReportCourseListItem[]> {
  const res = await fetch("/api/reports/courses");
  if (!res.ok) throw new Error("Failed to fetch courses");
  return res.json();
}

export function useReportCoursesQuery() {
  return useQuery({
    queryKey: reportCoursesKeys.list(),
    queryFn: fetchReportCourses,
  });
}

async function fetchCourseSnapshot(courseId: string): Promise<CourseSnapshotResponse> {
  const res = await fetch(`/api/reports/courses/${courseId}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to fetch course snapshot");
  }
  return res.json();
}

export function useCourseSnapshotQuery(courseId: string | null) {
  return useQuery({
    queryKey: courseSnapshotKeys.detail(courseId ?? ""),
    queryFn: () => fetchCourseSnapshot(courseId as string),
    enabled: courseId !== null,
  });
}
