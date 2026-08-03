import { useMutation, useQueryClient } from "@tanstack/react-query";
import { teamsKeys } from "@/hooks/admin/workers/types";
import { teamRosterKeys } from "./types";

interface CreateTeamResult {
  id: string;
  name: string;
  memberCount: number;
}

export function useCreateTeamMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<CreateTeamResult> => {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create team");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamsKeys.list() });
    },
  });
}

interface RenameTeamVars {
  teamId: string;
  name: string;
}

export function useRenameTeamMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, name }: RenameTeamVars) => {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to rename team");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamsKeys.list() });
    },
  });
}

export function useDeleteTeamMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string) => {
      const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete team");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamsKeys.list() });
    },
  });
}

interface SaveRosterVars {
  teamId: string;
  workerIds: string[];
}

export function useSaveRosterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, workerIds }: SaveRosterVars) => {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerIds }),
      });
      if (!res.ok) throw new Error("Failed to update roster");
    },
    onSuccess: (_data, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: teamsKeys.list() });
      queryClient.invalidateQueries({ queryKey: teamRosterKeys.detail(teamId) });
    },
  });
}
