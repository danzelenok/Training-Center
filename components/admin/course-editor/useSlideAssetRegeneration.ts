import { useCallback } from "react";
import { toast } from "sonner";

interface RegenerateSlideAssetParams {
  asset: "video" | "audio";
  /** Only dialogue's dual-avatar regeneration uses this (regenerate one side independently). */
  slot?: 0 | 1;
  body: Record<string, unknown>;
  successMessage: string;
  /** e.g. "Failed to regenerate video" / "Failed to generate video" / "Failed to regenerate audio" — varies per call site, not just per asset type. */
  errorPrefix: string;
}

/**
 * Shared fetch/toast/assetStatus wrapper around POST /api/slides/:id/regenerate,
 * used identically (but with different bodies/messages) by Dialogue, Audio,
 * and Video slide cards and toolbars. Callers own everything asset-specific:
 * the request body, the slot query param (dialogue only), and both toast
 * strings — this hook only owns the generating→success/failed state
 * transitions and the fetch/error-parsing mechanics.
 */
export function useSlideAssetRegeneration(
  slideId: string | undefined,
  index: number,
  onUpdateSlideContent: (idx: number, updatedFields: any, slideFields?: any) => void
) {
  return useCallback(
    async ({ asset, slot, body, successMessage, errorPrefix }: RegenerateSlideAssetParams) => {
      if (!slideId) return;
      onUpdateSlideContent(index, {}, { assetStatus: "generating" });
      const url =
        slot !== undefined
          ? `/api/slides/${slideId}/regenerate?asset=${asset}&slot=${slot}`
          : `/api/slides/${slideId}/regenerate?asset=${asset}`;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `Server error ${res.status}`);
        }
        toast.success(successMessage);
      } catch (err: any) {
        toast.error(`${errorPrefix}: ${err.message}`);
        onUpdateSlideContent(index, {}, { assetStatus: "failed" });
      }
    },
    [slideId, index, onUpdateSlideContent]
  );
}
