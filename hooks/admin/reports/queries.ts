import { useQuery } from "@tanstack/react-query";
import { reportsKeys, pollResponsesKeys, type Report, type PollResponse } from "./types";

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
