import { useQuery } from "@tanstack/react-query";
import { teamKeys, type TeamResponse } from "./types";

async function fetchTeam(): Promise<TeamResponse> {
  const res = await fetch("/api/admin/team");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to fetch team");
  return data;
}

export function useTeamQuery() {
  return useQuery({
    queryKey: teamKeys.all(),
    queryFn: fetchTeam,
  });
}
