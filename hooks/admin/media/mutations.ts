import { useMutation, useQueryClient } from "@tanstack/react-query";
import { courseEditorKeys } from "@/hooks/admin/course-editor/types";

// Shares the ['media-files'] key with the course editor's media picker
// (hooks/admin/course-editor/queries.ts useMediaFilesQuery) — deleting a
// file here invalidates that cache too, so the picker never shows a
// stale/deleted file if it's open in another tab.
export function useDeleteMediaFileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fileId: string) => {
      const res = await fetch(`/api/media/${fileId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: courseEditorKeys.mediaFiles() });
    },
  });
}
