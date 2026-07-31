import { useQuery } from "@tanstack/react-query";
import {
  workersKeys,
  coursesKeys,
  teamsKeys,
  type WorkersListResponse,
  type Course,
  type TeamRef,
  type WorkerDetail,
} from "./types";

async function fetchWorkers(): Promise<WorkersListResponse> {
  const res = await fetch("/api/workers");
  if (!res.ok) throw new Error("Failed to fetch workers");
  return res.json();
}

export function useWorkersQuery() {
  return useQuery({
    queryKey: workersKeys.list(),
    queryFn: fetchWorkers,
  });
}

async function fetchPublishedCourses(): Promise<Course[]> {
  const res = await fetch("/api/courses");
  if (!res.ok) throw new Error("Failed to fetch courses");
  const data = await res.json();
  return data.filter((c: Course) => c.status === "published");
}

export function useCoursesQuery() {
  return useQuery({
    queryKey: coursesKeys.published(),
    queryFn: fetchPublishedCourses,
  });
}

async function fetchTeams(): Promise<TeamRef[]> {
  const res = await fetch("/api/teams");
  if (!res.ok) throw new Error("Failed to fetch teams");
  return res.json();
}

export function useTeamsQuery() {
  return useQuery({
    queryKey: teamsKeys.list(),
    queryFn: fetchTeams,
  });
}

async function fetchWorkerDetail(workerId: string): Promise<WorkerDetail> {
  const res = await fetch(`/api/workers/${workerId}`);
  if (!res.ok) throw new Error("Failed to fetch worker details");
  return res.json();
}

export function useWorkerDetailQuery(workerId: string | null) {
  return useQuery({
    queryKey: workersKeys.detail(workerId ?? ""),
    queryFn: () => fetchWorkerDetail(workerId as string),
    enabled: workerId !== null,
  });
}
