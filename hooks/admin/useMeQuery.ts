import { useQuery } from "@tanstack/react-query";

export interface MeResponse {
  role: "org_admin" | "jurisdiction_admin";
  jurisdiction: { id: string; code: string; name: string } | null;
}

async function fetchMe(): Promise<MeResponse> {
  const res = await fetch("/api/admin/me");
  if (!res.ok) throw new Error("Failed to fetch current admin role");
  return res.json();
}

export function useMeQuery() {
  return useQuery({
    queryKey: ["admin-me"],
    queryFn: fetchMe,
    staleTime: 5 * 60 * 1000,
  });
}
