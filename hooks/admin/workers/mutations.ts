import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { workersKeys, type Worker } from "./types";

function invalidateWorkerAndList(
  queryClient: ReturnType<typeof useQueryClient>,
  workerId?: string
) {
  queryClient.invalidateQueries({ queryKey: workersKeys.list() });
  if (workerId) {
    queryClient.invalidateQueries({ queryKey: workersKeys.detail(workerId) });
  }
}

// --- Create worker (replaces performCreateWorker) ---

interface CreateWorkerVars {
  name: string;
  phone: string;
}

interface CreateWorkerResult {
  worker: Worker;
  inviteUrl: string;
}

export function useCreateWorkerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, phone }: CreateWorkerVars): Promise<CreateWorkerResult> => {
      const res = await fetch("/api/admin/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create worker");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workersKeys.list() });
      toast.success("Worker created successfully!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error creating worker");
    },
  });
}

// --- Save worker edit: name/phone (replaces handleSaveWorkerEdit) ---

interface SaveWorkerEditVars {
  workerId: string;
  name: string;
  phone: string;
}

export function useSaveWorkerEditMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ workerId, name, phone }: SaveWorkerEditVars) => {
      const res = await fetch(`/api/workers/${workerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update worker");
      return data;
    },
    onSuccess: (_data, { workerId }) => {
      invalidateWorkerAndList(queryClient, workerId);
      toast.success("Worker updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not update worker");
    },
  });
}

// --- Reissue invite link (replaces handleReissueInvite) ---

interface ReissueInviteVars {
  workerId: string;
}

interface ReissueInviteResult {
  inviteUrl: string;
}

export function useReissueInviteMutation() {
  return useMutation({
    mutationFn: async ({ workerId }: ReissueInviteVars): Promise<ReissueInviteResult> => {
      const res = await fetch(`/api/admin/workers/${workerId}/invites`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reissue invite link");
      return data;
    },
    onMutate: () => {
      const toastId = toast.loading("Generating new invite link...");
      return { toastId };
    },
    onSuccess: (_data, _vars, context) => {
      toast.success("New invite link generated!", { id: context?.toastId });
    },
    onError: (err: Error, _vars, context) => {
      toast.error(err.message || "Could not reissue invite link", { id: context?.toastId });
    },
  });
}

// --- Unbind Telegram (replaces handleConfirmUnbind) ---

interface UnbindWorkerVars {
  workerId: string;
}

interface UnbindWorkerResult {
  inviteUrl: string;
}

export function useUnbindWorkerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ workerId }: UnbindWorkerVars): Promise<UnbindWorkerResult> => {
      const res = await fetch(`/api/admin/workers/${workerId}/unbind`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset Telegram connection");
      return data;
    },
    onMutate: () => {
      const toastId = toast.loading("Resetting Telegram connection...");
      return { toastId };
    },
    onSuccess: (_data, { workerId }, context) => {
      invalidateWorkerAndList(queryClient, workerId);
      toast.success("Telegram connection reset. New invite link generated!", {
        id: context?.toastId,
      });
    },
    onError: (err: Error, _vars, context) => {
      toast.error(err.message || "Could not reset Telegram connection", { id: context?.toastId });
    },
  });
}

// --- Assign course (replaces handleAssignCourse) ---

interface AssignCourseVars {
  workerId: string;
  courseId: string;
}

interface AssignCourseResult {
  isNew: boolean;
}

export function useAssignCourseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ workerId, courseId }: AssignCourseVars): Promise<AssignCourseResult> => {
      const res = await fetch(`/api/workers/${workerId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      if (!res.ok) throw new Error("Failed to assign course");
      return res.json();
    },
    onMutate: () => {
      const toastId = toast.loading("Assigning course...");
      return { toastId };
    },
    onSuccess: (data, { workerId }, context) => {
      invalidateWorkerAndList(queryClient, workerId);
      if (data.isNew) {
        toast.success("Course assigned successfully!", { id: context?.toastId });
      } else {
        toast.info("Worker is already assigned to this course.", { id: context?.toastId });
      }
    },
    onError: (err: Error, _vars, context) => {
      toast.error(err.message || "Error assigning course", { id: context?.toastId });
    },
  });
}

// --- Remove course assignment (replaces handleRemoveCourse) ---

interface RemoveCourseVars {
  assignmentId: string;
  workerId: string;
}

export function useRemoveCourseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId }: RemoveCourseVars) => {
      const res = await fetch(`/api/reports/${assignmentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove course");
    },
    onSuccess: (_data, { workerId }) => {
      invalidateWorkerAndList(queryClient, workerId);
      toast.success("Course removed");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not remove course");
    },
  });
}

// --- Mark course completed (replaces handleMarkCompleted) ---

interface MarkCompletedVars {
  progressId: string | null;
  assignmentId: string;
  workerId: string;
}

export function useMarkCompletedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ progressId, assignmentId }: MarkCompletedVars) => {
      const idToUse = progressId ?? assignmentId;
      const res = await fetch(`/api/reports/${idToUse}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to mark as completed");
    },
    onSuccess: (_data, { workerId }) => {
      invalidateWorkerAndList(queryClient, workerId);
      toast.success("Marked as completed");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not mark as completed");
    },
  });
}

// --- Toggle worker active/deactivated (replaces handleToggleActive) ---

interface ToggleWorkerActiveVars {
  workerId: string;
  nextActive: boolean;
}

export function useToggleWorkerActiveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ workerId, nextActive }: ToggleWorkerActiveVars) => {
      const res = await fetch(`/api/workers/${workerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update worker status");
      return data;
    },
    onSuccess: (_data, { workerId, nextActive }) => {
      invalidateWorkerAndList(queryClient, workerId);
      toast.success(nextActive ? "Worker reactivated" : "Worker deactivated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not update worker status");
    },
  });
}

// --- Update worker's teams (replaces handleToggleWorkerTeam) ---

interface UpdateWorkerTeamsVars {
  workerId: string;
  teamIds: string[];
  checked: boolean;
}

export function useUpdateWorkerTeamsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ workerId, teamIds }: UpdateWorkerTeamsVars) => {
      const res = await fetch(`/api/workers/${workerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamIds }),
      });
      if (!res.ok) throw new Error("Failed to update teams");
    },
    onSuccess: (_data, { workerId, checked }) => {
      invalidateWorkerAndList(queryClient, workerId);
      toast.success(checked ? "Added to team" : "Removed from team");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not update teams");
    },
  });
}

// --- Delete worker (replaces handleDeleteWorker) ---

interface DeleteWorkerVars {
  workerId: string;
}

export function useDeleteWorkerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ workerId }: DeleteWorkerVars) => {
      const res = await fetch(`/api/workers/${workerId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete worker");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workersKeys.list() });
      toast.success("Worker deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not delete worker");
    },
  });
}
