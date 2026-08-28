import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { teamKeys, type AdminRole } from "./types";

interface InviteAdminVars {
  email: string;
  role: AdminRole;
  jurisdictionId: string | null;
}

export function useInviteAdminMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, role, jurisdictionId }: InviteAdminVars) => {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, jurisdictionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to send invite");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all() });
      toast.success("Invite sent!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not send invite");
    },
  });
}

interface ChangeAdminRoleVars {
  clerkUserId: string;
  role: AdminRole;
  jurisdictionId: string | null;
}

export function useChangeAdminRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clerkUserId, role, jurisdictionId }: ChangeAdminRoleVars) => {
      const res = await fetch(`/api/admin/team/${clerkUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, jurisdictionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to change role");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all() });
      toast.success("Role updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not update role");
    },
  });
}

export function useRemoveAdminMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clerkUserId }: { clerkUserId: string }) => {
      const res = await fetch(`/api/admin/team/${clerkUserId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to remove admin");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all() });
      toast.success("Admin removed");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not remove admin");
    },
  });
}

export function useRevokeInvitationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ invitationId }: { invitationId: string }) => {
      const res = await fetch(`/api/admin/team/invitations/${invitationId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to revoke invitation");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all() });
      toast.success("Invitation revoked");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not revoke invitation");
    },
  });
}
