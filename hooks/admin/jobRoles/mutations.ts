import { useMutation, useQueryClient } from "@tanstack/react-query";
import { jobRolesKeys } from "@/hooks/admin/workers/types";

interface CreateJobRoleResult {
  id: string;
  name: string;
}

export function useCreateJobRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<CreateJobRoleResult> => {
      const res = await fetch("/api/job-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create role");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobRolesKeys.list() });
    },
  });
}

interface RenameJobRoleVars {
  roleId: string;
  name: string;
}

export function useRenameJobRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roleId, name }: RenameJobRoleVars) => {
      const res = await fetch(`/api/job-roles/${roleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to rename role");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobRolesKeys.list() });
    },
  });
}

export function useDeleteJobRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roleId: string) => {
      const res = await fetch(`/api/job-roles/${roleId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete role");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobRolesKeys.list() });
    },
  });
}
