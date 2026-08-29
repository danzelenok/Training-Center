import { useQuery } from "@tanstack/react-query";
import {
  workersKeys,
  coursesKeys,
  jurisdictionsKeys,
  jobRolesKeys,
  type WorkersListResponse,
  type Course,
  type JurisdictionRef,
  type JobRoleRef,
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

async function fetchCourses(): Promise<Course[]> {
  const res = await fetch("/api/courses");
  if (!res.ok) throw new Error("Failed to fetch courses");
  return res.json();
}

// Defaults to "published" — the original (and still most common) caller,
// the workers page's course-assignment dropdown, only ever wants published
// courses. Pass "all" for admin screens that manage courses regardless of
// status (reports' filter dropdown, courses.tsx).
export function useCoursesQuery(status: "published" | "all" = "published") {
  return useQuery({
    queryKey: status === "all" ? coursesKeys.all() : coursesKeys.published(),
    queryFn: async () => {
      const courses = await fetchCourses();
      return status === "all" ? courses : courses.filter((c) => c.status === "published");
    },
  });
}

async function fetchJurisdictions(): Promise<JurisdictionRef[]> {
  const res = await fetch("/api/admin/jurisdictions");
  if (!res.ok) throw new Error("Failed to fetch jurisdictions");
  return res.json();
}

export function useJurisdictionsQuery() {
  return useQuery({
    queryKey: jurisdictionsKeys.list(),
    queryFn: fetchJurisdictions,
  });
}

async function fetchJobRoles(): Promise<JobRoleRef[]> {
  const res = await fetch("/api/job-roles");
  if (!res.ok) throw new Error("Failed to fetch job roles");
  return res.json();
}

export function useJobRolesQuery() {
  return useQuery({
    queryKey: jobRolesKeys.list(),
    queryFn: fetchJobRoles,
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
