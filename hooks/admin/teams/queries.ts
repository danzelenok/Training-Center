import { useQuery } from "@tanstack/react-query";
import { teamRosterKeys, type TeamRosterResponse } from "./types";

async function fetchTeamRoster(teamId: string): Promise<TeamRosterResponse> {
  const res = await fetch(`/api/teams/${teamId}`);
  if (!res.ok) throw new Error("Failed to fetch team roster");
  return res.json();
}

export function useTeamRosterQuery(teamId: string | null) {
  return useQuery({
    queryKey: teamRosterKeys.detail(teamId ?? ""),
    queryFn: () => fetchTeamRoster(teamId as string),
    enabled: teamId !== null,
  });
}
