import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteReportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/reports/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete report");
    },
    onSuccess: () => {
      // Prefix match — invalidates every ['reports', courseId, status]
      // variant, regardless of which filter combo is currently active.
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}
